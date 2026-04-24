"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLibraryItem = addLibraryItem;
exports.updateLibraryItem = updateLibraryItem;
exports.removeLibraryItem = removeLibraryItem;
exports.reorderLibraryItems = reorderLibraryItems;
exports.getLibraryByCoach = getLibraryByCoach;
exports.searchLibrary = searchLibrary;
const sdk_1 = require("@coaching/sdk");
async function addLibraryItem(coachId, item) {
    const { data, error } = await sdk_1.supabase
        .from('coach_library_items')
        .insert({
        coach_id: coachId,
        item_type: item.itemType,
        title: item.title,
        url: item.url,
        description: item.description,
        tags: item.tags ?? [],
        thumbnail_url: item.thumbnailUrl,
        metadata: item.metadata ?? {},
        display_order: item.displayOrder ?? 0,
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapItem(data);
}
async function updateLibraryItem(itemId, patch) {
    const update = {};
    if (patch.title)
        update.title = patch.title;
    if (patch.description)
        update.description = patch.description;
    if (patch.tags)
        update.tags = patch.tags;
    if (patch.displayOrder !== undefined)
        update.display_order = patch.displayOrder;
    if (patch.metadata)
        update.metadata = patch.metadata;
    await sdk_1.supabase.from('coach_library_items').update(update).eq('item_id', itemId);
}
async function removeLibraryItem(itemId) {
    await sdk_1.supabase.from('coach_library_items').delete().eq('item_id', itemId);
}
async function reorderLibraryItems(coachId, orderedItemIds) {
    await Promise.all(orderedItemIds.map((id, idx) => sdk_1.supabase.from('coach_library_items').update({ display_order: idx }).eq('item_id', id).eq('coach_id', coachId)));
}
async function getLibraryByCoach(coachId, itemType) {
    let q = sdk_1.supabase.from('coach_library_items').select('*').eq('coach_id', coachId).order('display_order');
    if (itemType)
        q = q.eq('item_type', itemType);
    const { data } = await q;
    return (data ?? []).map(mapItem);
}
async function searchLibrary(coachId, query) {
    const { data } = await sdk_1.supabase
        .from('coach_library_items')
        .select('*')
        .eq('coach_id', coachId)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    return (data ?? []).map(mapItem);
}
function mapItem(row) {
    return {
        itemId: row.item_id,
        coachId: row.coach_id,
        itemType: row.item_type,
        title: row.title,
        url: row.url,
        description: row.description,
        tags: row.tags,
        thumbnailUrl: row.thumbnail_url,
        metadata: row.metadata,
        displayOrder: row.display_order,
    };
}
//# sourceMappingURL=libraryTools.js.map