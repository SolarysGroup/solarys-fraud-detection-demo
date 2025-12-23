/**
 * In-memory audit log for tool calls.
 * Provides compliance-ready logging of all tool invocations.
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  outputSummary: string;
  durationMs: number;
  success: boolean;
}

// In-memory storage with max capacity
const MAX_LOG_ENTRIES = 1000;
const auditLogs: AuditLogEntry[] = [];
let logCounter = 0;

/**
 * Generate a unique log ID
 */
function generateLogId(): string {
  logCounter++;
  return `LOG_${String(logCounter).padStart(6, "0")}`;
}

/**
 * Extract a short summary from tool output for logging
 */
function extractOutputSummary(output: unknown, maxLength = 200): string {
  if (!output) return "No output";

  try {
    if (typeof output === "string") {
      const parsed = JSON.parse(output);
      return extractSummaryFromObject(parsed, maxLength);
    }

    if (typeof output === "object" && output !== null) {
      return extractSummaryFromObject(output as Record<string, unknown>, maxLength);
    }

    return truncate(String(output), maxLength);
  } catch {
    return truncate(String(output), maxLength);
  }
}

/**
 * Extract key fields from an object for summary
 */
function extractSummaryFromObject(obj: Record<string, unknown>, maxLength: number): string {
  const summaryParts: string[] = [];

  const priorityFields = [
    "summary",
    "overallRiskLevel",
    "currentRiskLevel",
    "riskLevel",
    "anomaliesDetected",
    "anomaliesFound",
    "totalDeceasedClaims",
    "matchesFound",
    "similarProvidersFound",
    "ringsDetected",
    "error",
  ];

  for (const field of priorityFields) {
    if (field in obj && obj[field] !== undefined) {
      const value = obj[field];
      if (typeof value === "string") {
        summaryParts.push(`${field}: ${value}`);
      } else if (typeof value === "number" || typeof value === "boolean") {
        summaryParts.push(`${field}: ${value}`);
      }
    }
  }

  if (summaryParts.length > 0) {
    return truncate(summaryParts.join(". "), maxLength);
  }

  const keys = Object.keys(obj).slice(0, 3);
  return truncate(`Keys: ${keys.join(", ")}`, maxLength);
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Log a tool call to the audit log
 */
export function logToolCall(
  tool: string,
  input: Record<string, unknown>,
  output: unknown,
  durationMs: number,
  success: boolean = true
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    tool,
    input,
    outputSummary: extractOutputSummary(output),
    durationMs,
    success,
  };

  auditLogs.unshift(entry);

  if (auditLogs.length > MAX_LOG_ENTRIES) {
    auditLogs.pop();
  }

  return entry;
}

/**
 * Get recent audit log entries
 */
export function getRecentLogs(limit: number = 50): AuditLogEntry[] {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  return auditLogs.slice(0, safeLimit);
}

/**
 * Get total number of logs stored
 */
export function getTotalLogCount(): number {
  return auditLogs.length;
}

/**
 * Clear all logs (for testing)
 */
export function clearLogs(): void {
  auditLogs.length = 0;
  logCounter = 0;
}
