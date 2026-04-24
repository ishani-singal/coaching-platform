"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSlugAvailable = void 0;
exports.upgradeToCoach = upgradeToCoach;
const generative_ai_1 = require("@google/generative-ai");
const tools_1 = require("@coaching/tools");
Object.defineProperty(exports, "checkSlugAvailable", { enumerable: true, get: function () { return tools_1.checkSlugAvailable; } });
const sdk_1 = require("@coaching/sdk");
async function upgradeToCoach(userId, slug, displayName) {
    const coachProfile = await (0, tools_1.upgradeToCoach)(userId, slug, displayName);
    // Seed an empty draft package
    await sdk_1.supabase.from('coaching_packages').insert({
        coach_id: userId,
        title: 'My First Package',
        pricing_model: 'free',
        is_published: false,
    });
    // Add a welcome persona source
    const source = await (0, tools_1.addPersonaSource)(userId, 'text', `I am ${displayName}, a coach passionate about helping people reach their goals.`);
    // Build initial persona snapshot via LLM
    const genai = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        systemInstruction: 'Extract tone, style, and a one-sentence summary from this coach intro. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "summary": "..." }',
    });
    const result = await model.generateContent(source.content ?? '');
    const rawText = result.response.text().trim().replace(/^```json\s*|```$/g, '');
    let tone = 'encouraging', style = 'conversational', summary = `I am ${displayName}.`;
    try {
        const parsed = JSON.parse(rawText);
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