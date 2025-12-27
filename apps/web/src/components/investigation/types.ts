export interface Provider {
  id: string;
  totalReimbursement: number;
  baselineMultiplier: number;
  claimsCount: number;
  claimsBaselineMultiplier: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  investigated: boolean;
}

export interface FraudRingMember {
  id: string;
  similarity: number;
  totalReimbursement: number;
  baselineMultiplier: number;
}

export interface InvestigationResult {
  providerId: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskScore: number;
  riskPercentile: number;
  confidence: number;
  totalClaims: number;
  claimsBaselineMultiplier: number;
  totalReimbursements: number;
  reimbursementBaselineMultiplier: number;
  averageClaimAmount: number;
  summary: string;
  fraudRing: FraudRingMember[];
  fraudRingTotal: number;
  fraudRingClaimsTotal: number;
  redFlags: string[];
  recommendations: string[];
  protocolSteps: ProtocolStep[];
}

export interface ProtocolStep {
  agent: "detection" | "investigation";
  tool: string;
  duration: number;
}

export interface ToolCall {
  id: string;
  name: string;
  agent: "detection" | "investigation";
  status: "running" | "success" | "error";
  duration?: number;
  startTime: Date;
}

export interface ThinkingEntry {
  id: string;
  agent: "detection" | "investigation";
  text: string;
  timestamp: Date;
}
