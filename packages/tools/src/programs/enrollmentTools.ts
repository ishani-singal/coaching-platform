import { supabase } from '@coaching/sdk';
import { EnrollmentType, ClientProfile, CoachingPackage } from '@coaching/sdk';

export async function createEnrollment(
  packageId: string,
  coachId: string,
  clientId: string,
  type: EnrollmentType
): Promise<ClientProfile> {
  const { data, error } = await supabase
    .from('client_profiles')
    .update({ package_id: packageId, enrollment_type: type })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

export async function getEnrollmentByToken(token: string): Promise<ClientProfile & { pkg: CoachingPackage }> {
  const { data, error } = await supabase
    .from('client_profiles')
    .select('*, packages(*)')
    .eq('invite_token', token)
    .single();
  if (error) throw new Error('Client not found');
  return {
    ...mapClient(data),
    pkg: mapPackage(data.packages as Record<string, unknown>),
  };
}

export async function getEnrollmentWithProgress(clientId: string) {
  const { data: client } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('client_id', clientId)
    .single();

  const responses = (client?.responses ?? []) as Array<{ section_id: string; response_data: Record<string, unknown>; submitted_at: string }>;
  const completedSectionIds = responses.map(r => r.section_id);
  return { enrollment: mapClient(client), completedSectionIds, responses };
}

export async function submitResponse(
  clientId: string,
  sectionId: string,
  responseData: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.rpc('append_enrollment_response', {
    p_client_id:     clientId,
    p_section_id:    sectionId,
    p_response_data: responseData,
  });
  if (error) throw new Error(error.message);
}

export async function advanceCurrentModule(clientId: string, nextModuleId: string): Promise<void> {
  await supabase.from('client_profiles').update({ current_module_id: nextModuleId }).eq('client_id', clientId);
}

export async function completeEnrollment(clientId: string): Promise<void> {
  await supabase.from('client_profiles').update({ completed_at: new Date().toISOString() }).eq('client_id', clientId);
}

export async function getCoachEnrollmentStats(coachId: string, packageId?: string) {
  let q = supabase
    .from('client_profiles')
    .select('client_id, completed_at, current_module_id')
    .eq('coach_id', coachId)
    .not('enrollment_type', 'is', null);
  if (packageId) q = q.eq('package_id', packageId);
  const { data } = await q;
  const rows = data ?? [];
  const total     = rows.length;
  const completed = rows.filter((r: Record<string, unknown>) => r.completed_at).length;
  const active    = rows.filter((r: Record<string, unknown>) => !r.completed_at).length;
  return {
    totalEnrollments:  total,
    activeEnrollments: active,
    completionRate:    total > 0 ? completed / total : 0,
    avgModuleReached:  0,
  };
}

function mapClient(row: Record<string, unknown>): ClientProfile {
  const rawResponses = (row.responses ?? []) as Array<Record<string, unknown>>;
  return {
    clientId:       row.client_id as string,
    coachId:        row.coach_id as string,
    inviteToken:    row.invite_token as string | undefined,
    userId:         row.user_id as string | undefined,
    name:           row.name as string,
    email:          row.email as string,
    phone:          row.phone as string | undefined,
    goals:          (row.goals ?? '') as string,
    background:     (row.background ?? '') as string,
    preferences:    (row.preferences ?? {}) as ClientProfile['preferences'],
    packageId:      row.package_id as string | undefined,
    enrollmentType: row.enrollment_type as EnrollmentType | undefined,
    startedAt:      row.started_at as string | undefined,
    completedAt:    row.completed_at as string | undefined,
    currentModuleId: row.current_module_id as string | undefined,
    responses:      rawResponses.map(r => ({
      sectionId:    r.section_id as string,
      responseData: (r.response_data ?? {}) as Record<string, unknown>,
      submittedAt:  r.submitted_at as string,
    })),
  };
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:        row.package_id as string,
    coachId:          row.coach_id as string,
    title:            row.title as string,
    pricingModel:     row.pricing_model as CoachingPackage['pricingModel'],
    priceUsd:         row.price_usd as number | undefined,
    currencies:       (row.currencies as string[] | undefined) ?? ['INR'],
    showSeatsFilled:  (row.show_seats_filled as boolean) ?? false,
    isPublished:      row.is_published as boolean,
    includedProgramIds: (row.included_program_ids as string[] | undefined) ?? [],
  };
}
