import { prisma } from "@solarys/db";
import type { ProviderBenchmarks } from "./types.js";

// Cached baseline metrics for provider comparison
let cachedBenchmarks: ProviderBenchmarks | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves baseline metrics used for provider risk assessment.
 * These benchmarks represent system-wide averages against which
 * individual provider behavior is compared for anomaly detection.
 */
export async function getProviderBenchmarks(): Promise<ProviderBenchmarks> {
  if (
    cachedBenchmarks &&
    Date.now() - cachedBenchmarks.calculatedAt.getTime() < CACHE_TTL_MS
  ) {
    return cachedBenchmarks;
  }

  const [providerStats, claimStats] = await Promise.all([
    prisma.provider.aggregate({
      _avg: {
        totalClaims: true,
        totalReimbursement: true,
      },
    }),
    prisma.claim.aggregate({
      _avg: {
        reimbursementAmount: true,
      },
    }),
  ]);

  cachedBenchmarks = {
    baselineClaimVolume: providerStats._avg.totalClaims ?? 0,
    baselineReimbursement: providerStats._avg.totalReimbursement ?? 0,
    baselineClaimAmount: claimStats._avg.reimbursementAmount ?? 0,
    calculatedAt: new Date(),
  };

  return cachedBenchmarks;
}
