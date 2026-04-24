"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreLibraryItemsForClient = scoreLibraryItemsForClient;
exports.scorePackagesForClient = scorePackagesForClient;
exports.formatRecommendationInPersona = formatRecommendationInPersona;
exports.streamChatInPersona = streamChatInPersona;
exports.toPersonaRecommendations = toPersonaRecommendations;
const generative_ai_1 = require("@google/generative-ai");
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
    const genai = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        systemInstruction: `You are ${snapshot.summary}. Tone: ${snapshot.tone}. Style: ${snapshot.style}. Respond in first person as the coach.`,
    });
    const context = items.slice(0, 5).map(s => {
        const item = s.item;
        return `- ${item.title}: ${item.description ?? ''}`;
    }).join('\n');
    const result = await model.generateContent(`${query}\n\nRelevant resources:\n${context}`);
    return result.response.text();
}
async function* streamChatInPersona(snapshot, clientProfile, history, message) {
    const genai = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const systemPrompt = [
        `You are ${snapshot.summary}.`,
        `Tone: ${snapshot.tone}. Style: ${snapshot.style}.`,
        clientProfile
            ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
            : 'You are speaking with a prospective client.',
    ].join('\n');
    const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        systemInstruction: systemPrompt,
    });
    const chat = model.startChat({
        history: history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        })),
    });
    const result = await chat.sendMessageStream(message);
    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text)
            yield text;
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