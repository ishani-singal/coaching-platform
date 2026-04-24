import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge, addLibraryItem, updateLibraryItem, removeLibraryItem, reorderLibraryItems, getLibraryByCoach } from '@coaching/tools';
import { syncYoutubeChannel, addBook, addArticle, addPdf } from '@coaching/skills';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_COACH_LIBRARY_PORT ?? '3003', 10);
const AGENT_ID = 'coaching-coach-library';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Coach Library',
  version:         '1.0.0',
  description:     'Build a library of YouTube videos, books and articles. Sync from YouTube channel.',
  icon:            '🎬',
  domain:          ['content', 'library', 'coaching'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'card-feed' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      { type: 'text-summary', id: 'cl-summary',      title: 'Library Summary',        dataKey: 'summary' },
      { type: 'card-list',    id: 'cl-items',         title: 'Library Items',           dataKey: 'items', titleKey: 'title', subtitleKey: 'itemType', metaKey: 'description',
        actionButton: { label: 'Remove', actionName: 'remove_item', paramKey: 'itemId' },
      },
      { type: 'action-form',  id: 'cl-sync-youtube', title: 'Sync YouTube Channel',   action: 'sync_youtube', submitLabel: 'Sync',
        fields: [{ name: 'channelUrl', label: 'Channel URL', inputType: 'text', required: true }],
      },
      { type: 'action-form',  id: 'cl-add-book',     title: 'Add Book',               action: 'add_book', submitLabel: 'Add Book',
        fields: [
          { name: 'title',       label: 'Title',       inputType: 'text',     required: true },
          { name: 'author',      label: 'Author',      inputType: 'text',     required: true },
          { name: 'description', label: 'Description', inputType: 'textarea', required: true },
          { name: 'url',         label: 'URL',         inputType: 'text',     required: false },
        ],
      },
      { type: 'action-form',  id: 'cl-add-article',  title: 'Add Article',            action: 'add_article', submitLabel: 'Add Article',
        fields: [
          { name: 'title',       label: 'Title',       inputType: 'text',     required: true },
          { name: 'url',         label: 'URL',         inputType: 'text',     required: true },
          { name: 'description', label: 'Description', inputType: 'textarea', required: true },
        ],
      },
    ],
  },
  actions: [
    { name: 'sync_youtube', description: 'Sync YouTube channel videos',  params: { channelUrl: { type: 'string', required: true, description: '' } } },
    { name: 'add_book',     description: 'Add a book to the library',    params: { title: { type: 'string', required: true, description: '' }, author: { type: 'string', required: true, description: '' }, url: { type: 'string', required: false, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'add_article',  description: 'Add an article',               params: { title: { type: 'string', required: true, description: '' }, url: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'add_pdf',      description: 'Add a PDF resource',           params: { title: { type: 'string', required: true, description: '' }, fileUrl: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'add_podcast',  description: 'Add a podcast episode',        params: { title: { type: 'string', required: true, description: '' }, url: { type: 'string', required: true, description: '' }, description: { type: 'string', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'tag_items',    description: 'Tag multiple items',           params: { itemIds: { type: 'array', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'reorder',      description: 'Reorder library items',        params: { orderedItemIds: { type: 'array', required: true, description: '' } } },
    { name: 'remove_item',  description: 'Remove a library item',        params: { itemId: { type: 'string', required: true, description: '' } } },
    { name: 'get_library',  description: 'Get library items',            params: { itemType: { type: 'string', required: false, description: '' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const library = await getLibraryByCoach(req.userId);
  const byType  = library.reduce((acc: Record<string, number>, item) => { acc[item.itemType] = (acc[item.itemType] ?? 0) + 1; return acc; }, {});
  const untagged = library.filter(i => i.tags.length === 0).length;

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   Object.entries(byType).map(([k, v]) => `${v} ${k}(s)`).join(' · ') || 'Empty library',
      keyEntities: library.slice(0, 5).map(i => ({ id: i.itemId, type: i.itemType, label: i.title, attributes: {} })),
      recentEvents: [],
      pendingActions: untagged > 0
        ? [{ type: 'tag_items', label: `${untagged} item(s) untagged`, priority: 'low' as const }]
        : [],
      rawContext: {
        items: library.map(i => ({ itemId: i.itemId, title: i.title, itemType: i.itemType, description: i.description?.slice(0, 100) ?? '' })),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'sync_youtube':
      return { success: true, message: 'Synced', data: await syncYoutubeChannel(uid, p.channelUrl as string) };

    case 'add_book':
      return { success: true, message: 'Book added', data: await addBook(uid, p.title as string, p.author as string, p.url as string, p.description as string, p.tags as string[]) as unknown as Record<string, unknown> };

    case 'add_article':
      return { success: true, message: 'Article added', data: await addArticle(uid, p.title as string, p.url as string, p.description as string, p.tags as string[]) as unknown as Record<string, unknown> };

    case 'add_pdf':
      return { success: true, message: 'PDF added', data: await addPdf(uid, p.title as string, p.fileUrl as string, p.description as string, p.tags as string[]) as unknown as Record<string, unknown> };

    case 'add_podcast':
      return { success: true, message: 'Podcast added', data: await addLibraryItem(uid, { itemType: 'podcast', title: p.title as string, url: p.url as string, description: p.description as string, tags: p.tags as string[], metadata: {}, displayOrder: 0 }) as unknown as Record<string, unknown> };

    case 'tag_items':
      await Promise.all((p.itemIds as string[]).map(id => updateLibraryItem(id, { tags: p.tags as string[] })));
      return { success: true, message: 'Items tagged' };

    case 'reorder':
      await reorderLibraryItems(uid, p.orderedItemIds as string[]);
      return { success: true, message: 'Reordered' };

    case 'remove_item':
      await removeLibraryItem(p.itemId as string);
      return { success: true, message: 'Removed' };

    case 'get_library':
      return { success: true, message: 'Library', data: { items: await getLibraryByCoach(uid, p.itemType as never) } };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
