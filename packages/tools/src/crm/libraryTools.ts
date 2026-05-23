import { supabase } from '@coaching/sdk';
import { LibraryItem, LibraryItemType } from '@coaching/sdk';

export async function addLibraryItem(coachId: string, item: Partial<LibraryItem>): Promise<LibraryItem> {
  const { data, error } = await supabase
    .from('coach_library_items')
    .insert({
      coach_id:      coachId,
      item_type:     item.itemType,
      title:         item.title,
      url:           item.url,
      description:   item.description,
      tags:          item.tags ?? [],
      thumbnail_url: item.thumbnailUrl,
      metadata:      item.metadata ?? {},
      display_order: item.displayOrder ?? 0,
      buy_link:      item.buyLink,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data);
}

export async function updateLibraryItem(itemId: string, patch: Partial<LibraryItem>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined)        update.title         = patch.title;
  if (patch.description !== undefined)  update.description   = patch.description;
  if (patch.tags !== undefined)         update.tags          = patch.tags;
  if (patch.displayOrder !== undefined) update.display_order = patch.displayOrder;
  if (patch.metadata !== undefined)     update.metadata      = patch.metadata;
  if (patch.thumbnailUrl !== undefined) update.thumbnail_url = patch.thumbnailUrl;
  if (patch.url !== undefined)          update.url           = patch.url;
  if (patch.buyLink !== undefined)      update.buy_link      = patch.buyLink;
  await supabase.from('coach_library_items').update(update).eq('item_id', itemId);
}

export async function markLibraryItemEmbedded(itemId: string): Promise<void> {
  await supabase
    .from('coach_library_items')
    .update({ embedded_at: new Date().toISOString() })
    .eq('item_id', itemId);
}

export async function removeLibraryItem(itemId: string): Promise<void> {
  await supabase.from('coach_library_items').delete().eq('item_id', itemId);
}

export async function reorderLibraryItems(coachId: string, orderedItemIds: string[]): Promise<void> {
  await Promise.all(
    orderedItemIds.map((id, idx) =>
      supabase.from('coach_library_items').update({ display_order: idx }).eq('item_id', id).eq('coach_id', coachId)
    )
  );
}

export async function getLibraryItemByUrl(coachId: string, url: string): Promise<LibraryItem | null> {
  const { data } = await supabase
    .from('coach_library_items')
    .select('*')
    .eq('coach_id', coachId)
    .eq('url', url)
    .maybeSingle();
  return data ? mapItem(data) : null;
}

export async function getLibraryByCoach(coachId: string, itemType?: LibraryItemType): Promise<LibraryItem[]> {
  let q = supabase.from('coach_library_items').select('*').eq('coach_id', coachId).order('display_order');
  if (itemType) q = q.eq('item_type', itemType);
  const { data } = await q;
  return (data ?? []).map(mapItem);
}

export async function getUnembeddedLibraryItems(coachId: string): Promise<LibraryItem[]> {
  const { data } = await supabase
    .from('coach_library_items')
    .select('*')
    .eq('coach_id', coachId)
    .is('embedded_at', null);
  return (data ?? []).map(mapItem);
}

export async function addBook(
  coachId: string,
  title: string,
  author: string,
  fileUrl: string | undefined,
  buyLink: string | undefined,
  description: string,
  tags: string[],
  thumbnailUrl?: string
): Promise<LibraryItem> {
  return addLibraryItem(coachId, {
    itemType: 'book',
    title,
    url: fileUrl,
    description,
    tags,
    thumbnailUrl,
    buyLink,
    metadata: { author },
    displayOrder: 0,
  });
}

export async function addArticle(coachId: string, title: string, url: string, description: string, tags: string[]): Promise<LibraryItem> {
  return addLibraryItem(coachId, { itemType: 'article', title, url, description, tags, metadata: {}, displayOrder: 0 });
}

export async function addPdf(coachId: string, title: string, fileUrl: string, description: string, tags: string[]): Promise<LibraryItem> {
  return addLibraryItem(coachId, { itemType: 'pdf', title, url: fileUrl, description, tags, metadata: {}, displayOrder: 0 });
}

export async function getCoachesWithYoutubeChannel(): Promise<{ coachId: string; channelUrl: string }[]> {
  const { data, error } = await supabase
    .from('coach_library_items')
    .select('coach_id, metadata')
    .eq('item_type', 'youtube');
  if (error) throw new Error(error.message);
  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const channelUrl = meta?.channelUrl as string | undefined;
    if (channelUrl && !seen.has(row.coach_id as string)) {
      seen.set(row.coach_id as string, channelUrl);
    }
  }
  return Array.from(seen.entries()).map(([coachId, channelUrl]) => ({ coachId, channelUrl }));
}

export async function searchLibrary(coachId: string, query: string): Promise<LibraryItem[]> {
  const { data } = await supabase
    .from('coach_library_items')
    .select('*')
    .eq('coach_id', coachId)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`);
  return (data ?? []).map(mapItem);
}

function mapItem(row: Record<string, unknown>): LibraryItem {
  return {
    itemId:            row.item_id as string,
    coachId:           row.coach_id as string,
    itemType:          row.item_type as LibraryItemType,
    title:             row.title as string,
    url:               row.url as string | undefined,
    description:       row.description as string | undefined,
    tags:              row.tags as string[],
    thumbnailUrl:      row.thumbnail_url as string | undefined,
    metadata:          row.metadata as Record<string, unknown>,
    displayOrder:      row.display_order as number,
    buyLink:           row.buy_link as string | undefined,
    embeddedAt:        row.embedded_at as string | undefined,
    transcript:        row.transcript as string | undefined,
    transcriptSource:  row.transcript_source as 'youtube_captions' | 'whisper' | 'manual' | 'text-extraction' | undefined,
    transcriptLanguage: row.transcript_language as string | undefined,
    chunksIndexed:     (row.chunks_indexed as boolean) ?? false,
  };
}
