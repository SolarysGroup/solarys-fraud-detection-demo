// Provider types
export interface Provider {
  id: string;
  potentialFraud: boolean;
  riskScore: number | null;
  totalClaims: number;
  totalReimbursement: number;
  createdAt: Date;
  updatedAt: Date;
}

// Beneficiary types
export interface Beneficiary {
  id: string;
  dateOfBirth: Date;
  dateOfDeath: Date | null;
  gender: number;
  race: number | null;
  renalDiseaseIndicator: boolean;
  state: number;
  county: number;
  partACovMonths: number;
  partBCovMonths: number;
  chronicAlzheimer: boolean;
  chronicHeartFailure: boolean;
  chronicKidneyDisease: boolean;
  chronicCancer: boolean;
  chronicObstructivePulm: boolean;
  chronicDepression: boolean;
  chronicDiabetes: boolean;
  chronicIschemicHeart: boolean;
  chronicOsteoporosis: boolean;
  chronicRheumatoidArthritis: boolean;
  chronicStroke: boolean;
  ipAnnualReimbursement: number;
  ipAnnualDeductible: number;
  opAnnualReimbursement: number;
  opAnnualDeductible: number;
  createdAt: Date;
  updatedAt: Date;
}

// Claim types
export interface Claim {
  id: string;
  providerId: string;
  beneficiaryId: string;
  claimStartDate: Date;
  claimEndDate: Date;
  isInpatient: boolean;
  reimbursementAmount: number;
  deductiblePaid: number;
  admissionDate: Date | null;
  dischargeDate: Date | null;
  admitDiagnosisCode: string | null;
  diagnosisGroupCode: string | null;
  attendingPhysician: string | null;
  operatingPhysician: string | null;
  otherPhysician: string | null;
  diagnosisCodes: string[];
  procedureCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Anomaly types
export interface Anomaly {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  providerId: string;
  description: string;
  metrics: Record<string, number>;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface ProviderStats {
  provider: Provider;
  totalClaims: number;
  totalReimbursement: number;
  averageClaimAmount: number;
  claimsPerBeneficiary: number;
  deceasedBeneficiaryClaims: number;
  riskIndicators: RiskIndicator[];
}

export interface RiskIndicator {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  value: number;
  threshold: number;
}

export interface SimilarProvider {
  provider: Provider;
  similarityScore: number;
  commonPatterns: string[];
}

// MCP Tool input/output types
export interface GetProviderStatsInput {
  providerId: string;
}

export interface FindAnomaliesInput {
  threshold: number;
}

export interface CheckDeceasedClaimsInput {
  providerId?: string;
}

export interface SearchSimilarProvidersInput {
  providerId: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
