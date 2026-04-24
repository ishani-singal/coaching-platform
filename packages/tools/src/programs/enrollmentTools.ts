import { supabase } from '@coaching/sdk';
import { EnrollmentRecord, EnrollmentType, ClientProfile, CoachingPackage } from '@coaching/sdk';

export async function createEnrollment(
  packageId: string,
  coachId: string,
  clientId: string,
  type: EnrollmentType
): Promise<EnrollmentRecord> {
  const { data, error } = await supabase
    .from('enrollments')
    .insert({ package_id: packageId, installing_coach_id: coachId, client_id: clientId, enrollment_type: type })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapEnrollment(data);
}

export async function getEnrollmentByToken(token: string): Promise<EnrollmentRecord & { client: ClientProfile; pkg: CoachingPackage }> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, client_profiles(*), coaching_packages(*)')
    .eq('invite_token', token)
    .single();
  if (error) throw new Error('Enrollment not found');
  return {
    ...mapEnrollment(data),
    client: mapClient(data.client_profiles as Record<string, unknown>),
    pkg:    mapPackage(data.coaching_packages as Record<string, unknown>),
  };
}

export async function getEnrollmentWithProgress(enrollmentId: string) {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .single();

  const { data: responses } = await supabase
    .from('enrollment_responses')
    .select('section_id, response_data, submitted_at')
    .eq('enrollment_id', enrollmentId);

  const completedSectionIds = (responses ?? []).map((r: Record<string, unknown>) => r.section_id as string);
  return { enrollment: mapEnrollment(enrollment), completedSectionIds, responses: responses ?? [] };
}

export async function submitResponse(
  enrollmentId: string,
  sectionId: string,
  responseData: Record<string, unknown>
): Promise<void> {
  await supabase.from('enrollment_responses').insert({ enrollment_id: enrollmentId, section_id: sectionId, response_data: responseData });
}

export async function advanceCurrentModule(enrollmentId: string, nextModuleId: string): Promise<void> {
  await supabase.from('enrollments').update({ current_module_id: nextModuleId }).eq('enrollment_id', enrollmentId);
}

export async function completeEnrollment(enrollmentId: string): Promise<void> {
  await supabase.from('enrollments').update({ completed_at: new Date().toISOString() }).eq('enrollment_id', enrollmentId);
}

export async function getCoachEnrollmentStats(coachId: string, packageId?: string) {
  let q = supabase.from('enrollments').select('enrollment_id, completed_at, current_module_id').eq('installing_coach_id', coachId);
  if (packageId) q = q.eq('package_id', packageId);
  const { data } = await q;
  const rows = data ?? [];
  const total = rows.length;
  const completed = rows.filter((r: Record<string, unknown>) => r.completed_at).length;
  const active = rows.filter((r: Record<string, unknown>) => !r.completed_at).length;
  return {
    totalEnrollments:  total,
    activeEnrollments: active,
    completionRate:    total > 0 ? completed / total : 0,
    avgModuleReached:  0,
  };
}

function mapEnrollment(row: Record<string, unknown>): EnrollmentRecord {
  return {
    enrollmentId:       row.enrollment_id as string,
    packageId:          row.package_id as string,
    installingCoachId:  row.installing_coach_id as string,
    clientId:           row.client_id as string,
    enrollmentType:     row.enrollment_type as EnrollmentType,
    inviteToken:        row.invite_token as string,
    startedAt:          row.started_at as string | undefined,
    completedAt:        row.completed_at as string | undefined,
    currentModuleId:    row.current_module_id as string | undefined,
  };
}

function mapClient(row: Record<string, unknown>): ClientProfile {
  return {
    clientId:    row.client_id as string,
    coachId:     row.coach_id as string,
    name:        row.name as string,
    email:       row.email as string,
    goals:       (row.goals ?? '') as string,
    background:  (row.background ?? '') as string,
    preferences: (row.preferences ?? {}) as ClientProfile['preferences'],
  };
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:         row.package_id as string,
    coachId:           row.coach_id as string,
    personaSnapshotId: row.persona_snapshot_id as string,
    title:             row.title as string,
    pricingModel:      row.pricing_model as CoachingPackage['pricingModel'],
    priceUsd:          row.price_usd as number | undefined,
    isPublished:       row.is_published as boolean,
  };
}
