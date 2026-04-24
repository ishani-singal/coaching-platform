"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreLibraryItemsForClient = scoreLibraryItemsForClient;
exports.scorePackagesForClient = scorePackagesForClient;
exports.formatRecommendationInPersona = formatRecommendationInPersona;
exports.streamChatInPersona = streamChatInPersona;
exports.toPersonaRecommendations = toPersonaRecommendations;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
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
async function formatRecommendationInPersona(items, snapshot, query) {
    const client = new sdk_1.default();
    const context = items.slice(0, 5).map(s => {
        const item = s.item;
        return `- ${item.title}: ${item.description ?? ''}`;
    }).join('\n');
    const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: `You are ${snapshot.summary}. Tone: ${snapshot.tone}. Style: ${snapshot.style}. Respond in first person as the coach.`,
        messages: [{ role: 'user', content: `${query}\n\nRelevant resources:\n${context}` }],
    });
    return msg.content[0].text;
}
async function* streamChatInPersona(snapshot, clientProfile, history, message) {
    const client = new sdk_1.default();
    const systemPrompt = [
        `You are ${snapshot.summary}.`,
        `Tone: ${snapshot.tone}. Style: ${snapshot.style}.`,
        clientProfile
            ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
            : 'You are speaking with a prospective client.',
    ].join('\n');
    const stream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
            ...history,
            { role: 'user', content: message },
        ],
    });
    for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
            yield event.delta.text;
        }
    }
}
function toPersonaRecommendations(scored) {
    return scored.slice(0, 5).map(s => {
        const item = s.item;
        const type = item.itemType === 'youtube' ? 'video' :
            item.itemType === 'book' ? 'book' :
                item.itemType === 'article' ? 'article' : 'module';
        return {
            type,
            title: item.title,
            description: item.description ?? '',
            url: item.url,
            score: s.score,
            reasoning: `Matched: ${s.matchedGoals.join(', ')}`,
        };
    });
}
//# sourceMappingURL=recommendationTools.js.map