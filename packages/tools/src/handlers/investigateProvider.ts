import { z } from "zod";
import { prisma, type Provider } from "@solarys/db";
import { getProviderBenchmarks } from "../lib/providerBenchmarks.js";
import type { ToolDefinition, RiskIndicator, DeceasedClaimRow, RiskLevel, ToolResult } from "../lib/types.js";

export const schema = z.object({
  providerId: z.string().describe("The unique identifier of the provider to investigate"),
});

export const definition: ToolDefinition = {
  name: "investigate_provider",
  description:
    "Run a comprehensive fraud investigation on a single provider. Returns a full report with risk analysis, deceased claims, network analysis, and natural language summary suitable for compliance review.",
  inputSchema: {
    type: "object",
    properties: {
      providerId: {
        type: "string",
        description: "The unique identifier of the provider to investigate",
      },
    },
    required: ["providerId"],
  },
};

interface RingMember {
  providerId: string;
  similarityPercent: number;
  totalClaims: number;
  totalReimbursement: number;
}

export interface InvestigateProviderResult {
  providerId: string;
  investigationDate: string;
  overallRiskLevel: RiskLevel;
  confidenceScore: number;
  summary: string;
  providerProfile: {
    totalClaims: number;
    totalReimbursement: number;
    avgClaimAmount: number;
    flaggedForFraud: boolean;
    deviationFromBaseline: {
      claimVolumeRatio: string;
      reimbursementRatio: string;
      avgClaimRatio: string;
    };
  };
  riskIndicators: RiskIndicator[];
  deceasedClaimsAnalysis: {
    count: number;
    totalAmount: number;
    claims: Array<{
      claimId: string;
      beneficiaryId: string;
      dateOfDeath: string;
      claimDate: string;
      amount: number;
    }>;
  };
  networkAnalysis: {
    similarProvidersFound: number;
    flaggedSimilarProviders: number;
    potentialRingMembers: RingMember[];
    sharedPatterns: string[];
  };
  recommendedActions: string[];
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<InvestigateProviderResult>> {
  const { providerId } = args;
  const investigationDate = new Date().toISOString();

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    return {
      success: false,
      error: `Provider not found: ${providerId}`,
    };
  }

  const benchmarks = await getProviderBenchmarks();

  const claimStats = await prisma.claim.aggregate({
    where: { providerId },
    _avg: { reimbursementAmount: true },
    _count: true,
  });

  const claimVolumeRatio = benchmarks.baselineClaimVolume > 0
    ? provider.totalClaims / benchmarks.baselineClaimVolume
    : 0;
  const reimbursementRatio = benchmarks.baselineReimbursement > 0
    ? provider.totalReimbursement / benchmarks.baselineReimbursement
    : 0;
  const avgClaimRatio = benchmarks.baselineClaimAmount > 0 && claimStats._avg.reimbursementAmount
    ? claimStats._avg.reimbursementAmount / benchmarks.baselineClaimAmount
    : 0;

  const deceasedClaims = await prisma.$queryRaw<DeceasedClaimRow[]>`
    SELECT
      c.id as "claimId",
      c."providerId",
      c."beneficiaryId",
      b."dateOfDeath",
      c."claimStartDate",
      c."reimbursementAmount"
    FROM "Claim" c
    JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
    WHERE c."providerId" = ${providerId}
      AND b."dateOfDeath" IS NOT NULL
      AND c."claimStartDate" > b."dateOfDeath"
    ORDER BY c."reimbursementAmount" DESC
    LIMIT 10
  `;

  const deceasedClaimCount = deceasedClaims.length;
  const deceasedClaimTotal = deceasedClaims.reduce(
    (sum, c) => sum + c.reimbursementAmount,
    0
  );

  const SIMILARITY_TOLERANCE = 0.3;
  const claimLower = provider.totalClaims * (1 - SIMILARITY_TOLERANCE);
  const claimUpper = provider.totalClaims * (1 + SIMILARITY_TOLERANCE);
  const reimbursementLower = provider.totalReimbursement * (1 - SIMILARITY_TOLERANCE);
  const reimbursementUpper = provider.totalReimbursement * (1 + SIMILARITY_TOLERANCE);

