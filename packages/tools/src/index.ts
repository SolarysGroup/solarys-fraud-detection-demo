// Export all handlers
export * from "./handlers/index.js";

// Export lib utilities
export { logToolCall, getRecentLogs, getTotalLogCount, clearLogs } from "./lib/auditLog.js";
export type { AuditLogEntry } from "./lib/auditLog.js";

export { getProviderBenchmarks } from "./lib/providerBenchmarks.js";

export {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateProviderProfile,
  formatEmbeddingForPostgres,
} from "./lib/embeddingService.js";
export type { ProviderClaimStats } from "./lib/embeddingService.js";

// Export types
export type {
  ToolDefinition,
  ProviderBenchmarks,
  RiskIndicator,
  DeceasedClaimRow,
  RiskLevel,
  ToolResult,
  ToolHandler,
} from "./lib/types.js";

// Convenience array of all tools for iteration
import * as getProviderStats from "./handlers/getProviderStats.js";
import * as findAnomalies from "./handlers/findAnomalies.js";
import * as checkDeceasedClaims from "./handlers/checkDeceasedClaims.js";
import * as searchSimilarProviders from "./handlers/searchSimilarProviders.js";
import * as investigateProvider from "./handlers/investigateProvider.js";
import * as explainRiskScore from "./handlers/explainRiskScore.js";
import * as detectFraudRings from "./handlers/detectFraudRings.js";
import * as searchFraudPatterns from "./handlers/searchFraudPatterns.js";
import * as getAuditLog from "./handlers/getAuditLog.js";

export const tools = [
  // Core analysis tools
  getProviderStats,
  findAnomalies,
  checkDeceasedClaims,
  searchSimilarProviders,
  // High-level investigation tools
  investigateProvider,
  explainRiskScore,
  // Network & pattern analysis
  detectFraudRings,
  searchFraudPatterns,
  // Compliance & audit
  getAuditLog,
] as const;

export type ToolName = (typeof tools)[number]["definition"]["name"];
