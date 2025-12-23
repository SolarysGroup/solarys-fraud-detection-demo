-- Enable pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create provider embeddings table for semantic similarity search
CREATE TABLE "ProviderEmbedding" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerId" TEXT NOT NULL UNIQUE REFERENCES "Provider"("id") ON DELETE CASCADE,
  "embedding" vector(1536),
  "profileText" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create IVFFlat index for fast approximate nearest neighbor search
-- Using cosine distance for semantic similarity
CREATE INDEX provider_embedding_idx ON "ProviderEmbedding"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for fast provider lookups
CREATE INDEX provider_embedding_provider_idx ON "ProviderEmbedding" ("providerId");
