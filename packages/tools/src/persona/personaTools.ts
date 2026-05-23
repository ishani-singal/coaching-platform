import { supabase } from '@coaching/sdk';
import { PersonaSnapshot } from '@coaching/sdk';
import { extractPdfText } from '../embeddings/pdfTools';
import { upsertLibraryChunks } from '../embeddings/pineconeTools';

export interface PersonaContext {
  corpus: string;
  libraryItemCount: number;
}

/** Build a text corpus from user_profiles + coach_library_items for LLM persona extraction. */
export async function buildPersonaContext(coachId: string): Promise<PersonaContext> {
  const [profileResult, libraryResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('display_name, bio, coaching_type, social_media')
      .eq('user_id', coachId)
      .single(),
    supabase
      .from('coach_library_items')
      .select('item_type, title, description, tags')
      .eq('coach_id', coachId)
      .order('display_order'),
  ]);

  const profile = profileResult.data;
  const items   = libraryResult.data ?? [];

  const lines: string[] = [];

  if (profile) {
    lines.push(`Coach: ${profile.display_name as string}`);
    if (profile.coaching_type) lines.push(`Coaching specialty: ${(profile.coaching_type as string).replace(/_/g, ' ')}`);
    if (profile.bio)           lines.push(`Bio: ${profile.bio as string}`);

    const social = (profile.social_media ?? {}) as Record<string, string>;
    if (social.linkedin)  lines.push(`LinkedIn: ${social.linkedin}`);
    if (social.instagram) lines.push(`Instagram: ${social.instagram}`);
  }

  if (items.length > 0) {
    lines.push('\nLibrary:');
    for (const item of items) {
      const tags = ((item.tags as string[]) ?? []).join(', ');
      const desc = (item.description as string | null) ?? '';
      lines.push(`[${item.item_type as string}] ${item.title as string}${desc ? ` — ${desc}` : ''}${tags ? ` (tags: ${tags})` : ''}`);
    }
  }

  return { corpus: lines.join('\n'), libraryItemCount: items.length };
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

/**
 * For every book/pdf library item that has a URL, fetch and parse the PDF,
 * then upsert the text chunks into Pinecone so they are available for RAG.
 * Skips items where the URL is missing or the fetch/parse fails.
 */
export async function indexPdfLibraryItems(coachId: string): Promise<void> {
  const { data: items } = await supabase
    .from('coach_library_items')
    .select('item_id, title, item_type, url')
    .eq('coach_id', coachId)
    .in('item_type', ['book', 'pdf'])
    .not('url', 'is', null);

  if (!items?.length) return;

  await Promise.allSettled(
    items.map(async (item) => {
      const url = item.url as string;
      const text = await extractPdfText(url);
      if (!text.trim()) return;

      // Rough chunk: every 2000 chars (~500 tokens)
      const chunkSize = 2000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        const c = text.slice(i, i + chunkSize).trim();
        if (c) chunks.push(c);
      }
      if (!chunks.length) return;

      await upsertLibraryChunks(coachId, item.item_id as string, chunks, {
        source:   'pdf',
        title:    item.title as string,
        itemType: item.item_type as string,
      });
    })
  );
}
