import { z } from "zod";
import { prisma } from "@solarys/db";
import { getProviderBenchmarks } from "../lib/providerBenchmarks.js";
import type { ToolDefinition, RiskIndicator, ToolResult } from "../lib/types.js";

export const schema = z.object({
  providerId: z.string().describe("The unique identifier of the provider"),
});

export const definition: ToolDefinition = {
  name: "get_provider_stats",
  description:
    "Get detailed statistics and risk indicators for a specific healthcare provider. Returns claim counts, reimbursement totals, and fraud risk indicators.",
  inputSchema: {
    type: "object",
    properties: {
      providerId: {
        type: "string",
        description: "The unique identifier of the provider",
      },
    },
    required: ["providerId"],
  },
};

export interface ProviderStatsResult {
  providerId: string;
  totalClaims: number;
  totalReimbursement: number;
  averageClaimAmount: number;
  riskScore: number;
  potentialFraud: boolean;
  deviationFromBaseline: {
    claimVolumeRatio: string;
    reimbursementRatio: string;
    avgClaimRatio: string;
  };
  riskIndicators: RiskIndicator[];
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<ProviderStatsResult>> {
  const { providerId } = args;

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      _count: {
        select: { claims: true },
      },
    },
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
    _sum: { reimbursementAmount: true },
    _avg: { reimbursementAmount: true },
    _count: true,
  });

  const claimVolumeRatio =
    benchmarks.baselineClaimVolume > 0
      ? provider.totalClaims / benchmarks.baselineClaimVolume
      : 0;
  const reimbursementRatio =
    benchmarks.baselineReimbursement > 0
      ? provider.totalReimbursement / benchmarks.baselineReimbursement
      : 0;
  const avgClaimRatio =
    benchmarks.baselineClaimAmount > 0 && claimStats._avg.reimbursementAmount
      ? claimStats._avg.reimbursementAmount / benchmarks.baselineClaimAmount
      : 0;

  const deceasedClaims = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "Claim" c
    JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
    WHERE c."providerId" = ${providerId}
      AND b."dateOfDeath" IS NOT NULL
      AND c."claimStartDate" > b."dateOfDeath"
  `;
  const deceasedClaimCount = Number(deceasedClaims[0]?.count ?? 0);

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

  let riskScore = 0;
  if (provider.potentialFraud) riskScore += 0.4;
  if (claimVolumeRatio > 3) riskScore += 0.2;
  if (reimbursementRatio > 3) riskScore += 0.2;
  if (deceasedClaimCount > 0) riskScore += 0.2;
  riskScore = Math.min(riskScore, 1);

  return {
    success: true,
    data: {
      providerId: provider.id,
      totalClaims: provider.totalClaims,
      totalReimbursement: provider.totalReimbursement,
      averageClaimAmount: claimStats._avg.reimbursementAmount ?? 0,
      riskScore,
      potentialFraud: provider.potentialFraud,
      deviationFromBaseline: {
        claimVolumeRatio: claimVolumeRatio.toFixed(2),
        reimbursementRatio: reimbursementRatio.toFixed(2),
        avgClaimRatio: avgClaimRatio.toFixed(2),
      },
      riskIndicators,
    },
  };
}
