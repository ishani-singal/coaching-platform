"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncYoutubeChannel = syncYoutubeChannel;
exports.addBook = addBook;
exports.addArticle = addArticle;
exports.addPdf = addPdf;
exports.organizeLibrary = organizeLibrary;
exports.getLibraryForPublicSite = getLibraryForPublicSite;
const tools_1 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function syncYoutubeChannel(coachId, channelUrl) {
    const videos = await (0, tools_1.fetchChannelVideos)(channelUrl);
    let added = 0, updated = 0;
    for (const v of videos) {
        const { data: existing } = await sdk_1.supabase
            .from('coach_library_items')
            .select('item_id')
            .eq('coach_id', coachId)
            .eq('url', `https://youtube.com/watch?v=${v.videoId}`)
            .maybeSingle();
        if (existing) {
            await (0, tools_1.updateLibraryItem)(existing.item_id, {
                title: v.title,
                description: v.description,
                thumbnailUrl: v.thumbnailUrl,
                metadata: { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt },
            });
            updated++;
        }
        else {
            await (0, tools_1.addLibraryItem)(coachId, {
                itemType: 'youtube',
                title: v.title,
                url: `https://youtube.com/watch?v=${v.videoId}`,
                description: v.description,
                thumbnailUrl: v.thumbnailUrl,
                tags: [],
                metadata: { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt, channelTitle: v.channelTitle },
                displayOrder: 0,
            });
            added++;
        }
    }
    return { added, updated };
}
async function addBook(coachId, title, author, url, description, tags) {
    return (0, tools_1.addLibraryItem)(coachId, { itemType: 'book', title, url, description, tags, metadata: { author }, displayOrder: 0 });
}
async function addArticle(coachId, title, url, description, tags) {
    return (0, tools_1.addLibraryItem)(coachId, { itemType: 'article', title, url, description, tags, metadata: {}, displayOrder: 0 });
}
async function addPdf(coachId, title, fileUrl, description, tags) {
    return (0, tools_1.addLibraryItem)(coachId, { itemType: 'pdf', title, url: fileUrl, description, tags, metadata: {}, displayOrder: 0 });
}
async function organizeLibrary(coachId, patches) {
    await Promise.all(patches.map(p => (0, tools_1.updateLibraryItem)(p.itemId, { tags: p.tags, displayOrder: p.displayOrder })));
}
async function getLibraryForPublicSite(coachId) {
    const [youtube, books, articles, podcasts] = await Promise.all([
        (0, tools_1.getLibraryByCoach)(coachId, 'youtube'),
        (0, tools_1.getLibraryByCoach)(coachId, 'book'),
        (0, tools_1.getLibraryByCoach)(coachId, 'article'),
        (0, tools_1.getLibraryByCoach)(coachId, 'podcast'),
    ]);
    return { youtube, books, articles, podcasts };
}
//# sourceMappingURL=coachLibrarySkill.js.map