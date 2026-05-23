"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPersonaContext = buildPersonaContext;
exports.getLatestPersonaSnapshot = getLatestPersonaSnapshot;
exports.savePersonaSnapshot = savePersonaSnapshot;
exports.indexPdfLibraryItems = indexPdfLibraryItems;
const sdk_1 = require("@coaching/sdk");
const pdfTools_1 = require("../embeddings/pdfTools");
const pineconeTools_1 = require("../embeddings/pineconeTools");
/** Build a text corpus from user_profiles + coach_library_items for LLM persona extraction. */
async function buildPersonaContext(coachId) {
    const [profileResult, libraryResult] = await Promise.all([
        sdk_1.supabase
            .from('user_profiles')
            .select('display_name, bio, coaching_type, social_media')
            .eq('user_id', coachId)
            .single(),
        sdk_1.supabase
            .from('coach_library_items')
            .select('item_type, title, description, tags')
            .eq('coach_id', coachId)
            .order('display_order'),
    ]);
    const profile = profileResult.data;
    const items = libraryResult.data ?? [];
    const lines = [];
    if (profile) {
        lines.push(`Coach: ${profile.display_name}`);
        if (profile.coaching_type)
            lines.push(`Coaching specialty: ${profile.coaching_type.replace(/_/g, ' ')}`);
        if (profile.bio)
            lines.push(`Bio: ${profile.bio}`);
        const social = (profile.social_media ?? {});
        if (social.linkedin)
            lines.push(`LinkedIn: ${social.linkedin}`);
        if (social.instagram)
            lines.push(`Instagram: ${social.instagram}`);
    }
    if (items.length > 0) {
        lines.push('\nLibrary:');
        for (const item of items) {
            const tags = (item.tags ?? []).join(', ');
            const desc = item.description ?? '';
            lines.push(`[${item.item_type}] ${item.title}${desc ? ` — ${desc}` : ''}${tags ? ` (tags: ${tags})` : ''}`);
        }
    }
    return { corpus: lines.join('\n'), libraryItemCount: items.length };
}
async function getLatestPersonaSnapshot(coachId) {
    const { data } = await sdk_1.supabase
        .from('persona_snapshots')
        .select('*')
        .eq('coach_id', coachId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ? mapSnapshot(data) : null;
}
async function savePersonaSnapshot(coachId, tone, style, summary, raw) {
    const { data: latest } = await sdk_1.supabase
        .from('persona_snapshots')
        .select('version')
        .eq('coach_id', coachId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data, error } = await sdk_1.supabase
        .from('persona_snapshots')
        .insert({ coach_id: coachId, version: nextVersion, tone, style, summary, raw_snapshot: raw })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapSnapshot(data);
}
function mapSnapshot(row) {
    return {
        id: row.id,
        coachId: row.coach_id,
        version: row.version,
        tone: row.tone,
        style: row.style,
        summary: row.summary,
        rawSnapshot: row.raw_snapshot,
    };
}
/**
 * For every book/pdf library item that has a URL, fetch and parse the PDF,
 * then upsert the text chunks into Pinecone so they are available for RAG.
 * Skips items where the URL is missing or the fetch/parse fails.
 */
async function indexPdfLibraryItems(coachId) {
    const { data: items } = await sdk_1.supabase
        .from('coach_library_items')
        .select('item_id, title, item_type, url')
        .eq('coach_id', coachId)
        .in('item_type', ['book', 'pdf'])
        .not('url', 'is', null);
    if (!items?.length)
        return;
    await Promise.allSettled(items.map(async (item) => {
        const url = item.url;
        const text = await (0, pdfTools_1.extractPdfText)(url);
        if (!text.trim())
            return;
        // Rough chunk: every 2000 chars (~500 tokens)
        const chunkSize = 2000;
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            const c = text.slice(i, i + chunkSize).trim();
            if (c)
                chunks.push(c);
        }
        if (!chunks.length)
            return;
        await (0, pineconeTools_1.upsertLibraryChunks)(coachId, item.item_id, chunks, {
            source: 'pdf',
            title: item.title,
            itemType: item.item_type,
        });
    }));
}
//# sourceMappingURL=personaTools.js.map