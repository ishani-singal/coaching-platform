"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLibraryItem = addLibraryItem;
exports.updateLibraryItem = updateLibraryItem;
exports.markLibraryItemEmbedded = markLibraryItemEmbedded;
exports.removeLibraryItem = removeLibraryItem;
exports.reorderLibraryItems = reorderLibraryItems;
exports.getLibraryItemByUrl = getLibraryItemByUrl;
exports.getLibraryByCoach = getLibraryByCoach;
exports.getUnembeddedLibraryItems = getUnembeddedLibraryItems;
exports.addBook = addBook;
exports.addArticle = addArticle;
exports.addPdf = addPdf;
exports.getCoachesWithYoutubeChannel = getCoachesWithYoutubeChannel;
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
        buy_link: item.buyLink,
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapItem(data);
}
async function updateLibraryItem(itemId, patch) {
    const update = {};
    if (patch.title !== undefined)
        update.title = patch.title;
    if (patch.description !== undefined)
        update.description = patch.description;
    if (patch.tags !== undefined)
        update.tags = patch.tags;
    if (patch.displayOrder !== undefined)
        update.display_order = patch.displayOrder;
    if (patch.metadata !== undefined)
        update.metadata = patch.metadata;
    if (patch.thumbnailUrl !== undefined)
        update.thumbnail_url = patch.thumbnailUrl;
    if (patch.url !== undefined)
        update.url = patch.url;
    if (patch.buyLink !== undefined)
        update.buy_link = patch.buyLink;
    await sdk_1.supabase.from('coach_library_items').update(update).eq('item_id', itemId);
}
async function markLibraryItemEmbedded(itemId) {
    await sdk_1.supabase
        .from('coach_library_items')
        .update({ embedded_at: new Date().toISOString() })
        .eq('item_id', itemId);
}
async function removeLibraryItem(itemId) {
    await sdk_1.supabase.from('coach_library_items').delete().eq('item_id', itemId);
}
async function reorderLibraryItems(coachId, orderedItemIds) {
    await Promise.all(orderedItemIds.map((id, idx) => sdk_1.supabase.from('coach_library_items').update({ display_order: idx }).eq('item_id', id).eq('coach_id', coachId)));
}
async function getLibraryItemByUrl(coachId, url) {
    const { data } = await sdk_1.supabase
        .from('coach_library_items')
        .select('*')
        .eq('coach_id', coachId)
        .eq('url', url)
        .maybeSingle();
    return data ? mapItem(data) : null;
}
async function getLibraryByCoach(coachId, itemType) {
    let q = sdk_1.supabase.from('coach_library_items').select('*').eq('coach_id', coachId).order('display_order');
    if (itemType)
        q = q.eq('item_type', itemType);
    const { data } = await q;
    return (data ?? []).map(mapItem);
}
async function getUnembeddedLibraryItems(coachId) {
    const { data } = await sdk_1.supabase
        .from('coach_library_items')
        .select('*')
        .eq('coach_id', coachId)
        .is('embedded_at', null);
    return (data ?? []).map(mapItem);
}
async function addBook(coachId, title, author, fileUrl, buyLink, description, tags, thumbnailUrl) {
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
async function addArticle(coachId, title, url, description, tags) {
    return addLibraryItem(coachId, { itemType: 'article', title, url, description, tags, metadata: {}, displayOrder: 0 });
}
async function addPdf(coachId, title, fileUrl, description, tags) {
    return addLibraryItem(coachId, { itemType: 'pdf', title, url: fileUrl, description, tags, metadata: {}, displayOrder: 0 });
}
async function getCoachesWithYoutubeChannel() {
    const { data, error } = await sdk_1.supabase
        .from('coach_library_items')
        .select('coach_id, metadata')
        .eq('item_type', 'youtube');
    if (error)
        throw new Error(error.message);
    const seen = new Map();
    for (const row of data ?? []) {
        const meta = row.metadata;
        const channelUrl = meta?.channelUrl;
        if (channelUrl && !seen.has(row.coach_id)) {
            seen.set(row.coach_id, channelUrl);
        }
    }
    return Array.from(seen.entries()).map(([coachId, channelUrl]) => ({ coachId, channelUrl }));
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
        buyLink: row.buy_link,
        embeddedAt: row.embedded_at,
        transcript: row.transcript,
        transcriptSource: row.transcript_source,
        transcriptLanguage: row.transcript_language,
        chunksIndexed: row.chunks_indexed ?? false,
    };
}
//# sourceMappingURL=libraryTools.js.map