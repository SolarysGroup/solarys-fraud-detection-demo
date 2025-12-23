import { createReadStream } from "fs";
import { join } from "path";

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse";

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, "../../../data");

// Helper to parse CSV file
async function parseCSV<T>(filename: string): Promise<T[]> {
  const records: T[] = [];
  const parser = createReadStream(join(DATA_DIR, filename)).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  for await (const record of parser) {
    records.push(record as T);
  }

  return records;
}

// Helper to parse date or return null
function parseDate(value: string): Date | null {
  if (!value || value === "NA" || value === "") return null;
  return new Date(value);
}

// Helper to parse number or return default
function parseNumber(value: string, defaultValue = 0): number {
  if (!value || value === "NA" || value === "") return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

// Helper to parse boolean from 1/2 (1 = Yes, 2 = No) or "0"/"Y"
function parseChronicCondition(value: string): boolean {
  return value === "1" || value === "Y";
}

// Helper to parse string or return null
function parseString(value: string): string | null {
  if (!value || value === "NA" || value === "") return null;
  return value;
}

// Collect non-null values into array
function collectCodes(record: Record<string, string>, prefix: string, count: number): string[] {
  const codes: string[] = [];
  for (let i = 1; i <= count; i++) {
    const code = parseString(record[`${prefix}${i}`]);
    if (code) codes.push(code);
  }
  return codes;
}

interface ProviderRow {
  Provider: string;
  PotentialFraud: string;
}

interface BeneficiaryRow {
  BeneID: string;
  DOB: string;
  DOD: string;
  Gender: string;
  Race: string;
  RenalDiseaseIndicator: string;
  State: string;
  County: string;
  NoOfMonths_PartACov: string;
  NoOfMonths_PartBCov: string;
  ChronicCond_Alzheimer: string;
  ChronicCond_Heartfailure: string;
  ChronicCond_KidneyDisease: string;
  ChronicCond_Cancer: string;
  ChronicCond_ObstrPulmonary: string;
  ChronicCond_Depression: string;
  ChronicCond_Diabetes: string;
  ChronicCond_IschemicHeart: string;
  ChronicCond_Osteoporasis: string;
  ChronicCond_rheumatoidarthritis: string;
  ChronicCond_stroke: string;
  IPAnnualReimbursementAmt: string;
  IPAnnualDeductibleAmt: string;
  OPAnnualReimbursementAmt: string;
  OPAnnualDeductibleAmt: string;
}

interface ClaimRow {
  BeneID: string;
  ClaimID: string;
  ClaimStartDt: string;
  ClaimEndDt: string;
  Provider: string;
  InscClaimAmtReimbursed: string;
  AttendingPhysician: string;
  OperatingPhysician: string;
  OtherPhysician: string;
  DeductibleAmtPaid: string;
  ClmAdmitDiagnosisCode: string;
  // Inpatient specific
  AdmissionDt?: string;
  DischargeDt?: string;
  DiagnosisGroupCode?: string;
  // Diagnosis codes 1-10
  ClmDiagnosisCode_1?: string;
  ClmDiagnosisCode_2?: string;
  ClmDiagnosisCode_3?: string;
  ClmDiagnosisCode_4?: string;
  ClmDiagnosisCode_5?: string;
  ClmDiagnosisCode_6?: string;
  ClmDiagnosisCode_7?: string;
  ClmDiagnosisCode_8?: string;
  ClmDiagnosisCode_9?: string;
  ClmDiagnosisCode_10?: string;
  // Procedure codes 1-6
  ClmProcedureCode_1?: string;
  ClmProcedureCode_2?: string;
  ClmProcedureCode_3?: string;
  ClmProcedureCode_4?: string;
  ClmProcedureCode_5?: string;
  ClmProcedureCode_6?: string;
}

async function seedProviders() {
  console.log("Seeding providers...");
  const rows = await parseCSV<ProviderRow>("Train-1542865627584.csv");

  const providers = rows.map((row) => ({
    id: row.Provider,
    potentialFraud: row.PotentialFraud === "Yes",
  }));

  // Batch insert
  const batchSize = 1000;
  for (let i = 0; i < providers.length; i += batchSize) {
    const batch = providers.slice(i, i + batchSize);
    await prisma.provider.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  console.log(`  Inserted ${providers.length} providers`);
}

async function seedBeneficiaries() {
  console.log("Seeding beneficiaries...");
  const rows = await parseCSV<BeneficiaryRow>("Train_Beneficiarydata-1542865627584.csv");

  const batchSize = 1000;
  let count = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      id: row.BeneID,
      dateOfBirth: parseDate(row.DOB) ?? new Date("1900-01-01"),
      dateOfDeath: parseDate(row.DOD),
      gender: parseInt(row.Gender) || 1,
      race: parseInt(row.Race) || null,
      renalDiseaseIndicator: parseChronicCondition(row.RenalDiseaseIndicator),
      state: parseInt(row.State) || 0,
      county: parseInt(row.County) || 0,
      partACovMonths: parseNumber(row.NoOfMonths_PartACov),
      partBCovMonths: parseNumber(row.NoOfMonths_PartBCov),
      chronicAlzheimer: parseChronicCondition(row.ChronicCond_Alzheimer),
      chronicHeartFailure: parseChronicCondition(row.ChronicCond_Heartfailure),
      chronicKidneyDisease: parseChronicCondition(row.ChronicCond_KidneyDisease),
      chronicCancer: parseChronicCondition(row.ChronicCond_Cancer),
      chronicObstructivePulm: parseChronicCondition(row.ChronicCond_ObstrPulmonary),
      chronicDepression: parseChronicCondition(row.ChronicCond_Depression),
      chronicDiabetes: parseChronicCondition(row.ChronicCond_Diabetes),
      chronicIschemicHeart: parseChronicCondition(row.ChronicCond_IschemicHeart),
      chronicOsteoporosis: parseChronicCondition(row.ChronicCond_Osteoporasis),
      chronicRheumatoidArthritis: parseChronicCondition(row.ChronicCond_rheumatoidarthritis),
      chronicStroke: parseChronicCondition(row.ChronicCond_stroke),
      ipAnnualReimbursement: parseNumber(row.IPAnnualReimbursementAmt),
      ipAnnualDeductible: parseNumber(row.IPAnnualDeductibleAmt),
      opAnnualReimbursement: parseNumber(row.OPAnnualReimbursementAmt),
      opAnnualDeductible: parseNumber(row.OPAnnualDeductibleAmt),
    }));

    await prisma.beneficiary.createMany({
      data: batch,
      skipDuplicates: true,
    });

    count += batch.length;
    if (count % 10000 === 0) {
      console.log(`  Progress: ${count}/${rows.length}`);
    }
  }

  console.log(`  Inserted ${count} beneficiaries`);
}

