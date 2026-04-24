import { createAgentServer, requireShellToken, AgentManifest, ContextRequest, ActionRequest, ClientProfile } from '@coaching/sdk';
import { configureBridge, getCoachBySlug, addPersonaSource, removePersonaSource, getLatestPersonaSnapshot, savePersonaSnapshot, updateCoachTheme } from '@coaching/tools';
import { getRecommendations, streamPersonaChat } from '@coaching/skills';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPersonaSources } from '@coaching/tools';
import { supabase } from '@coaching/sdk';
import type { Request, Response } from 'express';

const PORT = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
const AGENT_ID = 'coaching-persona-chat';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Persona Chat',
  version:         '1.0.0',
  description:     'AI chat in your voice. Recommends your programs, videos and books to clients.',
  icon:            '🧠',
  domain:          ['persona', 'recommendations', 'ai'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'chat-augment' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      { type: 'text-summary', id: 'pc-summary',      title: 'Persona Status',      dataKey: 'personaSummary' },
      { type: 'card-list',    id: 'pc-sources',       title: 'Persona Sources',     dataKey: 'sources', titleKey: 'sourceType', subtitleKey: 'url',
        actionButton: { label: 'Remove', actionName: 'remove_source', paramKey: 'sourceId' },
      },
      { type: 'action-form',  id: 'pc-add-source',   title: 'Add Source',          action: 'add_source', submitLabel: 'Add',
        fields: [
          { name: 'sourceType', label: 'Type',             inputType: 'select',   required: true, options: ['youtube', 'text', 'pdf', 'article'] },
          { name: 'url',        label: 'URL (optional)',    inputType: 'text',     required: false },
          { name: 'content',    label: 'Content (optional)',inputType: 'textarea', required: false },
        ],
      },
      { type: 'action-form',  id: 'pc-build-persona', title: 'Build / Rebuild Persona', action: 'build_persona', submitLabel: 'Build Persona', fields: [] },
    ],
  },
  actions: [
    { name: 'build_persona',        description: 'Build persona snapshot from sources', params: {} },
    { name: 'add_source',           description: 'Add a persona source',               params: { sourceType: { type: 'string', required: true, description: '' }, content: { type: 'string', required: false, description: '' }, url: { type: 'string', required: false, description: '' } } },
    { name: 'remove_source',        description: 'Remove a persona source',            params: { sourceId: { type: 'string', required: true, description: '' } } },
    { name: 'get_recommendations',  description: 'Get AI recommendations for client',  params: { clientProfile: { type: 'object', required: true, description: '' }, query: { type: 'string', required: true, description: '' } } },
    { name: 'get_persona_preview',  description: 'Get current persona snapshot',       params: {} },
    { name: 'update_theme',         description: 'Update coach website theme',         params: { themeConfig: { type: 'object', required: true, description: '' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const [snapshot, sources] = await Promise.all([
    getLatestPersonaSnapshot(req.userId),
    getPersonaSources(req.userId),
  ]);

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   snapshot ? `Persona v${snapshot.version} · ${sources.length} sources · tone: ${snapshot.tone}` : 'No persona built yet',
      keyEntities: [],
      recentEvents: [],
      pendingActions: [],
      rawContext: {
        personaSummary: snapshot
          ? `Persona v${snapshot.version} · tone: ${snapshot.tone} · ${sources.length} source(s)`
          : 'No persona built yet. Add sources and click Build Persona.',
        sources: sources.map(s => {
          const r = s as unknown as Record<string, unknown>;
          return {
            sourceId:   r.sourceId as string,
            sourceType: r.sourceType as string,
            url:        (r.url as string) ?? '',
            content:    r.content ? (r.content as string).slice(0, 80) + '…' : '',
          };
        }),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'build_persona': {
      const sources = await getPersonaSources(uid);
      const combined = sources.map(s => s.content ?? s.url ?? '').join('\n\n');
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const gemini = genai.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        systemInstruction: 'Extract tone, style, and a one-sentence summary from these coach materials. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "summary": "..." }',
      });
      const result = await gemini.generateContent(combined || 'I am a coach.');
      const rawText = result.response.text().trim().replace(/^```json\s*|```$/g, '');
      let tone = 'encouraging', style = 'conversational', summary = 'A dedicated coach.';
      try {
        const parsed = JSON.parse(rawText);
        tone = parsed.tone ?? tone; style = parsed.style ?? style; summary = parsed.summary ?? summary;
      } catch { /* use defaults */ }
      const snap = await savePersonaSnapshot(uid, tone, style, summary, { sources: sources.length });
      await supabase.from('coach_profiles').update({ persona_snapshot_id: snap.id }).eq('coach_id', uid);
      return { success: true, message: 'Persona built', data: snap as unknown as Record<string, unknown> };
    }

    case 'add_source':
      return { success: true, message: 'Source added', data: await addPersonaSource(uid, p.sourceType as never, p.content as string, p.url as string) as unknown as Record<string, unknown> };

    case 'remove_source':
      await removePersonaSource(p.sourceId as string);
      return { success: true, message: 'Source removed' };

    case 'get_recommendations':
      return { success: true, message: 'Recommendations', data: { items: await getRecommendations(uid, p.clientProfile as ClientProfile, p.query as string) } };

    case 'get_persona_preview':
      return { success: true, message: 'Persona', data: await getLatestPersonaSnapshot(uid) as unknown as Record<string, unknown> };

    case 'update_theme':
      await updateCoachTheme(uid, p.themeConfig as never);
      return { success: true, message: 'Theme updated' };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// SSE chat endpoint — validated by shell token
app.post('/chat/stream', requireShellToken, async (req: Request, res: Response) => {
  try {
    const { coachSlug, clientProfile, message, history } = req.body as {
      coachSlug: string;
      clientProfile?: ClientProfile;
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
    };

    const coach = await getCoachBySlug(coachSlug);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamPersonaChat(coach.coachId, clientProfile ?? null, history ?? [], message)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
