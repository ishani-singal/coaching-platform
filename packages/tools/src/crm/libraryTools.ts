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
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data);
}

export async function updateLibraryItem(itemId: string, patch: Partial<LibraryItem>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title)        update.title         = patch.title;
  if (patch.description)  update.description   = patch.description;
  if (patch.tags)         update.tags          = patch.tags;
  if (patch.displayOrder !== undefined) update.display_order = patch.displayOrder;
  if (patch.metadata)     update.metadata      = patch.metadata;
  await supabase.from('coach_library_items').update(update).eq('item_id', itemId);
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

export async function getLibraryByCoach(coachId: string, itemType?: LibraryItemType): Promise<LibraryItem[]> {
  let q = supabase.from('coach_library_items').select('*').eq('coach_id', coachId).order('display_order');
  if (itemType) q = q.eq('item_type', itemType);
  const { data } = await q;
  return (data ?? []).map(mapItem);
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
    itemId:       row.item_id as string,
    coachId:      row.coach_id as string,
    itemType:     row.item_type as LibraryItemType,
    title:        row.title as string,
    url:          row.url as string | undefined,
    description:  row.description as string | undefined,
    tags:         row.tags as string[],
    thumbnailUrl: row.thumbnail_url as string | undefined,
    metadata:     row.metadata as Record<string, unknown>,
    displayOrder: row.display_order as number,
  };
}
