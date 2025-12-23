import { z } from "zod";
import { prisma, type Provider } from "@solarys/db";
import type { ToolDefinition, ToolResult } from "../lib/types.js";

export const schema = z.object({
  providerId: z
    .string()
    .describe("The provider ID to find similar providers for"),
  method: z
    .enum(["statistical", "semantic"])
    .default("semantic")
    .describe("Search method: 'statistical' uses metric ranges, 'semantic' uses AI embeddings for deeper pattern matching"),
});

export const definition: ToolDefinition = {
  name: "search_similar_providers",
  description:
    "Find providers with similar billing patterns to a given provider. Supports two methods: 'statistical' (within 30% of metrics) or 'semantic' (AI-powered embedding similarity for deeper pattern matching). Useful for identifying potential fraud rings or comparing behavior.",
  inputSchema: {
    type: "object",
    properties: {
      providerId: {
        type: "string",
        description: "The provider ID to find similar providers for",
      },
      method: {
        type: "string",
        enum: ["statistical", "semantic"],
        description: "Search method: 'statistical' or 'semantic' (default: semantic)",
      },
    },
    required: ["providerId"],
  },
};

interface SemanticMatch {
  providerId: string;
  similarity: number;
  profileText: string;
}

interface SimilarProvider {
  providerId: string;
  similarityScore: number;
  flaggedForFraud: boolean;
  totalClaims: number;
  totalReimbursement: number;
  profileSummary?: string;
  matchReason?: string;
  sharedPatterns?: string[];
}

export interface SearchSimilarProvidersResult {
  method: string;
  referenceProvider: {
    providerId: string;
    flaggedForFraud: boolean;
    totalClaims: number;
    totalReimbursement: number;
    profileSummary?: string;
  };
  matchesFound: number;
  similarProviders: SimilarProvider[];
  interpretation?: string;
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<SearchSimilarProvidersResult>> {
  const { providerId, method = "semantic" } = args;

  const referenceProvider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!referenceProvider) {
    return {
      success: false,
      error: `Provider not found: ${providerId}`,
    };
  }

  if (method === "semantic") {
    const hasEmbedding = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "ProviderEmbedding" WHERE "providerId" = ${providerId}
    `;

    if (Number(hasEmbedding[0]?.count ?? 0) === 0) {
      return {
        success: false,
        error: `No embedding found for provider ${providerId}. Run the embedding generation script first, or use method: 'statistical'`,
      };
    }

    const semanticMatches = await prisma.$queryRaw<SemanticMatch[]>`
      SELECT
        pe."providerId",
        1 - (pe.embedding <=> (SELECT embedding FROM "ProviderEmbedding" WHERE "providerId" = ${providerId})) as similarity,
        pe."profileText"
      FROM "ProviderEmbedding" pe
      WHERE pe."providerId" != ${providerId}
        AND pe.embedding IS NOT NULL
      ORDER BY pe.embedding <=> (SELECT embedding FROM "ProviderEmbedding" WHERE "providerId" = ${providerId})
      LIMIT 10
    `;

    const providerIds = semanticMatches.map((m) => m.providerId);
    const providerDetails = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
    });
    const providerMap = new Map(providerDetails.map((p) => [p.id, p]));

    const matches = semanticMatches.map((match) => {
      const provider = providerMap.get(match.providerId);
      return {
        providerId: match.providerId,
        similarityScore: parseFloat(match.similarity.toFixed(3)),
        flaggedForFraud: provider?.potentialFraud ?? false,
        totalClaims: provider?.totalClaims ?? 0,
        totalReimbursement: provider?.totalReimbursement ?? 0,
        profileSummary: match.profileText.slice(0, 200) + (match.profileText.length > 200 ? "..." : ""),
        matchReason: "Semantic similarity based on billing patterns, diagnosis codes, and patient demographics",
      };
    });

    const refProfile = await prisma.$queryRaw<{ profileText: string }[]>`
      SELECT "profileText" FROM "ProviderEmbedding" WHERE "providerId" = ${providerId}
    `;

    return {
      success: true,
      data: {
        method: "semantic",
        referenceProvider: {
          providerId: referenceProvider.id,
          flaggedForFraud: referenceProvider.potentialFraud,
          totalClaims: referenceProvider.totalClaims,
          totalReimbursement: referenceProvider.totalReimbursement,
          profileSummary: refProfile[0]?.profileText?.slice(0, 200) ?? "Profile not available",
        },
        matchesFound: matches.length,
        similarProviders: matches,
        interpretation: `Found ${matches.length} providers with similar billing patterns. ${matches.filter((m) => m.flaggedForFraud).length} are also flagged for potential fraud.`,
      },
    };
  }

  // Statistical search
  const SIMILARITY_TOLERANCE = 0.3;
  const claimLower = referenceProvider.totalClaims * (1 - SIMILARITY_TOLERANCE);
  const claimUpper = referenceProvider.totalClaims * (1 + SIMILARITY_TOLERANCE);
  const reimbursementLower = referenceProvider.totalReimbursement * (1 - SIMILARITY_TOLERANCE);
  const reimbursementUpper = referenceProvider.totalReimbursement * (1 + SIMILARITY_TOLERANCE);

  const similarProviders = await prisma.provider.findMany({
    where: {
      id: { not: providerId },
      totalClaims: { gte: claimLower, lte: claimUpper },
      totalReimbursement: { gte: reimbursementLower, lte: reimbursementUpper },
    },
    take: 10,
  });

  const matches = similarProviders.map((provider: Provider) => {
    const claimDeviation =
      Math.abs(provider.totalClaims - referenceProvider.totalClaims) /
      referenceProvider.totalClaims;
    const reimbursementDeviation =
      Math.abs(provider.totalReimbursement - referenceProvider.totalReimbursement) /
      referenceProvider.totalReimbursement;
    const similarityScore = 1 - (claimDeviation + reimbursementDeviation) / 2;

    const sharedPatterns: string[] = [];
    if (claimDeviation < 0.15) sharedPatterns.push("SIMILAR_CLAIM_VOLUME");
    if (reimbursementDeviation < 0.15) sharedPatterns.push("SIMILAR_REIMBURSEMENT_TOTAL");
    if (provider.potentialFraud === referenceProvider.potentialFraud) {
      sharedPatterns.push(
        provider.potentialFraud ? "BOTH_FLAGGED_FRAUD" : "BOTH_UNFLAGGED"
      );
    }

    return {
      providerId: provider.id,
      similarityScore: parseFloat(similarityScore.toFixed(3)),
      flaggedForFraud: provider.potentialFraud,
      totalClaims: provider.totalClaims,
      totalReimbursement: provider.totalReimbursement,
      sharedPatterns,
    };
  });

  matches.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    success: true,
    data: {
      method: "statistical",
      referenceProvider: {
        providerId: referenceProvider.id,
        flaggedForFraud: referenceProvider.potentialFraud,
        totalClaims: referenceProvider.totalClaims,
        totalReimbursement: referenceProvider.totalReimbursement,
      },
      matchesFound: matches.length,
      similarProviders: matches,
    },
  };
}
