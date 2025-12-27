import type { Provider, InvestigationResult } from "./types";

// Real data from the fraud detection system
// Baseline: Average provider bills ~$102,873 with 103 claims

export const HIGH_RISK_PROVIDERS: Provider[] = [
  {
    id: "PRV52019",
    totalReimbursement: 5996050,
    baselineMultiplier: 58.3,
    claimsCount: 1961,
    claimsBaselineMultiplier: 19,
    riskLevel: "critical",
    investigated: false,
  },
  {
    id: "PRV55462",
    totalReimbursement: 4713830,
    baselineMultiplier: 45.8,
    claimsCount: 1907,
    claimsBaselineMultiplier: 18.5,
    riskLevel: "critical",
    investigated: false,
  },
  {
    id: "PRV56560",
    totalReimbursement: 3212000,
    baselineMultiplier: 31.2,
    claimsCount: 2313,
    claimsBaselineMultiplier: 22.4,
    riskLevel: "critical",
    investigated: false,
  },
  {
    id: "PRV54367",
    totalReimbursement: 3133880,
    baselineMultiplier: 30.5,
    claimsCount: 636,
    claimsBaselineMultiplier: 6.2,
    riskLevel: "critical",
    investigated: false,
  },
  {
    id: "PRV54742",
    totalReimbursement: 2969530,
    baselineMultiplier: 28.9,
    claimsCount: 1892,
    claimsBaselineMultiplier: 18.3,
    riskLevel: "critical",
    investigated: true,
  },
];

// Pre-loaded investigation result for PRV54742
export const PRELOADED_INVESTIGATION: InvestigationResult = {
  providerId: "PRV54742",
  riskLevel: "critical",
  riskScore: 80,
  riskPercentile: 99,
  confidence: 85,
  totalClaims: 1892,
  claimsBaselineMultiplier: 18.3,
  totalReimbursements: 2969530,
  reimbursementBaselineMultiplier: 28.9,
  averageClaimAmount: 1570,
  summary:
    "PRV54742 is involved in a critical fraud ring with five other providers showing suspiciously similar billing patterns. Combined fraudulent activity across the ring exceeds $15.84 million across 9,655 claims.",
  fraudRing: [
    {
      id: "PRV52340",
      similarity: 89,
      totalReimbursement: 2540000,
      baselineMultiplier: 16.9,
    },
    {
      id: "PRV56416",
      similarity: 88,
      totalReimbursement: 2740000,
      baselineMultiplier: 15.4,
    },
    {
      id: "PRV56560",
      similarity: 85,
      totalReimbursement: 3210000,
      baselineMultiplier: 22.4,
    },
    {
      id: "PRV57191",
      similarity: 80,
      totalReimbursement: 2420000,
      baselineMultiplier: 14.5,
    },
    {
      id: "PRV51244",
      similarity: 74,
      totalReimbursement: 2150000,
      baselineMultiplier: 13.7,
    },
  ],
  fraudRingTotal: 15840000,
  fraudRingClaimsTotal: 9655,
  redFlags: [
    "All 6 providers show claim volumes 13-22x above system baseline",
    "All providers flagged for historical fraud patterns",
    "Shared billing patterns indicate coordinated activity",
    "No deceased beneficiary claims found (unusual for high-volume providers)",
  ],
  recommendations: [
    "Freeze all payments to these 6 providers pending investigation",
    "Conduct full claim audits for all submissions",
    "Investigate provider relationships - shared addresses, staff, financial connections",
    "Review patient records for billing irregularities",
    "Initiate legal proceedings for fund recovery",
  ],
  protocolSteps: [
    { agent: "detection", tool: "Get Provider Details", duration: 750 },
    { agent: "detection", tool: "Delegate Investigation", duration: 9115 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
    { agent: "investigation", tool: "Explain Risk Score", duration: 661 },
    { agent: "investigation", tool: "Search Similar Providers", duration: 1343 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
    { agent: "investigation", tool: "Investigate Provider", duration: 252 },
  ],
};

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}
