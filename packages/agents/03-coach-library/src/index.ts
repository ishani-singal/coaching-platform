import path from 'path';
import dotenv from 'dotenv';
// Load root .env — override:true forces .env to win over any inherited shell env vars
const _dotenvPath = path.resolve(__dirname, '../../../../.env');
const _envResult = dotenv.config({ path: _dotenvPath, override: true });
if (_envResult.error) {
  console.warn('[agent-03] Failed to load .env from', _dotenvPath, '—', _envResult.error.message);
} else {
  console.log('[agent-03] Loaded .env | LLM_PROVIDER:', process.env.LLM_PROVIDER, '| EMBEDDING_PROVIDER:', process.env.EMBEDDING_PROVIDER ?? '(not set)');
}

import { createAgentServer, AgentManifest, ContextRequest, ActionRequest, supabase } from '@coaching/sdk';
import { configureBridge, addLibraryItem, updateLibraryItem, removeLibraryItem, reorderLibraryItems, getLibraryByCoach, getCoachesWithYoutubeChannel, addBook, addArticle, addPdf } from '@coaching/tools';
import { syncYoutubeChannel, transcribeLibraryItem, transcribeAllPending, transcribeByType, embedManualTranscript } from '@coaching/skills';
import cron from 'node-cron';

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
    { name: 'add_video',    description: 'Add a single YouTube video by URL', params: { title: { type: 'string', required: true, description: '' }, url: { type: 'string', required: true, description: '' } } },
    { name: 'add_note',     description: 'Add a text note to the library',   params: { title: { type: 'string', required: true, description: '' }, body: { type: 'string', required: true, description: '' } } },
    { name: 'tag_items',    description: 'Tag multiple items',           params: { itemIds: { type: 'array', required: true, description: '' }, tags: { type: 'array', required: true, description: '' } } },
    { name: 'reorder',      description: 'Reorder library items',        params: { orderedItemIds: { type: 'array', required: true, description: '' } } },
    { name: 'remove_item',  description: 'Remove a library item',        params: { itemId: { type: 'string', required: true, description: '' } } },
    { name: 'update_item',  description: 'Update a library item fields',  params: { itemId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: false, description: '' }, description: { type: 'string', required: false, description: '' }, url: { type: 'string', required: false, description: '' }, thumbnailUrl: { type: 'string', required: false, description: '' }, tags: { type: 'array', required: false, description: '' } } },
    { name: 'get_library',           description: 'Get library items',                         params: { itemType: { type: 'string', required: false, description: '' } } },
    { name: 'transcribe_item',       description: 'Transcribe a library item and index to RAG', params: { itemId: { type: 'string', required: true, description: '' } } },
    { name: 'save_and_index_transcript', description: 'Save a manually-entered transcript and embed into RAG', params: { itemId: { type: 'string', required: true, description: '' }, transcript: { type: 'string', required: true, description: '' } } },
    { name: 'get_whisper_stats', description: 'Return total whisper-transcribed minutes for videos and podcasts', params: {} },
    { name: 'transcribe_all_pending',description: 'Transcribe all unembedded library items',   params: {} },
    { name: 'transcribe_by_type',      description: 'Transcribe unembedded items of specific types', params: { types: { type: 'array', required: true, description: 'Array of item types to transcribe, e.g. ["youtube","pdf"]' } } },
    { name: 'update_book_buy_link',  description: 'Set or update the purchase link for a book', params: { itemId: { type: 'string', required: true, description: '' }, buyLink: { type: 'string', required: true, description: '' } } },
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

    case 'add_book': {
      const book = await addBook(uid, p.title as string, (p.author ?? '') as string, p.url as string | undefined, p.buyLink as string | undefined, p.description as string, (p.tags ?? []) as string[], p.thumbnailUrl as string | undefined);
      const fileUrl = book.url;
      const fileType = fileUrl ? (fileUrl.toLowerCase().split('?')[0].endsWith('.docx') || fileUrl.toLowerCase().split('?')[0].endsWith('.doc') ? 'Word' : 'PDF') : 'no file';
      console.log(`[agent-03] ✅ Book saved — itemId=${book.itemId} title="${book.title}" file=${fileType}`);
      console.log(`[agent-03] 📄 Starting RAG indexing for book ${book.itemId}…`);
      transcribeLibraryItem(uid, book.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for book ${book.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for book ${book.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'Book added and indexing started', data: book as unknown as Record<string, unknown> };
    }

    case 'add_article': {
      const article = await addArticle(uid, p.title as string, p.url as string, p.description as string, p.tags as string[]);
      console.log(`[agent-03] ✅ Article saved — itemId=${article.itemId} title="${article.title}"`);
      console.log(`[agent-03] 📄 Starting RAG indexing for article ${article.itemId}…`);
      transcribeLibraryItem(uid, article.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for article ${article.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for article ${article.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'Article added and indexing started', data: article as unknown as Record<string, unknown> };
    }

    case 'add_pdf': {
      const pdf = await addPdf(uid, p.title as string, p.fileUrl as string, p.description as string, p.tags as string[]);
      const pdfFileType = (p.fileUrl as string ?? '').toLowerCase().split('?')[0];
      const pdfType = pdfFileType.endsWith('.docx') || pdfFileType.endsWith('.doc') ? 'Word' : 'PDF';
      console.log(`[agent-03] ✅ PDF/doc saved — itemId=${pdf.itemId} title="${pdf.title}" file=${pdfType}`);
      console.log(`[agent-03] 📄 Starting RAG indexing for pdf ${pdf.itemId}…`);
      transcribeLibraryItem(uid, pdf.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for pdf ${pdf.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for pdf ${pdf.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'PDF added and indexing started', data: pdf as unknown as Record<string, unknown> };
    }

    case 'add_podcast': {
      const podcast = await addLibraryItem(uid, { itemType: 'podcast', title: p.title as string, url: p.url as string, description: p.description as string, tags: p.tags as string[], thumbnailUrl: p.thumbnailUrl as string | undefined, metadata: {}, displayOrder: 0 });
      console.log(`[agent-03] ✅ Podcast saved — itemId=${podcast.itemId} title="${podcast.title}"`);
      console.log(`[agent-03] 🎙️ Starting RAG indexing for podcast ${podcast.itemId}…`);
      transcribeLibraryItem(uid, podcast.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for podcast ${podcast.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for podcast ${podcast.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'Podcast added and indexing started', data: podcast as unknown as Record<string, unknown> };
    }

    case 'add_video': {
      const video = await addLibraryItem(uid, { itemType: 'youtube', title: p.title as string, url: p.url as string, tags: [], metadata: {}, displayOrder: 0 });
      console.log(`[agent-03] ✅ Video saved — itemId=${video.itemId} title="${video.title}" url=${p.url}`);
      console.log(`[agent-03] 🎬 Starting RAG indexing for video ${video.itemId}…`);
      transcribeLibraryItem(uid, video.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for video ${video.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for video ${video.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'Video added and indexing started', data: video as unknown as Record<string, unknown> };
    }

    case 'add_note': {
      const note = await addLibraryItem(uid, { itemType: 'note', title: p.title as string, description: p.body as string, tags: [], metadata: {}, displayOrder: 0 });
      console.log(`[agent-03] ✅ Note saved — itemId=${note.itemId} title="${note.title}"`);
      console.log(`[agent-03] 📝 Starting RAG indexing for note ${note.itemId}…`);
      transcribeLibraryItem(uid, note.itemId)
        .then(result => {
          console.log(`[agent-03] ✅ RAG complete for note ${note.itemId} — source=${result.source}, chars=${result.charCount}`);
        })
        .catch(err => {
          console.error(`[agent-03] ❌ RAG failed for note ${note.itemId}:`, (err as Error).message);
        });
      return { success: true, message: 'Note added and indexing started', data: note as unknown as Record<string, unknown> };
    }

    case 'tag_items':
      await Promise.all((p.itemIds as string[]).map(id => updateLibraryItem(id, { tags: p.tags as string[] })));
      return { success: true, message: 'Items tagged' };

    case 'reorder':
      await reorderLibraryItems(uid, p.orderedItemIds as string[]);
      return { success: true, message: 'Reordered' };

    case 'remove_item':
      await removeLibraryItem(p.itemId as string);
      return { success: true, message: 'Removed' };

    case 'update_item': {
      const patch: Partial<import('@coaching/sdk').LibraryItem> = {};
      if (p.title        !== undefined) patch.title        = p.title as string;
      if (p.description  !== undefined) patch.description  = p.description as string;
      if (p.url          !== undefined) patch.url          = p.url as string;
      if (p.thumbnailUrl !== undefined) patch.thumbnailUrl = p.thumbnailUrl as string;
      if (p.tags         !== undefined) patch.tags         = p.tags as string[];
      if (p.buyLink      !== undefined) patch.buyLink      = p.buyLink as string;
      if (p.metadata     !== undefined) patch.metadata     = p.metadata as Record<string, unknown>;
      await updateLibraryItem(p.itemId as string, patch);
      return { success: true, message: 'Updated' };
    }

    case 'get_library': {
      const items = await getLibraryByCoach(uid, p.itemType as never);
      return { success: true, message: 'Library', data: { items } };
    }

    case 'transcribe_item': {
      console.log(`[agent-03] 🔄 Manual transcribe_item triggered — itemId=${p.itemId}, coachId=${uid}`);
      console.log(`[agent-03] 📄 Starting RAG indexing for item ${p.itemId}…`);
      const result = await transcribeLibraryItem(uid, p.itemId as string);
      console.log(`[agent-03] ✅ RAG complete for item ${p.itemId} — source=${result.source}, chars=${result.charCount}`);
      return { success: true, message: `Transcribed via ${result.source} (${result.charCount} chars)` };
    }

    case 'save_and_index_transcript': {
      console.log(`[agent-03] 📝 Manual transcript save — itemId=${p.itemId}, chars=${(p.transcript as string).length}`);
      const manualResult = await embedManualTranscript(uid, p.itemId as string, p.transcript as string);
      return { success: true, message: `Manual transcript indexed (${manualResult.charCount} chars)` };
    }

    case 'get_whisper_stats': {
      const { data: whisperItems } = await supabase
        .from('coach_library_items')
        .select('metadata, transcript')
        .eq('coach_id', uid)
        .eq('transcript_source', 'whisper')
        .in('item_type', ['youtube', 'podcast']);
      // Parse ISO 8601 duration (PT#H#M#S) into seconds
      const parseIso8601Duration = (d: string): number => {
        const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!m) return 0;
        return (parseInt(m[1] ?? '0') * 3600) + (parseInt(m[2] ?? '0') * 60) + parseInt(m[3] ?? '0');
      };
      const totalSeconds = (whisperItems ?? []).reduce((sum, row) => {
        const dur = (row.metadata as Record<string, unknown> | null)?.duration as string | undefined;
        if (dur) return sum + parseIso8601Duration(dur);
        // Fallback: estimate from char count (~800 chars/min)
        return sum + (((row.transcript as string | null)?.length ?? 0) / 800) * 60;
      }, 0);
      const totalItems = (whisperItems ?? []).length;
      const totalMinutes = Math.round((totalSeconds / 60) * 10) / 10;
      return { success: true, message: 'Whisper stats', data: { totalMinutes, totalItems } };
    }

    case 'transcribe_all_pending': {
      const result = await transcribeAllPending(uid);
      return { success: true, message: `Processed ${result.processed} item(s), ${result.failed} failed` };
    }

    case 'transcribe_by_type': {
      const types = (p.types as string[]) ?? [];
      if (!types.length) return { success: false, message: 'No types specified' };
      const result = await transcribeByType(uid, types);
      return { success: true, message: `Processed ${result.processed} item(s), ${result.failed} failed` };
    }

    case 'update_book_buy_link':
      await updateLibraryItem(p.itemId as string, { buyLink: p.buyLink as string });
      return { success: true, message: 'Buy link updated' };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

async function runDailyMaintenance(): Promise<void> {
  console.log(`[${AGENT_ID}] Starting scheduled maintenance`);

  // 1. Sync YouTube channels
  const coaches = await getCoachesWithYoutubeChannel();
  console.log(`[${AGENT_ID}] Found ${coaches.length} coach(es) with a registered channel URL`);
  let syncSuccess = 0, syncError = 0;
  for (const { coachId, channelUrl } of coaches) {
    try {
      const result = await syncYoutubeChannel(coachId, channelUrl);
      console.log(`[${AGENT_ID}] YouTube sync coach=${coachId} added=${result.added} updated=${result.updated}`);
      syncSuccess++;
    } catch (err) {
      console.error(`[${AGENT_ID}] YouTube sync failed coach=${coachId}: ${(err as Error).message}`);
      syncError++;
    }
  }
  console.log(`[${AGENT_ID}] YouTube sync complete — success=${syncSuccess} errors=${syncError}`);

  // 2. Transcribe all pending items (new videos added by sync + any unprocessed items)
  for (const { coachId } of coaches) {
    try {
      const result = await transcribeAllPending(coachId);
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[${AGENT_ID}] Transcription coach=${coachId} processed=${result.processed} failed=${result.failed}`);
      }
    } catch (err) {
      console.error(`[${AGENT_ID}] Transcription failed coach=${coachId}: ${(err as Error).message}`);
    }
  }
  console.log(`[${AGENT_ID}] Maintenance complete`);
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

export { app as coachLibraryApp };

if (process.env.MULTI_AGENT_MODE !== 'true') {
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}

cron.schedule('0 2 * * *', () => {
  runDailyMaintenance().catch((err: Error) => console.error(`[${AGENT_ID}] Unhandled maintenance error: ${err.message}`));
}, { timezone: 'UTC' });
console.log(`[${AGENT_ID}] YouTube auto-sync scheduled at 02:00 UTC daily`);
