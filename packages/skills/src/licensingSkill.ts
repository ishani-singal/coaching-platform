import { LicenseTerms, RevenueAllocation } from '@coaching/sdk';
import {
  createModuleLicense,
  getAncestryChain,
  calculateRevenueSplit,
  writeRevenueEvents,
  getLicensesGrantedByCoach,
  getLicensesHeldByCoach,
  getRevenueByCoach,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function licenseModuleToCoach(
  licensorId: string,
  licenseeId: string,
  moduleId: string,
  terms: LicenseTerms
): Promise<void> {
  await createModuleLicense(licensorId, licenseeId, moduleId, terms);
}

export async function computeAndWriteRevenue(enrollmentId: string, priceUsd: number): Promise<RevenueAllocation[]> {
  // Load package → programs → modules for this enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('package_id, installing_coach_id')
    .eq('enrollment_id', enrollmentId)
    .single();

  if (!enrollment) throw new Error('Enrollment not found');

  const { data: programs } = await supabase
    .from('package_programs')
    .select('program_id, programs(program_modules(module_id))')
    .eq('package_id', enrollment.package_id);

  // Collect all module IDs
  const moduleIds: string[] = [];
  for (const pp of programs ?? []) {
    const prog = pp.programs as { program_modules: { module_id: string }[] };
    for (const pm of prog.program_modules ?? []) {
      moduleIds.push(pm.module_id);
    }
  }

  // Merge ancestry chains across all modules
  const ancestryMap = new Map<string, { coachId: string; totalPct: number }>();
  for (const moduleId of moduleIds) {
    const chain = await getAncestryChain(moduleId);
    for (const row of chain) {
      const existing = ancestryMap.get(row.ancestorCoachId);
      if (existing) {
        existing.totalPct = Math.min(100, existing.totalPct + row.applicableCutPct);
      } else {
        ancestryMap.set(row.ancestorCoachId, { coachId: row.ancestorCoachId, totalPct: row.applicableCutPct });
      }
    }
  }

  // Build merged ancestry for revenue split using first module's chain as canonical
  const mergedAncestry = moduleIds.length > 0 ? await getAncestryChain(moduleIds[0]) : [];

  const allocations = calculateRevenueSplit(priceUsd, mergedAncestry);

  // Patch delivering_coach coachId
  for (const a of allocations) {
    if (a.role === 'delivering_coach') {
      a.coachId = enrollment.installing_coach_id as string;
    }
  }

  await writeRevenueEvents(enrollmentId, allocations);
  return allocations;
}

export async function getLicenseDashboard(coachId: string) {
  const [granted, held, revenue] = await Promise.all([
    getLicensesGrantedByCoach(coachId),
    getLicensesHeldByCoach(coachId),
    getRevenueByCoach(coachId),
  ]);
  return {
    granted,
    held,
    revenueThisMonth: revenue.totalUsd,
    topEarningModule: null,
  };
}