  const similarProviders = await prisma.provider.findMany({
    where: {
      id: { not: providerId },
      totalClaims: { gte: claimLower, lte: claimUpper },
      totalReimbursement: { gte: reimbursementLower, lte: reimbursementUpper },
    },
    take: 20,
  });

  const potentialRingMembers = similarProviders
    .filter((p: Provider) => p.potentialFraud)
    .map((p: Provider) => {
      const claimDiff = Math.abs(p.totalClaims - provider.totalClaims) / provider.totalClaims;
      const reimbursementDiff = Math.abs(p.totalReimbursement - provider.totalReimbursement) / provider.totalReimbursement;
      const similarity = (1 - (claimDiff + reimbursementDiff) / 2) * 100;

      return {
        providerId: p.id,
        similarityPercent: Math.round(similarity),
        totalClaims: p.totalClaims,
        totalReimbursement: p.totalReimbursement,
      };
    })
    .sort((a: RingMember, b: RingMember) => b.similarityPercent - a.similarityPercent)
    .slice(0, 5);

  const sharedPatterns: string[] = [];
  if (potentialRingMembers.length > 0) {
    sharedPatterns.push("SIMILAR_BILLING_VOLUME");
    sharedPatterns.push("SIMILAR_REIMBURSEMENT_TOTAL");
    if (potentialRingMembers.length >= 3) {
      sharedPatterns.push("POTENTIAL_COORDINATED_ACTIVITY");
    }
  }

  const riskIndicators: RiskIndicator[] = [];

  if (claimVolumeRatio > 2) {
    riskIndicators.push({
      type: "HIGH_CLAIM_VOLUME",
      severity: claimVolumeRatio > 5 ? "critical" : claimVolumeRatio > 3 ? "high" : "medium",
      description: `Claim volume ${(claimVolumeRatio * 100 - 100).toFixed(0)}% above baseline`,
      value: provider.totalClaims,
      threshold: Math.round(benchmarks.baselineClaimVolume),
    });
  }

  if (reimbursementRatio > 2) {
    riskIndicators.push({
      type: "HIGH_REIMBURSEMENT_TOTAL",
      severity: reimbursementRatio > 5 ? "critical" : reimbursementRatio > 3 ? "high" : "medium",
      description: `Total reimbursement ${(reimbursementRatio * 100 - 100).toFixed(0)}% above baseline`,
      value: provider.totalReimbursement,
      threshold: Math.round(benchmarks.baselineReimbursement),
    });
  }

  if (avgClaimRatio > 2) {
    riskIndicators.push({
      type: "HIGH_AVERAGE_CLAIM",
      severity: avgClaimRatio > 3 ? "high" : "medium",
      description: `Average claim amount ${(avgClaimRatio * 100 - 100).toFixed(0)}% above baseline`,
      value: claimStats._avg.reimbursementAmount ?? 0,
      threshold: Math.round(benchmarks.baselineClaimAmount),
    });
  }

  if (deceasedClaimCount > 0) {
    riskIndicators.push({
      type: "DECEASED_BENEFICIARY_CLAIMS",
      severity: "critical",
      description: `${deceasedClaimCount} claims submitted after beneficiary date of death`,
      value: deceasedClaimCount,
      threshold: 0,
    });
  }

  if (potentialRingMembers.length > 0) {
    riskIndicators.push({
      type: "POTENTIAL_FRAUD_RING",
      severity: potentialRingMembers.length >= 3 ? "critical" : "high",
      description: `${potentialRingMembers.length} similar providers also flagged for fraud`,
      value: potentialRingMembers.length,
      threshold: 0,
    });
  }

  let riskScore = 0;
  if (provider.potentialFraud) riskScore += 30;
  if (claimVolumeRatio > 5) riskScore += 25;
  else if (claimVolumeRatio > 3) riskScore += 15;
  else if (claimVolumeRatio > 2) riskScore += 10;

  if (reimbursementRatio > 5) riskScore += 25;
  else if (reimbursementRatio > 3) riskScore += 15;
  else if (reimbursementRatio > 2) riskScore += 10;

  if (deceasedClaimCount > 0) riskScore += 30;
  if (potentialRingMembers.length > 0) riskScore += 15;

  riskScore = Math.min(riskScore, 100);

