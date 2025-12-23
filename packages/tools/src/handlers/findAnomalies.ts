import { z } from "zod";
import { prisma, type Provider } from "@solarys/db";
import { getProviderBenchmarks } from "../lib/providerBenchmarks.js";
import type { ToolDefinition, ToolResult } from "../lib/types.js";

export const schema = z.object({
  threshold: z
    .number()
    .min(0)
    .max(1)
    .describe("Anomaly detection threshold (0-1, lower = more sensitive)"),
});

export const definition: ToolDefinition = {
  name: "find_anomalies",
  description:
    "Detect anomalies in claims data based on statistical analysis. Returns a list of detected anomalies with severity levels and descriptions.",
  inputSchema: {
    type: "object",
    properties: {
      threshold: {
        type: "number",
        description: "Anomaly detection threshold (0-1, lower = more sensitive)",
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["threshold"],
  },
};

export interface Anomaly {
  anomalyId: string;
  type: string;
  severity: "medium" | "high" | "critical";
  providerId: string;
  flaggedForFraud: boolean;
  description: string;
  detectedAt: string;
  metrics: {
    totalClaims: number;
    totalReimbursement: number;
    claimVolumeDeviation: string;
    reimbursementDeviation: string;
    baselineClaimVolume: number;
    baselineReimbursement: number;
  };
}

export interface FindAnomaliesResult {
  threshold: number;
  deviationMultiplier: string;
  anomaliesDetected: number;
  anomalies: Anomaly[];
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<FindAnomaliesResult>> {
  const { threshold } = args;

  const deviationMultiplier = 2 + threshold * 3;

  const benchmarks = await getProviderBenchmarks();
  const claimThreshold = benchmarks.baselineClaimVolume * deviationMultiplier;
  const reimbursementThreshold = benchmarks.baselineReimbursement * deviationMultiplier;

  const flaggedProviders = await prisma.provider.findMany({
    where: {
      OR: [
        { totalClaims: { gt: claimThreshold } },
        { totalReimbursement: { gt: reimbursementThreshold } },
      ],
    },
    orderBy: { totalReimbursement: "desc" },
    take: 20,
  });

  const anomalies = flaggedProviders.map((provider: Provider) => {
    const claimRatio = provider.totalClaims / benchmarks.baselineClaimVolume;
    const reimbursementRatio = provider.totalReimbursement / benchmarks.baselineReimbursement;
    const maxDeviation = Math.max(claimRatio, reimbursementRatio);

    let severity: "medium" | "high" | "critical";
    if (maxDeviation > 5) severity = "critical";
    else if (maxDeviation > 3) severity = "high";
    else severity = "medium";

    let anomalyType: string;
    let description: string;
    if (claimRatio > reimbursementRatio) {
      anomalyType = "HIGH_CLAIM_VOLUME";
      description = `Claim volume is ${claimRatio.toFixed(1)}x baseline (${provider.totalClaims} vs ${Math.round(benchmarks.baselineClaimVolume)})`;
    } else {
      anomalyType = "HIGH_REIMBURSEMENT_TOTAL";
      description = `Total reimbursement is ${reimbursementRatio.toFixed(1)}x baseline ($${provider.totalReimbursement.toLocaleString()} vs $${Math.round(benchmarks.baselineReimbursement).toLocaleString()})`;
    }

    return {
      anomalyId: `ANOM_${provider.id}`,
      type: anomalyType,
      severity,
      providerId: provider.id,
      flaggedForFraud: provider.potentialFraud,
      description,
      detectedAt: new Date().toISOString(),
      metrics: {
        totalClaims: provider.totalClaims,
        totalReimbursement: provider.totalReimbursement,
        claimVolumeDeviation: claimRatio.toFixed(2),
        reimbursementDeviation: reimbursementRatio.toFixed(2),
        baselineClaimVolume: Math.round(benchmarks.baselineClaimVolume),
        baselineReimbursement: Math.round(benchmarks.baselineReimbursement),
      },
    };
  });

  return {
    success: true,
    data: {
      threshold,
      deviationMultiplier: deviationMultiplier.toFixed(1),
      anomaliesDetected: anomalies.length,
      anomalies,
    },
  };
}
