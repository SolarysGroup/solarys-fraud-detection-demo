import { z } from "zod";
import { getRecentLogs, getTotalLogCount, type AuditLogEntry } from "../lib/auditLog.js";
import type { ToolDefinition, ToolResult } from "../lib/types.js";

export const schema = z.object({
  limit: z
    .number()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of log entries to return (default: 50, max: 200)"),
});

export const definition: ToolDefinition = {
  name: "get_audit_log",
  description:
    "Return a log of recent MCP tool calls for compliance and transparency. Shows timestamp, tool name, inputs, output summary, and execution duration for each call.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of log entries to return (default: 50, max: 200)",
        minimum: 1,
        maximum: 200,
      },
    },
    required: [],
  },
};

export interface GetAuditLogResult {
  totalLogsStored: number;
  logsReturned: number;
  statistics: {
    successCount: number;
    failureCount: number;
    successRate: number;
    averageDurationMs: number;
    toolUsage: Array<{ tool: string; count: number }>;
  };
  logs: AuditLogEntry[];
}

export async function handler(
  args: z.infer<typeof schema>
): Promise<ToolResult<GetAuditLogResult>> {
  const limit = args.limit ?? 50;

  const logs = getRecentLogs(limit);
  const totalLogsStored = getTotalLogCount();

  const toolCounts: Record<string, number> = {};
  let totalDuration = 0;
  let successCount = 0;
  let failureCount = 0;

  for (const log of logs) {
    toolCounts[log.tool] = (toolCounts[log.tool] ?? 0) + 1;
    totalDuration += log.durationMs;
    if (log.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  const avgDuration = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;

  const toolUsage = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => ({ tool, count }));

  return {
    success: true,
    data: {
      totalLogsStored,
      logsReturned: logs.length,
      statistics: {
        successCount,
        failureCount,
        successRate: logs.length > 0 ? parseFloat((successCount / logs.length).toFixed(2)) : 1,
        averageDurationMs: avgDuration,
        toolUsage,
      },
      logs,
    },
  };
}