async function seedClaims(filename: string, isInpatient: boolean) {
  console.log(`Seeding ${isInpatient ? "inpatient" : "outpatient"} claims from ${filename}...`);
  const rows = await parseCSV<ClaimRow>(filename);

  // Get existing provider and beneficiary IDs for validation
  const existingProviders = new Set(
    (await prisma.provider.findMany({ select: { id: true } })).map((p) => p.id)
  );
  const existingBeneficiaries = new Set(
    (await prisma.beneficiary.findMany({ select: { id: true } })).map((b) => b.id)
  );

  const batchSize = 1000;
  let count = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows
      .slice(i, i + batchSize)
      .filter((row) => {
        // Skip if provider or beneficiary doesn't exist
        if (!existingProviders.has(row.Provider) || !existingBeneficiaries.has(row.BeneID)) {
          skipped++;
          return false;
        }
        return true;
      })
      .map((row) => ({
        id: row.ClaimID,
        providerId: row.Provider,
        beneficiaryId: row.BeneID,
        claimStartDate: parseDate(row.ClaimStartDt) ?? new Date(),
        claimEndDate: parseDate(row.ClaimEndDt) ?? new Date(),
        isInpatient,
        reimbursementAmount: parseNumber(row.InscClaimAmtReimbursed),
        deductiblePaid: parseNumber(row.DeductibleAmtPaid),
        admissionDate: isInpatient ? parseDate(row.AdmissionDt ?? "") : null,
        dischargeDate: isInpatient ? parseDate(row.DischargeDt ?? "") : null,
        admitDiagnosisCode: parseString(row.ClmAdmitDiagnosisCode),
        diagnosisGroupCode: isInpatient ? parseString(row.DiagnosisGroupCode ?? "") : null,
        attendingPhysician: parseString(row.AttendingPhysician),
        operatingPhysician: parseString(row.OperatingPhysician),
        otherPhysician: parseString(row.OtherPhysician),
        diagnosisCodes: collectCodes(row as unknown as Record<string, string>, "ClmDiagnosisCode_", 10),
        procedureCodes: collectCodes(row as unknown as Record<string, string>, "ClmProcedureCode_", 6),
      }));

    if (batch.length > 0) {
      await prisma.claim.createMany({
        data: batch,
        skipDuplicates: true,
      });
      count += batch.length;
    }

    if ((count + skipped) % 50000 === 0) {
      console.log(`  Progress: ${count} inserted, ${skipped} skipped / ${rows.length} total`);
    }
  }

  console.log(`  Inserted ${count} claims (skipped ${skipped} due to missing references)`);
}

async function updateProviderAggregates() {
  console.log("Updating provider aggregates...");

  // Get claim stats per provider
  const stats = await prisma.claim.groupBy({
    by: ["providerId"],
    _count: { id: true },
    _sum: { reimbursementAmount: true },
  });

  const batchSize = 100;
  for (let i = 0; i < stats.length; i += batchSize) {
    const batch = stats.slice(i, i + batchSize);
    await Promise.all(
      batch.map((stat) =>
        prisma.provider.update({
          where: { id: stat.providerId },
          data: {
            totalClaims: stat._count.id,
            totalReimbursement: stat._sum.reimbursementAmount ?? 0,
          },
        })
      )
    );
  }

  console.log(`  Updated ${stats.length} providers`);
}

async function main() {
  console.log("Starting database seed...\n");
  const start = Date.now();

  try {
    // Clear existing data
    console.log("Clearing existing data...");
    await prisma.anomaly.deleteMany();
    await prisma.claim.deleteMany();
    await prisma.beneficiary.deleteMany();
    await prisma.provider.deleteMany();
    console.log("  Done\n");

    // Seed in order (providers and beneficiaries must exist before claims)
    await seedProviders();
    console.log("");

    await seedBeneficiaries();
    console.log("");

    await seedClaims("Train_Inpatientdata-1542865627584.csv", true);
    console.log("");

    await seedClaims("Train_Outpatientdata-1542865627584.csv", false);
    console.log("");

    await updateProviderAggregates();
    console.log("");

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nSeed completed in ${elapsed}s`);

    // Print summary
    const [providerCount, beneficiaryCount, claimCount] = await Promise.all([
      prisma.provider.count(),
      prisma.beneficiary.count(),
      prisma.claim.count(),
    ]);

    const fraudCount = await prisma.provider.count({ where: { potentialFraud: true } });

    console.log("\nDatabase summary:");
    console.log(`  Providers: ${providerCount} (${fraudCount} flagged as potential fraud)`);
    console.log(`  Beneficiaries: ${beneficiaryCount}`);
    console.log(`  Claims: ${claimCount}`);
  } catch (error) {
    console.error("Seed failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
