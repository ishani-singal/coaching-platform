"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const sdk_2 = __importDefault(require("@anthropic-ai/sdk"));
const tools_2 = require("@coaching/tools");
const sdk_3 = require("@coaching/sdk");
const PORT = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
const AGENT_ID = 'coaching-persona-chat';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Persona Chat',
    version: '1.0.0',
    description: 'AI chat in your voice. Recommends your programs, videos and books to clients.',
    icon: '🧠',
    domain: ['persona', 'recommendations', 'ai'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'chat-augment' },
    panelSpec: {
        layout: 'two-column',
        sections: [
            { type: 'text-summary', id: 'pc-summary', title: 'Persona Status', dataKey: 'personaSummary' },
            { type: 'card-list', id: 'pc-sources', title: 'Persona Sources', dataKey: 'sources', titleKey: 'sourceType', subtitleKey: 'url',
                actionButton: { label: 'Remove', actionName: 'remove_source', paramKey: 'sourceId' },
            },
            { type: 'action-form', id: 'pc-add-source', title: 'Add Source', action: 'add_source', submitLabel: 'Add',
                fields: [
                    { name: 'sourceType', label: 'Type', inputType: 'select', required: true, options: ['youtube', 'text', 'pdf', 'article'] },
                    { name: 'url', label: 'URL (optional)', inputType: 'text', required: false },
                    { name: 'content', label: 'Content (optional)', inputType: 'textarea', required: false },
                ],
            },
            { type: 'action-form', id: 'pc-build-persona', title: 'Build / Rebuild Persona', action: 'build_persona', submitLabel: 'Build Persona', fields: [] },
        ],
    },
    actions: [
        { name: 'build_persona', description: 'Build persona snapshot from sources', params: {} },
        { name: 'add_source', description: 'Add a persona source', params: { sourceType: { type: 'string', required: true, description: '' }, content: { type: 'string', required: false, description: '' }, url: { type: 'string', required: false, description: '' } } },
        { name: 'remove_source', description: 'Remove a persona source', params: { sourceId: { type: 'string', required: true, description: '' } } },
        { name: 'get_recommendations', description: 'Get AI recommendations for client', params: { clientProfile: { type: 'object', required: true, description: '' }, query: { type: 'string', required: true, description: '' } } },
        { name: 'get_persona_preview', description: 'Get current persona snapshot', params: {} },
        { name: 'update_theme', description: 'Update coach website theme', params: { themeConfig: { type: 'object', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const [snapshot, sources] = await Promise.all([
        (0, tools_1.getLatestPersonaSnapshot)(req.userId),
        (0, tools_2.getPersonaSources)(req.userId),
    ]);
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: snapshot ? `Persona v${snapshot.version} · ${sources.length} sources · tone: ${snapshot.tone}` : 'No persona built yet',
            keyEntities: [],
            recentEvents: [],
            pendingActions: [],
            rawContext: {
                personaSummary: snapshot
                    ? `Persona v${snapshot.version} · tone: ${snapshot.tone} · ${sources.length} source(s)`
                    : 'No persona built yet. Add sources and click Build Persona.',
                sources: sources.map(s => {
                    const r = s;
                    return {
                        sourceId: r.sourceId,
                        sourceType: r.sourceType,
                        url: r.url ?? '',
                        content: r.content ? r.content.slice(0, 80) + '…' : '',
                    };
                }),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'build_persona': {
            const sources = await (0, tools_2.getPersonaSources)(uid);
            const combined = sources.map(s => s.content ?? s.url ?? '').join('\n\n');
            const client = new sdk_2.default();
            const msg = await client.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 512,
                system: 'Extract tone, style, and a one-sentence summary from these coach materials. Reply as JSON: { "tone": "...", "style": "...", "summary": "..." }',
                messages: [{ role: 'user', content: combined || 'I am a coach.' }],
            });
            let tone = 'encouraging', style = 'conversational', summary = 'A dedicated coach.';
            try {
                const parsed = JSON.parse(msg.content[0].text);
                tone = parsed.tone ?? tone;
                style = parsed.style ?? style;
                summary = parsed.summary ?? summary;
            }
            catch { /* use defaults */ }
            const snap = await (0, tools_1.savePersonaSnapshot)(uid, tone, style, summary, { sources: sources.length });
            await sdk_3.supabase.from('coach_profiles').update({ persona_snapshot_id: snap.id }).eq('coach_id', uid);
            return { success: true, message: 'Persona built', data: snap };
        }
        case 'add_source':
            return { success: true, message: 'Source added', data: await (0, tools_1.addPersonaSource)(uid, p.sourceType, p.content, p.url) };
        case 'remove_source':
            await (0, tools_1.removePersonaSource)(p.sourceId);
            return { success: true, message: 'Source removed' };
        case 'get_recommendations':
            return { success: true, message: 'Recommendations', data: { items: await (0, skills_1.getRecommendations)(uid, p.clientProfile, p.query) } };
        case 'get_persona_preview':
            return { success: true, message: 'Persona', data: await (0, tools_1.getLatestPersonaSnapshot)(uid) };
        case 'update_theme':
            await (0, tools_1.updateCoachTheme)(uid, p.themeConfig);
            return { success: true, message: 'Theme updated' };
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
// SSE chat endpoint — validated by shell token
app.post('/chat/stream', sdk_1.requireShellToken, async (req, res) => {
    try {
        const { coachSlug, clientProfile, message, history } = req.body;
        const coach = await (0, tools_1.getCoachBySlug)(coachSlug);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        for await (const chunk of (0, skills_1.streamPersonaChat)(coach.coachId, clientProfile ?? null, history ?? [], message)) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map