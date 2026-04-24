"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSlugAvailable = void 0;
exports.upgradeToCoach = upgradeToCoach;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const tools_1 = require("@coaching/tools");
Object.defineProperty(exports, "checkSlugAvailable", { enumerable: true, get: function () { return tools_1.checkSlugAvailable; } });
const sdk_2 = require("@coaching/sdk");
async function upgradeToCoach(userId, slug, displayName) {
    const coachProfile = await (0, tools_1.upgradeToCoach)(userId, slug, displayName);
    // Seed an empty draft package
    await sdk_2.supabase.from('coaching_packages').insert({
        coach_id: userId,
        title: 'My First Package',
        pricing_model: 'free',
        is_published: false,
    });
    // Add a welcome persona source
    const source = await (0, tools_1.addPersonaSource)(userId, 'text', `I am ${displayName}, a coach passionate about helping people reach their goals.`);
    // Build initial persona snapshot via LLM
    const client = new sdk_1.default();
    const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        system: 'Extract tone, style, and a one-sentence summary from this coach intro. Reply as JSON: { "tone": "...", "style": "...", "summary": "..." }',
        messages: [{ role: 'user', content: source.content ?? '' }],
    });
    let tone = 'encouraging', style = 'conversational', summary = `I am ${displayName}.`;
    try {
        const parsed = JSON.parse(msg.content[0].text);
        tone = parsed.tone ?? tone;
        style = parsed.style ?? style;
        summary = parsed.summary ?? summary;
    }
    catch { /* use defaults */ }
    const snapshot = await (0, tools_1.savePersonaSnapshot)(userId, tone, style, summary, {});
    await (0, tools_1.setPersonaSnapshot)(userId, snapshot.id);
    const subdomainUrl = `https://${slug}.${process.env.PLATFORM_DOMAIN}`;
    return { coachProfile: { ...coachProfile, personaSnapshotId: snapshot.id }, subdomainUrl };
}
//# sourceMappingURL=coachUpgradeSkill.js.map