import { z } from "zod";
import { prisma } from "@solarys/db";
import type { ToolDefinition, RiskLevel, ToolResult } from "../lib/types.js";

export const schema = z.object({
  minSharedBeneficiaries: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .describe("Minimum shared beneficiaries to flag as potential ring (default: 10)"),
});

export const definition: ToolDefinition = {
  name: "detect_fraud_rings",
  description:
    "Find clusters of providers who share an unusually high number of beneficiaries - a key indicator of coordinated fraud. Groups connected providers into rings and calculates risk metrics.",
  inputSchema: {
    type: "object",
    properties: {
      minSharedBeneficiaries: {
        type: "number",
        description: "Minimum shared beneficiaries to flag as potential ring (default: 10)",
        minimum: 1,
        maximum: 100,
      },
    },
    required: [],
  },
};

interface ProviderPair {
  providerId1: string;
  providerId2: string;
  sharedCount: bigint;
}

interface ProviderInfo {
  id: string;
  potentialFraud: boolean;
  totalClaims: number;
  totalReimbursement: number;
}

interface RingMember {
  providerId: string;
  flaggedForFraud: boolean;
  totalClaims: number;
  totalReimbursement: number;
}

interface FraudRing {
  ringId: string;
  memberCount: number;
  members: RingMember[];
  sharedBeneficiaryCount: number;
  flaggedMemberCount: number;
  flaggedMemberRate: number;
  combinedReimbursement: number;
  riskLevel: RiskLevel;
  analysis: string;
}

