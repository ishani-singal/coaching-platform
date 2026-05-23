import { supabase } from '@coaching/sdk';
import { ClientProfile, EnrollmentType } from '@coaching/sdk';

export async function createClientProfile(coachId: string, data: Partial<ClientProfile>): Promise<ClientProfile> {
  const { data: row, error } = await supabase
    .from('client_profiles')
    .insert({
      coach_id:    coachId,
      name:        data.name,
      email:       data.email,
      phone:       data.phone,
      goals:       data.goals,
      background:  data.background,
      preferences: data.preferences ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapClient(row);
}

export async function upsertClientProfile(coachId: string, email: string, data: Partial<ClientProfile>): Promise<ClientProfile> {
  const { data: existing } = await supabase
    .from('client_profiles')
    .select('client_id')
    .eq('coach_id', coachId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    const { data: row, error } = await supabase
      .from('client_profiles')
      .update({ name: data.name ?? '', goals: data.goals, background: data.background, preferences: data.preferences ?? {} })
      .eq('client_id', existing.client_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapClient(row);
  }

  const { data: row, error } = await supabase
    .from('client_profiles')
    .insert({ coach_id: coachId, email, name: data.name ?? '', goals: data.goals, background: data.background, preferences: data.preferences ?? {} })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapClient(row);
}

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  const { data, error } = await supabase.from('client_profiles').select('*').eq('client_id', clientId).single();
  if (error) throw new Error('Client not found');
  return mapClient(data);
}

export async function getClientByInviteToken(token: string): Promise<ClientProfile> {
  const { data, error } = await supabase.from('client_profiles').select('*').eq('invite_token', token).single();
  if (error) throw new Error('Client not found');
  return mapClient(data);
}

export async function getClientsByCoach(coachId: string): Promise<ClientProfile[]> {
  const { data } = await supabase.from('client_profiles').select('*').eq('coach_id', coachId).order('created_at', { ascending: false });
  return (data ?? []).map(mapClient);
}

export async function updateClientProfile(clientId: string, patch: Partial<ClientProfile>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name)        update.name        = patch.name;
  if (patch.phone)       update.phone       = patch.phone;
  if (patch.goals)       update.goals       = patch.goals;
  if (patch.background)  update.background  = patch.background;
  if (patch.preferences) update.preferences = patch.preferences;
  await supabase.from('client_profiles').update(update).eq('client_id', clientId);
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
