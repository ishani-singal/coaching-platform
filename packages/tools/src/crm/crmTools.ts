import { supabase } from '@coaching/sdk';
import { ClientProfile } from '@coaching/sdk';

export async function addNote(coachId: string, clientId: string, note: string): Promise<void> {
  await supabase.from('coach_client_notes').insert({ coach_id: coachId, client_id: clientId, note });
}

export async function getNotes(coachId: string, clientId: string) {
  const { data } = await supabase
    .from('coach_client_notes')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function deleteNote(noteId: string): Promise<void> {
  await supabase.from('coach_client_notes').delete().eq('note_id', noteId);
}

export async function addTag(coachId: string, clientId: string, tag: string): Promise<void> {
  await supabase.from('coach_client_tags').upsert({ coach_id: coachId, client_id: clientId, tag });
}

export async function removeTag(coachId: string, clientId: string, tag: string): Promise<void> {
  await supabase.from('coach_client_tags').delete().eq('coach_id', coachId).eq('client_id', clientId).eq('tag', tag);
}

export async function getClientsByTag(coachId: string, tag: string): Promise<ClientProfile[]> {
  const { data } = await supabase
    .from('coach_client_tags')
    .select('client_id, client_profiles(*)')
    .eq('coach_id', coachId)
    .eq('tag', tag);
  return (data ?? []).map((row: Record<string, unknown>) => {
    const c = row.client_profiles as Record<string, unknown>;
    return mapClient(c);
  });
}

export async function getAllTags(coachId: string): Promise<string[]> {
  const { data } = await supabase
    .from('coach_client_tags')
    .select('tag')
    .eq('coach_id', coachId);
  const tags = [...new Set((data ?? []).map((r: Record<string, unknown>) => r.tag as string))];
  return tags;
}

export async function getClientSummary(coachId: string, clientId: string) {
  const [profile, notes, tags] = await Promise.all([
    supabase.from('client_profiles').select('*').eq('client_id', clientId).single().then(r => r.data),
    supabase.from('coach_client_notes').select('*').eq('coach_id', coachId).eq('client_id', clientId).then(r => r.data ?? []),
    supabase.from('coach_client_tags').select('tag').eq('coach_id', coachId).eq('client_id', clientId).then(r => (r.data ?? []).map((x: Record<string, unknown>) => x.tag as string)),
  ]);
  return { profile: profile ? mapClient(profile) : null, notes, tags, enrollment: null, upcomingSessions: [] };
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
    responses:   (row.responses as ClientProfile['responses']) ?? [],
  };
}
