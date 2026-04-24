"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const PORT = parseInt(process.env.AGENT_COACH_LIBRARY_PORT ?? '3003', 10);
const AGENT_ID = 'coaching-coach-library';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Coach Library',
    version: '1.0.0',
    description: 'Build a library of YouTube videos, books and articles. Sync from YouTube channel.',
    icon: '🎬',
    domain: ['content', 'library', 'coaching'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'card-feed' },
    panelSpec: {
        layout: 'two-column',
        sections: [
            { type: 'text-summary', id: 'cl-summary', title: 'Library Summary', dataKey: 'summary' },
            { type: 'card-list', id: 'cl-items', title: 'Library Items', dataKey: 'items', titleKey: 'title', subtitleKey: 'itemType', metaKey: 'description',
                actionButton: { label: 'Remove', actionName: 'remove_item', paramKey: 'itemId' },
            },
            { type: 'action-form', id: 'cl-sync-youtube', title: 'Sync YouTube Channel', action: 'sync_youtube', submitLabel: 'Sync',
                fields: [{ name: 'channelUrl', label: 'Channel URL', inputType: 'text', required: true }],
            },
            { type: 'action-form', id: 'cl-add-book', title: 'Add Book', action: 'add_book', submitLabel: 'Add Book',
                fields: [
                    { name: 'title', label: 'Title', inputType: 'text', required: true },
                    { name: 'author', label: 'Author', inputType: 'text', required: true },
                    { name: 'description', label: 'Description', inputType: 'textarea', required: true },
                    { name: 'url', label: 'URL', inputType: 'text', required: false },
                ],
            },
            { type: 'action-form', id: 'cl-add-article', title: 'Add Article', action: 'add_article', submitLabel: 'Add Article',
                fields: [
                    { name: 'title', label: 'Title', inputType: 'text', required: true },
                    { name: 'url', label: 'URL', inputType: 'text', required: true },
                    { name: 'description', label: 'Description', inputType: 'textarea', required: true },
                ],
            },
        ],
    },
    actions: [
        { name: 'sync_youtube', description: 'Sync YouTube channel videos', params: { channelUrl: { type: 'string', required: true, description: '' } } },
        { name: 'add_book', description: 'Add a book to the library', params: { title: { type: 'string', required: true, description: '' }, author: { type: 'string', required: true, description: '' }, url: { type: 'string', required: false, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
        { name: 'add_article', description: 'Add an article', params: { title: { type: 'string', required: true, description: '' }, url: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
        { name: 'add_pdf', description: 'Add a PDF resource', params: { title: { type: 'string', required: true, description: '' }, fileUrl: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
        { name: 'add_podcast', description: 'Add a podcast episode', params: { title: { type: 'string', required: true, description: '' }, url: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
        { name: 'tag_items', description: 'Tag multiple items', params: { itemIds: { type: 'array', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
        { name: 'reorder', description: 'Reorder library items', params: { orderedItemIds: { type: 'array', required: true, description: '' } } },
        { name: 'remove_item', description: 'Remove a library item', params: { itemId: { type: 'string', required: true, description: '' } } },
        { name: 'get_library', description: 'Get library items', params: { itemType: { type: 'string', required: false, description: '' } } },
    ],
};
async function onContext(req) {
    const library = await (0, tools_1.getLibraryByCoach)(req.userId);
    const byType = library.reduce((acc, item) => { acc[item.itemType] = (acc[item.itemType] ?? 0) + 1; return acc; }, {});
    const untagged = library.filter(i => i.tags.length === 0).length;
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: Object.entries(byType).map(([k, v]) => `${v} ${k}(s)`).join(' · ') || 'Empty library',
            keyEntities: library.slice(0, 5).map(i => ({ id: i.itemId, type: i.itemType, label: i.title, attributes: {} })),
            recentEvents: [],
            pendingActions: untagged > 0
                ? [{ type: 'tag_items', label: `${untagged} item(s) untagged`, priority: 'low' }]
                : [],
            rawContext: {
                items: library.map(i => ({ itemId: i.itemId, title: i.title, itemType: i.itemType, description: i.description?.slice(0, 100) ?? '' })),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'sync_youtube':
            return { success: true, message: 'Synced', data: await (0, skills_1.syncYoutubeChannel)(uid, p.channelUrl) };
        case 'add_book':
            return { success: true, message: 'Book added', data: await (0, skills_1.addBook)(uid, p.title, p.author, p.url, p.description, p.tags) };
        case 'add_article':
            return { success: true, message: 'Article added', data: await (0, skills_1.addArticle)(uid, p.title, p.url, p.description, p.tags) };
        case 'add_pdf':
            return { success: true, message: 'PDF added', data: await (0, skills_1.addPdf)(uid, p.title, p.fileUrl, p.description, p.tags) };
        case 'add_podcast':
            return { success: true, message: 'Podcast added', data: await (0, tools_1.addLibraryItem)(uid, { itemType: 'podcast', title: p.title, url: p.url, description: p.description, tags: p.tags, metadata: {}, displayOrder: 0 }) };
        case 'tag_items':
            await Promise.all(p.itemIds.map(id => (0, tools_1.updateLibraryItem)(id, { tags: p.tags })));
            return { success: true, message: 'Items tagged' };
        case 'reorder':
            await (0, tools_1.reorderLibraryItems)(uid, p.orderedItemIds);
            return { success: true, message: 'Reordered' };
        case 'remove_item':
            await (0, tools_1.removeLibraryItem)(p.itemId);
            return { success: true, message: 'Removed' };
        case 'get_library':
            return { success: true, message: 'Library', data: { items: await (0, tools_1.getLibraryByCoach)(uid, p.itemType) } };
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map