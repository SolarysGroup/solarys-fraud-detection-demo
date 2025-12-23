import { z } from "zod";
import { prisma } from "@solarys/db";
import type { ToolDefinition, ToolResult } from "../lib/types.js";
import { generateEmbedding, formatEmbeddingForPostgres } from "../lib/embeddingService.js";

export const schema = z.object({
  query: z
    .string()
    .min(10)
    .describe("Natural language description of fraud pattern to search for"),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(10)
    .describe("Maximum number of matching providers to return (default: 10)"),
  minSimilarity: z
    .number()
    .min(0)
    .max(1)
    .default(0.3)
    .describe("Minimum similarity score to include in results (default: 0.3)"),
});

export const definition: ToolDefinition = {
  name: "search_fraud_patterns",
  description:
    "Search for providers matching a natural language fraud pattern description using AI embeddings. Example queries: 'high claim volume providers treating elderly patients with chronic conditions', 'unusual billing patterns for outpatient procedures', 'providers with patterns similar to known fraud cases'.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language description of fraud pattern to search for",
      },
      limit: {
        type: "number",
        description: "Maximum number of matching providers to return (default: 10)",
        minimum: 1,
        maximum: 20,
      },
      minSimilarity: {
        type: "number",
        description: "Minimum similarity score to include in results (default: 0.3)",
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["query"],
  },
};

interface EmbeddingMatch {
  providerId: string;
  similarity: number;
  profileText: string;
}

interface MatchResult {
  providerId: string;
  similarity: number;
  flaggedForFraud: boolean;
  totalClaims: number;
  totalReimbursement: number;
  profileSummary: string;
}

export interface SearchFraudPatternsResult {
  query: string;
  minSimilarity: number;
  matchesFound: number;
  matches: MatchResult[];
  interpretation: string;
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<SearchFraudPatternsResult>> {
  const { query, limit = 10, minSimilarity = 0.3 } = args;

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: "OPENAI_API_KEY not configured. Set the OPENAI_API_KEY environment variable to enable semantic search.",
    };
  }

  const embeddingCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "ProviderEmbedding" WHERE embedding IS NOT NULL
  `;

  if (Number(embeddingCount[0]?.count ?? 0) === 0) {
    return {
      success: false,
      error: "No provider embeddings found in database. Run the embedding generation script first: npm run generate-embeddings",
    };
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to generate query embedding: ${errorMessage}`,
    };
  }

  const embeddingStr = formatEmbeddingForPostgres(queryEmbedding);

  const matches = await prisma.$queryRawUnsafe<EmbeddingMatch[]>(`
    SELECT
      "providerId",
      1 - (embedding <=> $1::vector) as similarity,
      "profileText"
    FROM "ProviderEmbedding"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, embeddingStr, limit * 2);

  const filteredMatches = matches.filter((m) => m.similarity >= minSimilarity);

  if (filteredMatches.length === 0) {
    return {
      success: true,
      data: {
        query,
        minSimilarity,
        matchesFound: 0,
        matches: [],
        interpretation: `No providers found matching "${query}" with similarity >= ${minSimilarity}. Try a different query or lower the minimum similarity threshold.`,
      },
    };
  }

  const providerIds = filteredMatches.slice(0, limit).map((m) => m.providerId);
  const providerDetails = await prisma.provider.findMany({
    where: { id: { in: providerIds } },
  });
  const providerMap = new Map(providerDetails.map((p) => [p.id, p]));

  const results = filteredMatches.slice(0, limit).map((match) => {
    const provider = providerMap.get(match.providerId);
    return {
      providerId: match.providerId,
      similarity: parseFloat(match.similarity.toFixed(3)),
      flaggedForFraud: provider?.potentialFraud ?? false,
      totalClaims: provider?.totalClaims ?? 0,
      totalReimbursement: provider?.totalReimbursement ?? 0,
      profileSummary: match.profileText,
    };
  });

  const flaggedCount = results.filter((r) => r.flaggedForFraud).length;
  const totalReimbursement = results.reduce((sum, r) => sum + r.totalReimbursement, 0);

  let interpretation = `Found ${results.length} provider${results.length !== 1 ? "s" : ""} matching the pattern "${query}".`;

  if (flaggedCount > 0) {
    interpretation += ` ${flaggedCount} of ${results.length} (${Math.round((flaggedCount / results.length) * 100)}%) are already flagged for potential fraud.`;
  }

  interpretation += ` Combined reimbursement: $${totalReimbursement.toLocaleString()}.`;

  if (flaggedCount / results.length > 0.5) {
    interpretation += " High fraud flag rate suggests this pattern correlates with known fraudulent behavior.";
  }

  return {
    success: true,
    data: {
      query,
      minSimilarity,
      matchesFound: results.length,
      matches: results,
      interpretation,
    },
  };
}
