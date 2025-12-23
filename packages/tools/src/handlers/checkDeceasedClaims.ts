import { z } from "zod";
import { prisma } from "@solarys/db";
import type { ToolDefinition, DeceasedClaimRow, ToolResult } from "../lib/types.js";

export const schema = z.object({
  providerId: z
    .string()
    .optional()
    .describe("Optional provider ID to filter results"),
});

export const definition: ToolDefinition = {
  name: "check_deceased_claims",
  description:
    "Find claims submitted for beneficiaries after their date of death. This is a common fraud indicator. Optionally filter by provider.",
  inputSchema: {
    type: "object",
    properties: {
      providerId: {
        type: "string",
        description: "Optional provider ID to filter results",
      },
    },
    required: [],
  },
};

export interface DeceasedClaim {
  claimId: string;
  providerId: string;
  beneficiaryId: string;
  dateOfDeath: string;
  claimDate: string;
  daysAfterDeath: number;
  claimAmount: number;
}

export interface CheckDeceasedClaimsResult {
  filterByProvider: string;
  totalDeceasedClaims: number;
  claims: DeceasedClaim[];
  providerBreakdown?: Array<{ providerId: string; claimCount: number }>;
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<CheckDeceasedClaimsResult>> {
  const { providerId } = args;

  let deceasedClaims: DeceasedClaimRow[];

  if (providerId) {
    deceasedClaims = await prisma.$queryRaw<DeceasedClaimRow[]>`
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
      ORDER BY c."claimStartDate" DESC
      LIMIT 50
    `;
  } else {
    deceasedClaims = await prisma.$queryRaw<DeceasedClaimRow[]>`
      SELECT
        c.id as "claimId",
        c."providerId",
        c."beneficiaryId",
        b."dateOfDeath",
        c."claimStartDate",
        c."reimbursementAmount"
      FROM "Claim" c
      JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
      WHERE b."dateOfDeath" IS NOT NULL
        AND c."claimStartDate" > b."dateOfDeath"
      ORDER BY c."claimStartDate" DESC
      LIMIT 50
    `;
  }

  const claims = deceasedClaims.map((claim) => {
    const daysAfterDeath = Math.floor(
      (new Date(claim.claimStartDate).getTime() -
        new Date(claim.dateOfDeath).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      claimId: claim.claimId,
      providerId: claim.providerId,
      beneficiaryId: claim.beneficiaryId,
      dateOfDeath: claim.dateOfDeath.toISOString().split("T")[0] ?? "",
      claimDate: claim.claimStartDate.toISOString().split("T")[0] ?? "",
      daysAfterDeath,
      claimAmount: claim.reimbursementAmount,
    };
  });

  let providerBreakdown: Array<{ providerId: string; claimCount: number }> | undefined;
  if (!providerId && claims.length > 0) {
    const breakdown = await prisma.$queryRaw<
      Array<{ providerId: string; count: bigint }>
    >`
      SELECT c."providerId", COUNT(*) as count
      FROM "Claim" c
      JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
      WHERE b."dateOfDeath" IS NOT NULL
        AND c."claimStartDate" > b."dateOfDeath"
      GROUP BY c."providerId"
      ORDER BY count DESC
      LIMIT 10
    `;
    providerBreakdown = breakdown.map((row) => ({
      providerId: row.providerId,
      claimCount: Number(row.count),
    }));
  }

  return {
    success: true,
    data: {
      filterByProvider: providerId ?? "all",
      totalDeceasedClaims: claims.length,
      claims,
      ...(providerBreakdown && { providerBreakdown }),
    },
  };
}
