import { LicenseTerms, RevenueAllocation } from '@coaching/sdk';
import {
  createModuleLicense,
  createProgramLicense,
  getPendingLicenseByToken,
  activateProgramLicenseById,
  getAncestryChain,
  calculateRevenueSplit,
  writeRevenueEvents,
  getLicensesGrantedByCoach,
  getLicensesHeldByCoach,
  getRevenueByCoach,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';
import { sendFromCoach } from './gmailTransport';

export async function licenseModuleToCoach(
  licensorId: string,
  licenseeId: string,
  moduleId: string,
  terms: LicenseTerms
): Promise<void> {
  await createModuleLicense(licensorId, licenseeId, moduleId, terms);
}

export async function licenseProgramToCoach(
  licensorId: string,
  licenseeId: string,
  programId: string,
  terms: LicenseTerms
): Promise<{ inviteToken: string; licenseId: string }> {
  return createProgramLicense(licensorId, licenseeId, programId, terms);
}

export async function sendLicenseInvitation(
  licensorId: string,
  params: { programId: string; licenseeEmail: string; licenseFeeAmount: number; licenseFeeCurrency: string }
): Promise<{ inviteToken: string; licenseId: string }> {
  // Look up licensee — create a placeholder if they don't have an account yet
  const { data: coachRow } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('email', params.licenseeEmail)
    .maybeSingle();

  // Use a sentinel UUID for invitees without accounts; the invite page will handle account creation
  const licenseeId = coachRow?.user_id ?? '00000000-0000-0000-0000-000000000000';

  const { inviteToken, licenseId } = await createProgramLicense(licensorId, licenseeId, params.programId, {
    directCutPct:      0,
    derivativeCutPct:  0,
    propagateToDepth:  null,
    canSublicense:     false,
    licenseFeeAmount:  params.licenseFeeAmount,
    licenseFeeCurrency: params.licenseFeeCurrency,
  });

  // Look up the program title for the email
  const { data: prog } = await supabase.from('programs').select('title').eq('program_id', params.programId).single();
  const programTitle = (prog?.title as string) ?? 'a program';

  // Look up licensor name
  const { data: licensor } = await supabase.from('user_profiles').select('name').eq('user_id', licensorId).single();
  const licensorName = (licensor?.name as string) ?? 'A coach';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${appUrl}/license-invite/${inviteToken}`;

  await sendFromCoach(licensorId, {
    to:      params.licenseeEmail,
    subject: `You've been invited to license "${programTitle}"`,
    html: `
      <p>Hi there,</p>
      <p><strong>${licensorName}</strong> has invited you to license their program <strong>"${programTitle}"</strong>.</p>
      ${params.licenseFeeAmount > 0
        ? `<p>One-time licensing fee: <strong>${params.licenseFeeCurrency} ${params.licenseFeeAmount.toFixed(2)}</strong></p>`
        : `<p>This is a <strong>free</strong> license.</p>`
      }
      <p><a href="${inviteUrl}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">View &amp; Accept Invitation</a></p>
      <p style="color:#6b7280;font-size:12px;">If you don't have an account, you'll be guided to create one first.</p>
    `,
  });

  return { inviteToken, licenseId };
}

export async function activateProgramLicense(licenseId: string): Promise<void> {
  const { programId, licenseeCoachId } = await activateProgramLicenseById(licenseId);

  // Fork the program: copy the program row for the licensee
  const { data: origProg } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();

  if (origProg) {
    const { program_id: _origId, created_at: _ca, updated_at: _ua, ...rest } = origProg as Record<string, unknown>;
    await supabase.from('programs').insert({
      ...rest,
      creator_coach_id: licenseeCoachId,
      title: `${rest.title as string} (Licensed)`,
      source_program_id: programId,
    });
  }
}

export { getPendingLicenseByToken };

export async function computeAndWriteRevenue(clientId: string, priceUsd: number): Promise<RevenueAllocation[]> {
  const { data: enrollment } = await supabase
    .from('client_profiles')
    .select('package_id, coach_id')
    .eq('client_id', clientId)
    .single();

  if (!enrollment?.package_id) throw new Error('Client has no enrollment');

  const { data: pkgRow } = await supabase
    .from('packages')
    .select('programs')
    .eq('package_id', enrollment.package_id)
    .single();

  const progIds = ((pkgRow?.programs as Array<{ program_id: string }>) ?? []).map(p => p.program_id);
  const { data: progRows } = progIds.length > 0
    ? await supabase.from('programs').select('periods').in('program_id', progIds)
    : { data: [] as unknown[] };

  // Collect all module IDs
  const moduleIds: string[] = [];
  for (const prog of progRows ?? []) {
    const p = prog as { periods?: Array<{ modules?: { module_id: string }[] }> };
    for (const period of p.periods ?? []) {
      for (const pm of period.modules ?? []) {
        moduleIds.push(pm.module_id);
      }
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

  for (const a of allocations) {
    if (a.role === 'delivering_coach') {
      a.coachId = enrollment.coach_id as string;
    }
  }

  await writeRevenueEvents(clientId, allocations);
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
