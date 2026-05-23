import { supabase } from '@coaching/sdk';
import { LicenseTerms, AncestryRow, RevenueAllocation } from '@coaching/sdk';

export async function createModuleLicense(
  licensorId: string,
  licenseeId: string,
  moduleId: string,
  terms: LicenseTerms
): Promise<void> {
  const { data: mod } = await supabase.from('modules').select('creator_coach_id, no_sublicense').eq('module_id', moduleId).single();
  if (mod?.no_sublicense) throw new Error('This module cannot be licensed');
  if (mod?.creator_coach_id !== licensorId) {
    const { data: existing } = await supabase
      .from('module_licenses')
      .select('can_sublicense')
      .eq('module_id', moduleId)
      .eq('licensee_coach_id', licensorId)
      .maybeSingle();
    if (!existing?.can_sublicense) throw new Error('Not authorized to license this module');
  }
  const { error } = await supabase.from('module_licenses').insert({
    module_id:           moduleId,
    licensor_coach_id:   licensorId,
    licensee_coach_id:   licenseeId,
    direct_cut_pct:      terms.directCutPct,
    derivative_cut_pct:  terms.derivativeCutPct,
    propagate_to_depth:  terms.propagateToDepth,
    can_sublicense:      terms.canSublicense,
  });
  if (error) throw new Error(error.message);
}

export async function createProgramLicense(
  licensorId: string,
  licenseeId: string,
  programId: string,
  terms: LicenseTerms
): Promise<{ inviteToken: string; licenseId: string }> {
  const { data, error } = await supabase.from('program_licenses').insert({
    program_id:            programId,
    licensor_coach_id:     licensorId,
    licensee_coach_id:     licenseeId,
    direct_cut_pct:        0,
    derivative_cut_pct:    0,
    propagate_to_depth:    terms.propagateToDepth,
    can_sublicense:        false,
    license_fee_amount:    terms.licenseFeeAmount ?? null,
    license_fee_currency:  terms.licenseFeeCurrency ?? 'USD',
    status:                'pending',
  }).select('license_id, invite_token').single();
  if (error) throw new Error(error.message);
  return { licenseId: data.license_id as string, inviteToken: data.invite_token as string };
}

export async function getPendingLicenseByToken(token: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('program_licenses')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();
  return data ?? null;
}

export async function activateProgramLicenseById(licenseId: string): Promise<{ programId: string; licenseeCoachId: string }> {
  const { data, error } = await supabase
    .from('program_licenses')
    .update({ status: 'active' })
    .eq('license_id', licenseId)
    .select('program_id, licensee_coach_id')
    .single();
  if (error) throw new Error(error.message);
  return { programId: data.program_id as string, licenseeCoachId: data.licensee_coach_id as string };
}

export async function revokeModuleLicense(licenseId: string): Promise<void> {
  await supabase.from('module_licenses').delete().eq('license_id', licenseId);
}

export async function getAncestryChain(moduleId: string): Promise<AncestryRow[]> {
  const { data } = await supabase
    .from('module_ancestry')
    .select('*')
    .eq('module_id', moduleId)
    .order('depth');
  return (data ?? []).map((row: Record<string, unknown>) => ({
    moduleId:           row.module_id as string,
    ancestorModuleId:   row.ancestor_module_id as string,
    ancestorCoachId:    row.ancestor_coach_id as string,
    depth:              row.depth as number,
    applicableCutPct:   row.applicable_cut_pct as number,
  }));
}

export function calculateRevenueSplit(priceUsd: number, ancestry: AncestryRow[]): RevenueAllocation[] {
  const platformCutPct = parseFloat(process.env.PLATFORM_CUT_PCT ?? '10');
  const allocations: RevenueAllocation[] = [];

  const platformAmount = (priceUsd * platformCutPct) / 100;
  allocations.push({ coachId: 'platform', role: 'platform', ancestorDepth: 0, amountUsd: platformAmount, pct: platformCutPct });

  let remaining = priceUsd - platformAmount;
  const sorted = [...ancestry].sort((a, b) => a.depth - b.depth);

  for (const row of sorted) {
    const amount = (priceUsd * row.applicableCutPct) / 100;
    allocations.push({
      coachId:       row.ancestorCoachId,
      role:          'licensor',
      ancestorDepth: row.depth,
      amountUsd:     amount,
      pct:           row.applicableCutPct,
    });
    remaining -= amount;
  }

  const deliveryPct = (remaining / priceUsd) * 100;
  allocations.push({ coachId: 'delivering', role: 'delivering_coach', ancestorDepth: 0, amountUsd: remaining, pct: deliveryPct });

  return allocations;
}

export async function writeRevenueEvents(clientId: string, allocations: RevenueAllocation[]): Promise<void> {
  const rows = allocations.map(a => ({
    client_id:      clientId,
    coach_id:       a.coachId,
    role:           a.role,
    amount_usd:     a.amountUsd,
    ancestor_depth: a.ancestorDepth,
  }));
  await supabase.from('revenue_events').insert(rows);
}

export async function getLicensesGrantedByCoach(coachId: string) {
  const { data } = await supabase.from('module_licenses').select('*').eq('licensor_coach_id', coachId);
  return data ?? [];
}

export async function getLicensesHeldByCoach(coachId: string) {
  const { data } = await supabase.from('module_licenses').select('*').eq('licensee_coach_id', coachId);
  return data ?? [];
}

export async function getRevenueByCoach(coachId: string, since?: string) {
  let q = supabase.from('revenue_events').select('amount_usd, client_id').eq('coach_id', coachId);
  if (since) q = q.gte('created_at', since);
  const { data } = await q;
  const rows = data ?? [];
  const totalUsd = rows.reduce((sum: number, r: Record<string, unknown>) => sum + (r.amount_usd as number), 0);
  return { totalUsd, byModule: {}, byLicensee: {} };
}
