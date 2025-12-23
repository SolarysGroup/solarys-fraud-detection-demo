#!/usr/bin/env npx tsx
/**
 * Script to generate embeddings for all providers.
 * Run with: npm run generate-embeddings
 *
 * Prerequisites:
 * - OPENAI_API_KEY environment variable set
 * - pgVector extension enabled in database
 * - ProviderEmbedding table created
 */

import { prisma } from "@solarys/db";
import {
  generateEmbedding,
  generateProviderProfile,
  formatEmbeddingForPostgres,
  type ProviderClaimStats,
} from "../src/lib/embeddingService.js";

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 500;

interface ProviderWithStats {
  id: string;
  totalClaims: number;
  totalReimbursement: number;
  potentialFraud: boolean;
}

interface DiagnosisCodeCount {
  code: string;
  count: bigint;
}

interface ProcedureCodeCount {
  code: string;
  count: bigint;
}

interface ClaimAggregates {
  avgClaimAmount: number | null;
  inpatientCount: bigint;
  outpatientCount: bigint;
  uniqueBeneficiaries: bigint;
}

interface ChronicRate {
  chronicRate: number | null;
}

async function getProviderClaimStats(providerId: string): Promise<ProviderClaimStats> {
  // Get basic claim aggregates
  const aggregates = await prisma.$queryRaw<ClaimAggregates[]>`
    SELECT
      AVG("reimbursementAmount") as "avgClaimAmount",
      COUNT(*) FILTER (WHERE "isInpatient" = true) as "inpatientCount",
      COUNT(*) FILTER (WHERE "isInpatient" = false) as "outpatientCount",
      COUNT(DISTINCT "beneficiaryId") as "uniqueBeneficiaries"
    FROM "Claim"
    WHERE "providerId" = ${providerId}
  `;

  const agg = aggregates[0] ?? {
    avgClaimAmount: 0,
    inpatientCount: BigInt(0),
    outpatientCount: BigInt(0),
    uniqueBeneficiaries: BigInt(0),
  };

  // Get top diagnosis codes (from JSON array field)
  const topDiagnosis = await prisma.$queryRaw<DiagnosisCodeCount[]>`
    SELECT code, COUNT(*) as count
    FROM "Claim",
    LATERAL jsonb_array_elements_text("diagnosisCodes"::jsonb) as code
    WHERE "providerId" = ${providerId}
      AND code IS NOT NULL
      AND code != ''
    GROUP BY code
    ORDER BY count DESC
    LIMIT 5
  `;

  // Get top procedure codes (from JSON array field)
  const topProcedures = await prisma.$queryRaw<ProcedureCodeCount[]>`
    SELECT code, COUNT(*) as count
    FROM "Claim",
    LATERAL jsonb_array_elements_text("procedureCodes"::jsonb) as code
    WHERE "providerId" = ${providerId}
      AND code IS NOT NULL
      AND code != ''
    GROUP BY code
    ORDER BY count DESC
    LIMIT 5
  `;

  // Get chronic condition rate among patients
  const chronicResult = await prisma.$queryRaw<ChronicRate[]>`
    SELECT
      AVG(
        CASE WHEN (
          b."chronicAlzheimer" OR b."chronicHeartFailure" OR b."chronicKidneyDisease" OR
          b."chronicCancer" OR b."chronicObstructivePulm" OR b."chronicDepression" OR
          b."chronicDiabetes" OR b."chronicIschemicHeart" OR b."chronicOsteoporosis" OR
          b."chronicRheumatoidArthritis" OR b."chronicStroke"
        ) THEN 1.0 ELSE 0.0 END
      ) as "chronicRate"
    FROM "Claim" c
    JOIN "Beneficiary" b ON c."beneficiaryId" = b.id
    WHERE c."providerId" = ${providerId}
  `;

  const chronicRate = chronicResult[0]?.chronicRate ?? 0;

  // Get total reimbursement for this provider
  const reimbursement = await prisma.claim.aggregate({
    where: { providerId },
    _sum: { reimbursementAmount: true },
  });

  return {
    avgClaimAmount: agg.avgClaimAmount ?? 0,
    inpatientCount: Number(agg.inpatientCount),
    outpatientCount: Number(agg.outpatientCount),
    uniqueBeneficiaries: Number(agg.uniqueBeneficiaries),
    topDiagnosisCodes: topDiagnosis.map((d) => d.code),
    topProcedureCodes: topProcedures.map((p) => p.code),
    chronicPatientRate: chronicRate ?? 0,
    totalReimbursement: reimbursement._sum.reimbursementAmount ?? 0,
  };
}

async function storeEmbedding(
  providerId: string,
  embedding: number[],
  profileText: string
): Promise<void> {
  const embeddingStr = formatEmbeddingForPostgres(embedding);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "ProviderEmbedding" ("providerId", "embedding", "profileText")
    VALUES ($1, $2::vector, $3)
    ON CONFLICT ("providerId") DO UPDATE SET
      embedding = $2::vector,
      "profileText" = $3,
      "updatedAt" = CURRENT_TIMESTAMP
  `, providerId, embeddingStr, profileText);
}

async function main() {
  console.log("🚀 Starting provider embedding generation...\n");

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Get all providers
  const providers = await prisma.provider.findMany({
    select: {
      id: true,
      totalClaims: true,
      totalReimbursement: true,
      potentialFraud: true,
    },
    orderBy: { totalReimbursement: "desc" },
  });

  console.log(`📊 Found ${providers.length} providers to process\n`);

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < providers.length; i += BATCH_SIZE) {
    const batch = providers.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(providers.length / BATCH_SIZE);

    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches}...`);

    for (const provider of batch) {
      try {
        // Get claim statistics
        const claimStats = await getProviderClaimStats(provider.id);

        // Generate profile text
        const profileText = generateProviderProfile(provider, claimStats);

        // Generate embedding
        const embedding = await generateEmbedding(profileText);

        // Store in database
        await storeEmbedding(provider.id, embedding, profileText);

        processed++;
        process.stdout.write(`  ✓ ${provider.id} (${processed}/${providers.length})\n`);
      } catch (error) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${provider.id}: ${errorMessage}`);
      }
    }

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < providers.length) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log("✅ Embedding generation complete!");
  console.log(`   Processed: ${processed}/${providers.length}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Duration: ${duration}s`);
  console.log("=".repeat(50) + "\n");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
