"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreLibraryItemsForClient = scoreLibraryItemsForClient;
exports.scorePackagesForClient = scorePackagesForClient;
exports.getRecommendationSettings = getRecommendationSettings;
exports.updateRecommendationSettings = updateRecommendationSettings;
exports.semanticRecommendations = semanticRecommendations;
exports.formatRecommendationInPersona = formatRecommendationInPersona;
exports.streamChatInPersona = streamChatInPersona;
exports.toPersonaRecommendations = toPersonaRecommendations;
const llmClient_1 = require("../llm/llmClient");
const sdk_1 = require("@coaching/sdk");
const pineconeTools_1 = require("../embeddings/pineconeTools");
const libraryTools_1 = require("../crm/libraryTools");
// ── Legacy keyword scoring (kept for fallback) ────────────────────────────────
function scoreLibraryItemsForClient(items, profile) {
    const focusAreas = profile.preferences.focusAreas ?? [];
    const goalWords = (profile.goals ?? '').toLowerCase().split(/\s+/);
    return items.map(item => {
        const tagOverlap = item.tags.filter(t => focusAreas.includes(t)).length;
        const descWords = (item.description ?? '').toLowerCase().split(/\s+/);
        const keywordMatch = goalWords.filter(w => w.length > 3 && descWords.includes(w)).length;
        const score = tagOverlap * 2 + keywordMatch;
        return { item, score, matchedGoals: item.tags.filter(t => focusAreas.includes(t)) };
    }).sort((a, b) => b.score - a.score);
}
function scorePackagesForClient(packages, profile) {
    const focusAreas = profile.preferences.focusAreas ?? [];
    const goalWords = (profile.goals ?? '').toLowerCase().split(/\s+/);
    return packages.map(pkg => {
        const descWords = ((pkg.description ?? '') + ' ' + pkg.title).toLowerCase().split(/\s+/);
        const keywordMatch = goalWords.filter(w => w.length > 3 && descWords.includes(w)).length;
        return { item: pkg, score: keywordMatch, matchedGoals: focusAreas };
    }).sort((a, b) => b.score - a.score);
}
// ── Recommendation settings CRUD ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    tagWeight: 2.0,
    semanticWeight: 1.0,
    recencyBoost: 0.0,
    preferredTypes: [],
    maxResults: 5,
};
async function getRecommendationSettings(coachId) {
    const { data } = await sdk_1.supabase
        .from('coach_recommendation_settings')
        .select('*')
        .eq('coach_id', coachId)
        .maybeSingle();
    if (!data)
        return { coachId, ...DEFAULT_SETTINGS };
    return {
        coachId,
        tagWeight: data.tag_weight,
        semanticWeight: data.semantic_weight,
        recencyBoost: data.recency_boost,
        preferredTypes: data.preferred_types,
        maxResults: data.max_results,
    };
}
async function updateRecommendationSettings(coachId, patch) {
    const update = { coach_id: coachId, updated_at: new Date().toISOString() };
    if (patch.tagWeight !== undefined)
        update.tag_weight = patch.tagWeight;
    if (patch.semanticWeight !== undefined)
        update.semantic_weight = patch.semanticWeight;
    if (patch.recencyBoost !== undefined)
        update.recency_boost = patch.recencyBoost;
    if (patch.preferredTypes !== undefined)
        update.preferred_types = patch.preferredTypes;
    if (patch.maxResults !== undefined)
        update.max_results = patch.maxResults;
    const { error } = await sdk_1.supabase
        .from('coach_recommendation_settings')
        .upsert(update, { onConflict: 'coach_id' });
    if (error)
        throw new Error(error.message);
}
// ── Semantic recommendations (Pinecone-backed) ────────────────────────────────
const RECOMMENDATION_RESOURCE_TYPES = new Set(['book', 'article', 'podcast', 'youtube', 'pdf', 'file']);
const MAX_RECOMMENDATIONS = 4;
async function semanticRecommendations(coachId, clientProfile, query, settings, citedItemIds) {
    const cfg = settings ?? await getRecommendationSettings(coachId);
    const focusAreas = clientProfile.preferences.focusAreas ?? [];
    const citedSet = new Set(citedItemIds ?? []);
    const allItems = await (0, libraryTools_1.getLibraryByCoach)(coachId);
    const itemMap = new Map(allItems.map(i => [i.itemId, i]));
    // ── Cited items first (guaranteed slots) ──────────────────────────────────
    const citedScored = [...citedSet]
        .map(id => itemMap.get(id))
        .filter((item) => !!item && RECOMMENDATION_RESOURCE_TYPES.has(item.itemType))
        .map(item => ({ item, score: Infinity, matchedGoals: item.tags.filter(t => focusAreas.includes(t)) }));
    const remainingSlots = MAX_RECOMMENDATIONS - citedScored.length;
    // ── Semantic fill for remaining slots ────────────────────────────────────
    let semanticScored = [];
    if (remainingSlots > 0) {
        const pineconeTopK = Math.max(remainingSlots * 4, 20);
        const matches = await (0, pineconeTools_1.vectorSearchLibrary)(coachId, query, pineconeTopK);
        if (matches.length > 0) {
            const semanticItemIds = [...new Set(matches.map(m => m.metadata.itemId).filter(Boolean))];
            const now = Date.now();
            semanticScored = semanticItemIds
                .filter(id => !citedSet.has(id))
                .map(itemId => {
                const item = itemMap.get(itemId);
                if (!item)
                    return null;
                if (!RECOMMENDATION_RESOURCE_TYPES.has(item.itemType))
                    return null;
                if (cfg.preferredTypes.length > 0 && !cfg.preferredTypes.includes(item.itemType))
                    return null;
                const semanticScore = matches
                    .filter(m => m.metadata.itemId === itemId)
                    .reduce((best, m) => Math.max(best, m.score), 0);
                const tagOverlap = item.tags.filter(t => focusAreas.includes(t)).length;
                const publishedAt = item.metadata.publishedAt || '';
                const ageMs = publishedAt ? now - new Date(publishedAt).getTime() : Infinity;
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                const recencyScore = ageDays < 365 ? Math.max(0, 1 - ageDays / 365) : 0;
                const totalScore = semanticScore * cfg.semanticWeight +
                    tagOverlap * cfg.tagWeight +
                    recencyScore * cfg.recencyBoost;
                return { item, score: totalScore, matchedGoals: item.tags.filter(t => focusAreas.includes(t)) };
            })
                .filter((s) => s !== null)
                .sort((a, b) => b.score - a.score)
                .slice(0, remainingSlots);
        }
    }
    return toPersonaRecommendations([...citedScored, ...semanticScored]);
}
// ── Formatting helpers ────────────────────────────────────────────────────────
async function formatRecommendationInPersona(items, snapshot, query) {
    const llm = (0, llmClient_1.getLLMClient)();
    const systemPrompt = `You are ${snapshot.summary}. Tone: ${snapshot.tone}. Style: ${snapshot.style}. Respond in first person as the coach.`;
    const context = items.slice(0, 5).map(s => {
        const item = s.item;
        const buyNote = item.buyLink ? ` (buy: ${item.buyLink})` : '';
        return `- ${item.title}${buyNote}: ${item.description ?? ''}`;
    }).join('\n');
    return llm.generateText(systemPrompt, `${query}\n\nRelevant resources:\n${context}`);
}
async function* streamChatInPersona(snapshot, clientProfile, history, message) {
    const llm = (0, llmClient_1.getLLMClient)();
    const systemPrompt = [
        `You are ${snapshot.summary}.`,
        `Tone: ${snapshot.tone}. Style: ${snapshot.style}.`,
        clientProfile
            ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
            : 'You are speaking with a prospective client.',
    ].join('\n');
    yield* llm.streamChat(systemPrompt, history, message);
}
function toPersonaRecommendations(scored) {
    return scored.map(s => {
        const item = s.item;
        const type = item.itemType === 'youtube' ? 'video' :
            item.itemType === 'book' ? 'book' :
                item.itemType === 'podcast' ? 'article' :
                    item.itemType === 'pdf' ? 'article' :
                        item.itemType === 'file' ? 'article' :
                            item.itemType === 'article' ? 'article' : 'module';
        return {
            type,
            title: item.title,
            description: item.description ?? '',
            // For books: return buy link instead of file URL
            url: item.itemType === 'book' ? item.buyLink : item.url,
            score: s.score,
            reasoning: s.matchedGoals.length
                ? `Matched focus areas: ${s.matchedGoals.join(', ')}`
                : 'Semantically relevant to your question',
        };
    });
}
//# sourceMappingURL=recommendationTools.js.map