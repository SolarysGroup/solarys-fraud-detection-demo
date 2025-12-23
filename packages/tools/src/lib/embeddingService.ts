/**
 * Embedding service for semantic provider similarity search.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */

import OpenAI from "openai";

// Lazy-initialized OpenAI client (waits for env vars to be loaded)
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Generate an embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate embedding: no data returned");
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 * OpenAI supports up to 2048 inputs per request.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 20
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

/**
 * Provider claim statistics used for profile generation.
 */
export interface ProviderClaimStats {
  avgClaimAmount: number;
  inpatientCount: number;
  outpatientCount: number;
  topDiagnosisCodes: string[];
  topProcedureCodes: string[];
  chronicPatientRate: number;
  uniqueBeneficiaries: number;
  totalReimbursement: number;
}

/**
 * Generate a natural language profile text for a provider.
 * This text is embedded for semantic similarity search.
 */
export function generateProviderProfile(
  provider: {
    id: string;
    totalClaims: number;
    totalReimbursement: number;
    potentialFraud: boolean;
  },
  claimStats: ProviderClaimStats
): string {
  const totalClaimCount = claimStats.inpatientCount + claimStats.outpatientCount;
  const inpatientPct =
    totalClaimCount > 0
      ? ((claimStats.inpatientCount / totalClaimCount) * 100).toFixed(1)
      : "0.0";
  const outpatientPct =
    totalClaimCount > 0
      ? ((claimStats.outpatientCount / totalClaimCount) * 100).toFixed(1)
      : "0.0";

  const parts: string[] = [];

  parts.push(
    `Provider ${provider.id}: ${provider.totalClaims.toLocaleString()} total claims totaling $${provider.totalReimbursement.toLocaleString()} in reimbursements.`
  );

  parts.push(
    `Average claim amount: $${claimStats.avgClaimAmount.toFixed(2)}.`
  );
  parts.push(
    `Care setting mix: ${inpatientPct}% inpatient, ${outpatientPct}% outpatient.`
  );

  parts.push(
    `Serves ${claimStats.uniqueBeneficiaries.toLocaleString()} unique beneficiaries.`
  );
  if (claimStats.chronicPatientRate > 0) {
    parts.push(
      `${(claimStats.chronicPatientRate * 100).toFixed(1)}% of patients have chronic conditions.`
    );
  }

  if (claimStats.topDiagnosisCodes.length > 0) {
    parts.push(
      `Top diagnosis codes: ${claimStats.topDiagnosisCodes.slice(0, 5).join(", ")}.`
    );
  }
  if (claimStats.topProcedureCodes.length > 0) {
    parts.push(
      `Top procedure codes: ${claimStats.topProcedureCodes.slice(0, 5).join(", ")}.`
    );
  }

  if (provider.potentialFraud) {
    parts.push("FLAGGED FOR POTENTIAL FRAUD.");
  } else {
    parts.push("Not currently flagged for fraud.");
  }

  return parts.join(" ");
}

/**
 * Format embedding array for PostgreSQL vector type.
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