  let overallRiskLevel: RiskLevel;
  if (riskScore >= 70) overallRiskLevel = "critical";
  else if (riskScore >= 50) overallRiskLevel = "high";
  else if (riskScore >= 30) overallRiskLevel = "medium";
  else overallRiskLevel = "low";

  const confidenceScore = Math.min(
    95,
    60 + (claimStats._count > 10 ? 15 : 0) + (similarProviders.length > 5 ? 10 : 0) + (riskIndicators.length > 0 ? 10 : 0)
  );

  const summaryParts: string[] = [];

  summaryParts.push(
    `Provider ${providerId} shows ${overallRiskLevel} risk indicators with claims ${claimVolumeRatio.toFixed(1)}x above baseline and $${provider.totalReimbursement.toLocaleString()} in total reimbursements.`
  );

  if (deceasedClaimCount > 0) {
    summaryParts.push(
      `Most concerning: ${deceasedClaimCount} claim${deceasedClaimCount > 1 ? "s were" : " was"} submitted after beneficiary death date${deceasedClaimCount > 1 ? "s" : ""}, totaling $${deceasedClaimTotal.toLocaleString()}.`
    );
  }

  if (potentialRingMembers.length > 0) {
    summaryParts.push(
      `Additionally, ${potentialRingMembers.length} similar provider${potentialRingMembers.length > 1 ? "s are" : " is"} also flagged for fraud, suggesting possible coordinated activity.`
    );
  }

  const actionWord = overallRiskLevel === "critical" ? "immediate" : overallRiskLevel === "high" ? "priority" : "standard";
  summaryParts.push(`Recommend ${actionWord} review.`);

  const summary = summaryParts.join(" ");

  const recommendedActions: string[] = [];

  if (deceasedClaimCount > 0) {
    recommendedActions.push(
      `Review ${deceasedClaimCount} claim${deceasedClaimCount > 1 ? "s" : ""} submitted after beneficiary death (total: $${deceasedClaimTotal.toLocaleString()})`
    );
  }

  if (potentialRingMembers.length > 0 && potentialRingMembers[0]) {
    const topMatch = potentialRingMembers[0];
    recommendedActions.push(
      `Investigate connection to ${topMatch.providerId} (also flagged, ${topMatch.similarityPercent}% similarity)`
    );
  }

  if (claimVolumeRatio > 3) {
    recommendedActions.push(
      `Audit claim volume: ${provider.totalClaims} claims is ${claimVolumeRatio.toFixed(1)}x the expected baseline`
    );
  }

  if (reimbursementRatio > 3) {
    recommendedActions.push(
      `Review reimbursement patterns: $${provider.totalReimbursement.toLocaleString()} is ${reimbursementRatio.toFixed(1)}x above baseline`
    );
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Continue standard monitoring - no immediate action required");
  }

  return {
    success: true,
    data: {
      providerId,
      investigationDate,
      overallRiskLevel,
      confidenceScore,
      summary,
      providerProfile: {
        totalClaims: provider.totalClaims,
        totalReimbursement: provider.totalReimbursement,
        avgClaimAmount: claimStats._avg.reimbursementAmount ?? 0,
        flaggedForFraud: provider.potentialFraud,
        deviationFromBaseline: {
          claimVolumeRatio: claimVolumeRatio.toFixed(2),
          reimbursementRatio: reimbursementRatio.toFixed(2),
          avgClaimRatio: avgClaimRatio.toFixed(2),
        },
      },
      riskIndicators,
      deceasedClaimsAnalysis: {
        count: deceasedClaimCount,
        totalAmount: deceasedClaimTotal,
        claims: deceasedClaims.slice(0, 5).map((c) => ({
          claimId: c.claimId,
          beneficiaryId: c.beneficiaryId,
          dateOfDeath: c.dateOfDeath.toISOString().split("T")[0] ?? "",
          claimDate: c.claimStartDate.toISOString().split("T")[0] ?? "",
          amount: c.reimbursementAmount,
        })),
      },
      networkAnalysis: {
        similarProvidersFound: similarProviders.length,
        flaggedSimilarProviders: potentialRingMembers.length,
        potentialRingMembers,
        sharedPatterns,
      },
      recommendedActions,
    },
  };
}
