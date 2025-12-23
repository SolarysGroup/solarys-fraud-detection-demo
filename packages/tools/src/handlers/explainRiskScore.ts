import { z } from "zod";
import { prisma } from "@solarys/db";
import { getProviderBenchmarks } from "../lib/providerBenchmarks.js";
import type { ToolDefinition, RiskLevel, ToolResult } from "../lib/types.js";

export const schema = z.object({
  providerId: z.string().describe("The unique identifier of the provider"),
});

export const definition: ToolDefinition = {
  name: "explain_risk_score",
  description:
    "Explain exactly WHY a provider has their risk level in plain English. Returns a detailed breakdown suitable for compliance reports, including factor analysis, percentile comparison, and mitigation recommendations.",
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

interface FactorBreakdown {
  factor: string;
  providerValue: number | string;
  baselineValue: number | string;
  deviation: string;
  contribution: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
}

export interface ExplainRiskScoreResult {
  providerId: string;
  currentRiskLevel: RiskLevel;
  riskScore: number;
  scoreBreakdown: string[];
  explanation: string;
  factorBreakdown: FactorBreakdown[];
  comparisonToFlaggedProviders: {
    percentile: number;
    totalFlaggedProviders: number;
    description: string;
  };
  mitigatingFactors: string[];
  conclusion: string;
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<ExplainRiskScoreResult>> {
  const { providerId } = args;

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

  const deceasedClaimsResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "Claim" c
    JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
    WHERE c."providerId" = ${providerId}
      AND b."dateOfDeath" IS NOT NULL
      AND c."claimStartDate" > b."dateOfDeath"
  `;
  const deceasedClaimCount = Number(deceasedClaimsResult[0]?.count ?? 0);

  let riskScore = 0;
  const scoreBreakdown: string[] = [];

  if (provider.potentialFraud) {
    riskScore += 30;
    scoreBreakdown.push("Historical fraud flag: +30 points");
  }

  if (claimVolumeRatio > 5) {
    riskScore += 25;
    scoreBreakdown.push(`Claim volume >5x baseline: +25 points`);
  } else if (claimVolumeRatio > 3) {
    riskScore += 15;
    scoreBreakdown.push(`Claim volume >3x baseline: +15 points`);
  } else if (claimVolumeRatio > 2) {
    riskScore += 10;
    scoreBreakdown.push(`Claim volume >2x baseline: +10 points`);
  }

  if (reimbursementRatio > 5) {
    riskScore += 25;
    scoreBreakdown.push(`Reimbursement >5x baseline: +25 points`);
  } else if (reimbursementRatio > 3) {
    riskScore += 15;
    scoreBreakdown.push(`Reimbursement >3x baseline: +15 points`);
  } else if (reimbursementRatio > 2) {
    riskScore += 10;
    scoreBreakdown.push(`Reimbursement >2x baseline: +10 points`);
  }

  if (deceasedClaimCount > 0) {
    riskScore += 30;
    scoreBreakdown.push(`Deceased beneficiary claims detected: +30 points`);
  }

  riskScore = Math.min(riskScore, 100);

  let currentRiskLevel: RiskLevel;
  if (riskScore >= 70) currentRiskLevel = "critical";
  else if (riskScore >= 50) currentRiskLevel = "high";
  else if (riskScore >= 30) currentRiskLevel = "medium";
  else currentRiskLevel = "low";

  const factorBreakdown: FactorBreakdown[] = [];

  const claimVolumeContribution: FactorBreakdown["contribution"] =
    claimVolumeRatio > 5 ? "CRITICAL" : claimVolumeRatio > 3 ? "HIGH" : claimVolumeRatio > 2 ? "MEDIUM" : "LOW";

  factorBreakdown.push({
    factor: "Claim Volume",
    providerValue: provider.totalClaims,
    baselineValue: Math.round(benchmarks.baselineClaimVolume),
    deviation: `${claimVolumeRatio.toFixed(1)}x`,
    contribution: claimVolumeContribution,
    details: claimVolumeRatio > 2
      ? `Provider submitted ${provider.totalClaims} claims compared to the system average of ${Math.round(benchmarks.baselineClaimVolume)} claims. This ${((claimVolumeRatio - 1) * 100).toFixed(0)}% increase ${claimVolumeRatio > 3 ? "is a strong indicator of potential overbilling" : "warrants monitoring"}.`
      : `Provider's claim volume of ${provider.totalClaims} is within normal parameters relative to the baseline of ${Math.round(benchmarks.baselineClaimVolume)}.`,
  });

  const reimbursementContribution: FactorBreakdown["contribution"] =
    reimbursementRatio > 5 ? "CRITICAL" : reimbursementRatio > 3 ? "HIGH" : reimbursementRatio > 2 ? "MEDIUM" : "LOW";

  factorBreakdown.push({
    factor: "Total Reimbursement",
    providerValue: `$${provider.totalReimbursement.toLocaleString()}`,
    baselineValue: `$${Math.round(benchmarks.baselineReimbursement).toLocaleString()}`,
    deviation: `${reimbursementRatio.toFixed(1)}x`,
    contribution: reimbursementContribution,
    details: reimbursementRatio > 2
      ? `Total reimbursements of $${provider.totalReimbursement.toLocaleString()} exceed the baseline of $${Math.round(benchmarks.baselineReimbursement).toLocaleString()} by ${((reimbursementRatio - 1) * 100).toFixed(0)}%. ${reimbursementRatio > 3 ? "This level of financial activity requires immediate scrutiny." : "This deviation should be investigated."}`
      : `Reimbursement total of $${provider.totalReimbursement.toLocaleString()} is within acceptable range of the $${Math.round(benchmarks.baselineReimbursement).toLocaleString()} baseline.`,
  });

  const avgClaimContribution: FactorBreakdown["contribution"] =
    avgClaimRatio > 3 ? "HIGH" : avgClaimRatio > 2 ? "MEDIUM" : "LOW";

  const avgClaimAmount = claimStats._avg.reimbursementAmount ?? 0;
  factorBreakdown.push({
    factor: "Average Claim Amount",
    providerValue: `$${avgClaimAmount.toLocaleString()}`,
    baselineValue: `$${Math.round(benchmarks.baselineClaimAmount).toLocaleString()}`,
    deviation: `${avgClaimRatio.toFixed(1)}x`,
    contribution: avgClaimContribution,
    details: avgClaimRatio > 2
      ? `Average claim of $${avgClaimAmount.toLocaleString()} is ${((avgClaimRatio - 1) * 100).toFixed(0)}% higher than the system average of $${Math.round(benchmarks.baselineClaimAmount).toLocaleString()}. This may indicate upcoding or billing for more expensive procedures than typical.`
      : `Average claim amount is within normal parameters.`,
  });

  factorBreakdown.push({
    factor: "Deceased Beneficiary Claims",
    providerValue: deceasedClaimCount,
    baselineValue: 0,
    deviation: deceasedClaimCount > 0 ? "VIOLATION" : "NONE",
    contribution: deceasedClaimCount > 0 ? "CRITICAL" : "LOW",
    details: deceasedClaimCount > 0
      ? `CRITICAL: ${deceasedClaimCount} claim${deceasedClaimCount > 1 ? "s were" : " was"} submitted for beneficiaries after their recorded date of death. This is a primary fraud indicator and requires immediate investigation.`
      : "No claims detected for deceased beneficiaries. This is a positive indicator.",
  });

  factorBreakdown.push({
    factor: "Historical Fraud Flag",
    providerValue: provider.potentialFraud ? "FLAGGED" : "NOT FLAGGED",
    baselineValue: "NOT FLAGGED",
    deviation: provider.potentialFraud ? "FLAGGED" : "NONE",
    contribution: provider.potentialFraud ? "HIGH" : "LOW",
    details: provider.potentialFraud
      ? "This provider has been previously flagged for potential fraud in the system. Historical flags carry significant weight in risk assessment."
      : "No historical fraud flags on record for this provider.",
  });

  const flaggedProviders = await prisma.provider.findMany({
    where: { potentialFraud: true },
    orderBy: { totalReimbursement: "desc" },
  });

  const flaggedCount = flaggedProviders.length;
  const worseThanCount = flaggedProviders.filter(
    (p) => p.totalReimbursement < provider.totalReimbursement
  ).length;
  const percentile = flaggedCount > 0 ? Math.round((worseThanCount / flaggedCount) * 100) : 0;

  const comparisonToFlaggedProviders = {
    percentile,
    totalFlaggedProviders: flaggedCount,
    description: provider.potentialFraud
      ? `This provider ranks in the ${percentile}th percentile among flagged providers, meaning their financial activity exceeds ${percentile}% of all providers previously flagged for fraud.`
      : `While not currently flagged, this provider's metrics ${percentile > 50 ? "exceed" : "are comparable to"} ${percentile}% of providers that have been flagged for fraud.`,
  };

  const mitigatingFactors: string[] = [];

  if (deceasedClaimCount === 0) {
    mitigatingFactors.push("No claims for deceased beneficiaries detected");
  }

  if (claimVolumeRatio <= 2) {
    mitigatingFactors.push("Claim volume within acceptable range of baseline");
  }

  if (avgClaimRatio <= 1.5) {
    mitigatingFactors.push("Average claim amount consistent with system norms");
  }

  if (!provider.potentialFraud) {
    mitigatingFactors.push("No historical fraud flags on record");
  }

  if (mitigatingFactors.length === 0) {
    mitigatingFactors.push("No significant mitigating factors identified");
  }

  const explanationParts: string[] = [];

  explanationParts.push(
    `Provider ${providerId} has been assigned a ${currentRiskLevel.toUpperCase()} risk level with a composite score of ${riskScore}/100.`
  );

  explanationParts.push(
    `This assessment is based on analysis of ${claimStats._count} claims totaling $${provider.totalReimbursement.toLocaleString()} in reimbursements.`
  );

  const criticalFactors = factorBreakdown.filter((f) => f.contribution === "CRITICAL");
  const highFactors = factorBreakdown.filter((f) => f.contribution === "HIGH");

  if (criticalFactors.length > 0) {
    explanationParts.push(
      `CRITICAL factors identified: ${criticalFactors.map((f) => f.factor).join(", ")}.`
    );
  }

  if (highFactors.length > 0) {
    explanationParts.push(
      `HIGH-risk factors identified: ${highFactors.map((f) => f.factor).join(", ")}.`
    );
  }

  explanationParts.push(
    `The provider's claim volume is ${claimVolumeRatio.toFixed(1)}x the system baseline, and total reimbursement is ${reimbursementRatio.toFixed(1)}x the baseline.`
  );

  const explanation = explanationParts.join(" ");

  const conclusionParts: string[] = [];

  if (currentRiskLevel === "critical" || currentRiskLevel === "high") {
    conclusionParts.push(
      `Based on this analysis, Provider ${providerId} exhibits patterns consistent with known fraud cases.`
    );
    if (percentile > 50) {
      conclusionParts.push(
        `The combination of elevated metrics places them in the top ${100 - percentile}% of all flagged providers.`
      );
    }
    conclusionParts.push("Immediate review is recommended.");
  } else if (currentRiskLevel === "medium") {
    conclusionParts.push(
      `Provider ${providerId} shows some elevated metrics but does not meet the threshold for immediate fraud concern.`
    );
    conclusionParts.push("Continued monitoring is advised.");
  } else {
    conclusionParts.push(
      `Provider ${providerId} operates within normal parameters and does not currently warrant fraud investigation.`
    );
    conclusionParts.push("Standard monitoring protocols should continue.");
  }

  const conclusion = conclusionParts.join(" ");

  return {
    success: true,
    data: {
      providerId,
      currentRiskLevel,
      riskScore,
      scoreBreakdown,
      explanation,
      factorBreakdown,
      comparisonToFlaggedProviders,
      mitigatingFactors,
      conclusion,
    },
  };
}