export interface DetectFraudRingsResult {
  minSharedBeneficiaries: number;
  ringsDetected: number;
  rings: FraudRing[];
  summary: string;
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<DetectFraudRingsResult>> {
  const minSharedBeneficiaries = args.minSharedBeneficiaries ?? 10;

  const providerPairs = await prisma.$queryRaw<ProviderPair[]>`
    SELECT
      c1."providerId" as "providerId1",
      c2."providerId" as "providerId2",
      COUNT(DISTINCT c1."beneficiaryId") as "sharedCount"
    FROM "Claim" c1
    JOIN "Claim" c2 ON c1."beneficiaryId" = c2."beneficiaryId"
      AND c1."providerId" < c2."providerId"
    GROUP BY c1."providerId", c2."providerId"
    HAVING COUNT(DISTINCT c1."beneficiaryId") >= ${minSharedBeneficiaries}
    ORDER BY "sharedCount" DESC
    LIMIT 500
  `;

  if (providerPairs.length === 0) {
    return {
      success: true,
      data: {
        minSharedBeneficiaries,
        ringsDetected: 0,
        rings: [],
        summary: `No provider pairs found sharing ${minSharedBeneficiaries}+ beneficiaries. Consider lowering the threshold.`,
      },
    };
  }

  const parent: Map<string, string> = new Map();
  const sharedCounts: Map<string, Map<string, number>> = new Map();

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x);
    }
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(x: string, y: string): void {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent.set(px, py);
    }
  }

  for (const pair of providerPairs) {
    union(pair.providerId1, pair.providerId2);

    if (!sharedCounts.has(pair.providerId1)) {
      sharedCounts.set(pair.providerId1, new Map());
    }
    if (!sharedCounts.has(pair.providerId2)) {
      sharedCounts.set(pair.providerId2, new Map());
    }
    sharedCounts.get(pair.providerId1)!.set(pair.providerId2, Number(pair.sharedCount));
    sharedCounts.get(pair.providerId2)!.set(pair.providerId1, Number(pair.sharedCount));
  }

  const ringGroups: Map<string, Set<string>> = new Map();
  for (const providerId of parent.keys()) {
    const root = find(providerId);
    if (!ringGroups.has(root)) {
      ringGroups.set(root, new Set());
    }
    ringGroups.get(root)!.add(providerId);
  }

  const validRings = Array.from(ringGroups.values()).filter((members) => members.size >= 2);

  if (validRings.length === 0) {
    return {
      success: true,
      data: {
        minSharedBeneficiaries,
        ringsDetected: 0,
        rings: [],
        summary: "No fraud rings detected with the current threshold.",
      },
    };
  }

  const allProviderIds = new Set<string>();
  for (const ring of validRings) {
    for (const id of ring) {
      allProviderIds.add(id);
    }
  }

  const providerDetails = await prisma.provider.findMany({
    where: { id: { in: Array.from(allProviderIds) } },
    select: {
      id: true,
      potentialFraud: true,
      totalClaims: true,
      totalReimbursement: true,
    },
  });

  const providerMap = new Map<string, ProviderInfo>();
  for (const p of providerDetails) {
    providerMap.set(p.id, p);
  }

  const rings: FraudRing[] = [];
  let ringIdCounter = 0;

  for (const memberSet of validRings) {
    ringIdCounter++;
    const ringId = `RING_${String(ringIdCounter).padStart(3, "0")}`;
    const memberIds = Array.from(memberSet);

    const members: RingMember[] = memberIds.map((id) => {
      const info = providerMap.get(id);
      return {
        providerId: id,
        flaggedForFraud: info?.potentialFraud ?? false,
        totalClaims: info?.totalClaims ?? 0,
        totalReimbursement: info?.totalReimbursement ?? 0,
      };
    });

    const memberCount = members.length;
    const flaggedMemberCount = members.filter((m) => m.flaggedForFraud).length;
    const flaggedMemberRate = memberCount > 0 ? flaggedMemberCount / memberCount : 0;
    const combinedReimbursement = members.reduce((sum, m) => sum + m.totalReimbursement, 0);

    let totalShared = 0;
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const id1 = memberIds[i];
        const id2 = memberIds[j];
        if (id1 && id2) {
          const shared = sharedCounts.get(id1)?.get(id2) ?? 0;
          totalShared += shared;
        }
      }
    }

    let riskLevel: RiskLevel;
    if (flaggedMemberRate >= 0.5 || (flaggedMemberCount >= 2 && combinedReimbursement > 1000000)) {
      riskLevel = "critical";
    } else if (flaggedMemberRate >= 0.25 || flaggedMemberCount >= 2) {
      riskLevel = "high";
    } else if (flaggedMemberCount >= 1 || memberCount >= 4) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    const analysisParts: string[] = [];
    analysisParts.push(
      `${memberCount} providers share ${totalShared} beneficiaries.`
    );

    if (flaggedMemberCount > 0) {
      analysisParts.push(
        `${flaggedMemberCount} of ${memberCount} (${Math.round(flaggedMemberRate * 100)}%) are already flagged for fraud.`
      );
    }

    analysisParts.push(
      `Combined reimbursement of $${combinedReimbursement.toLocaleString()}.`
    );

    if (riskLevel === "critical" || riskLevel === "high") {
      analysisParts.push("Pattern strongly suggests coordinated billing activity.");
    } else if (riskLevel === "medium") {
      analysisParts.push("Pattern warrants further investigation.");
    }

    members.sort((a, b) => b.totalReimbursement - a.totalReimbursement);

    rings.push({
      ringId,
      memberCount,
      members,
      sharedBeneficiaryCount: totalShared,
      flaggedMemberCount,
      flaggedMemberRate: parseFloat(flaggedMemberRate.toFixed(2)),
      combinedReimbursement,
      riskLevel,
      analysis: analysisParts.join(" "),
    });
  }

  const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  rings.sort((a, b) => {
    const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.combinedReimbursement - a.combinedReimbursement;
  });

  const totalProviders = new Set(rings.flatMap((r) => r.members.map((m) => m.providerId))).size;
  const totalReimbursement = rings.reduce((sum, r) => sum + r.combinedReimbursement, 0);
  const criticalRings = rings.filter((r) => r.riskLevel === "critical").length;
  const highRings = rings.filter((r) => r.riskLevel === "high").length;

  let summary = `Detected ${rings.length} potential fraud ring${rings.length !== 1 ? "s" : ""} involving ${totalProviders} providers and $${totalReimbursement.toLocaleString()} in combined reimbursements.`;

  if (criticalRings > 0 || highRings > 0) {
    summary += ` ${criticalRings} critical and ${highRings} high-risk rings require immediate attention.`;
  }

  return {
    success: true,
    data: {
      minSharedBeneficiaries,
      ringsDetected: rings.length,
      rings,
      summary,
    },
  };
}
