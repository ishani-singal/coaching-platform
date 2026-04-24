import { supabase } from '@coaching/sdk';
import { PersonaSnapshot, PersonaSource } from '@coaching/sdk';

export async function addPersonaSource(
  coachId: string,
  sourceType: PersonaSource['sourceType'],
  content?: string,
  url?: string
): Promise<PersonaSource> {
  const { data, error } = await supabase
    .from('persona_sources')
    .insert({ coach_id: coachId, source_type: sourceType, content, url })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSource(data);
}

export async function removePersonaSource(sourceId: string): Promise<void> {
  await supabase.from('persona_sources').delete().eq('id', sourceId);
}

export async function getPersonaSources(coachId: string): Promise<PersonaSource[]> {
  const { data } = await supabase
    .from('persona_sources')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapSource);
}

export async function getLatestPersonaSnapshot(coachId: string): Promise<PersonaSnapshot | null> {
  const { data } = await supabase
    .from('persona_snapshots')
    .select('*')
    .eq('coach_id', coachId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapSnapshot(data) : null;
}

export async function savePersonaSnapshot(
  coachId: string,
  tone: string,
  style: string,
  summary: string,
  raw: Record<string, unknown>
): Promise<PersonaSnapshot> {
  const { data: latest } = await supabase
    .from('persona_snapshots')
    .select('version')
    .eq('coach_id', coachId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((latest?.version as number) ?? 0) + 1;

  const { data, error } = await supabase
    .from('persona_snapshots')
    .insert({ coach_id: coachId, version: nextVersion, tone, style, summary, raw_snapshot: raw })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSnapshot(data);
}

function mapSource(row: Record<string, unknown>): PersonaSource {
  return {
    id:         row.id as string,
    coachId:    row.coach_id as string,
    sourceType: row.source_type as PersonaSource['sourceType'],
    content:    row.content as string | undefined,
    url:        row.url as string | undefined,
    createdAt:  row.created_at as string,
  };
}

function mapSnapshot(row: Record<string, unknown>): PersonaSnapshot {
  return {
    id:          row.id as string,
    coachId:     row.coach_id as string,
    version:     row.version as number,
    tone:        row.tone as string,
    style:       row.style as string,
    summary:     row.summary as string,
    rawSnapshot: row.raw_snapshot as Record<string, unknown>,
  };
}
