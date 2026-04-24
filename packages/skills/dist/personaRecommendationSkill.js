"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendations = getRecommendations;
exports.streamPersonaChat = streamPersonaChat;
const tools_1 = require("@coaching/tools");
async function getRecommendations(coachId, clientProfile, query) {
    const [snapshot, library, packages] = await Promise.all([
        (0, tools_1.getLatestPersonaSnapshot)(coachId),
        (0, tools_1.getLibraryByCoach)(coachId),
        (0, tools_1.getPublishedPackagesForCoach)(coachId),
    ]);
    if (!snapshot)
        return [];
    const scoredItems = (0, tools_1.scoreLibraryItemsForClient)(library, clientProfile);
    const scoredPackages = (0, tools_1.scorePackagesForClient)(packages, clientProfile);
    const top = [...scoredItems, ...scoredPackages]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    await (0, tools_1.formatRecommendationInPersona)(top, snapshot, query);
    return (0, tools_1.toPersonaRecommendations)(top);
}
async function* streamPersonaChat(coachId, clientProfile, history, message) {
    const snapshot = await (0, tools_1.getLatestPersonaSnapshot)(coachId);
    if (!snapshot) {
        yield 'Coach persona not yet configured.';
        return;
    }
    yield* (0, tools_1.streamChatInPersona)(snapshot, clientProfile, history, message);
}
//# sourceMappingURL=personaRecommendationSkill.js.map