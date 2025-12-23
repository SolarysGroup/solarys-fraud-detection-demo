import { z } from "zod";

// Tool definition for both MCP and REST API
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Shared data types
export interface ProviderBenchmarks {
  baselineClaimVolume: number;
  baselineReimbursement: number;
  baselineClaimAmount: number;
  calculatedAt: Date;
}

export interface RiskIndicator {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  value: number;
  threshold: number;
}

export interface DeceasedClaimRow {
  claimId: string;
  providerId: string;
  beneficiaryId: string;
  dateOfDeath: Date;
  claimStartDate: Date;
  reimbursementAmount: number;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

// Handler result type (raw data, not MCP format)
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Tool handler type
export interface ToolHandler<TSchema extends z.ZodType, TResult> {
  definition: ToolDefinition;
  schema: TSchema;
  handler: (args: z.infer<TSchema>) => Promise<ToolResult<TResult>>;
}
