import {
  createAgentServer, requireShellToken,
  AgentManifest, ContextRequest, ActionRequest, ClientProfile, AguiLibraryCardEvent,
  QuestionItem, QuestionState,
} from '@coaching/sdk';
import { checkSpendLimit, updateSessionSpend, estimateCostCents, auditLog } from './spend';
import {
  configureBridge,
  getCoachBySlug,
  buildPersonaContext,
  getLatestPersonaSnapshot, savePersonaSnapshot,
  updateCoachTheme,
  upsertPersonaChunks,
  vectorSearchLibrary,
  vectorSearchQA,
  vectorSearchPersona,
  getRecommendationSettings, updateRecommendationSettings,
  semanticRecommendations,
  getLibraryByCoach,
  getCoachById,
  updateCustomChatPrompt,
  updateListenerFirstMode,
  updateChatTools,
  indexPdfLibraryItems,
  getLLMClient,
  hasPersonaVectors,
  type ToolChunk,
} from '@coaching/tools';
import { getRecommendations } from '@coaching/skills';
import { CHAT_FUNCTION_DECLARATIONS, buildToolExecutor } from './chatTools';
import { supabase } from '@coaching/sdk';
import type { Request, Response } from 'express';
import type { CoachRecommendationSettings } from '@coaching/sdk';

const PORT     = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
const AGENT_ID = 'coaching-persona-chat';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Persona Chat',
  version:         '2.0.0',
  description:     'AI chat in your voice. RAG-powered from your library. Recommends resources to clients.',
  icon:            '🧠',
  domain:          ['persona', 'recommendations', 'ai'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'chat-augment' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      { type: 'text-summary', id: 'pc-summary',      title: 'Persona Status',      dataKey: 'personaSummary' },
      { type: 'action-form',  id: 'pc-build-persona', title: 'Build / Rebuild Persona', action: 'build_persona', submitLabel: 'Build Persona', fields: [] },
    ],
  },
  actions: [
    { name: 'build_persona',                  description: 'Build persona snapshot from library + profile', params: {} },
    { name: 'get_recommendations',            description: 'Get AI recommendations for client',             params: { clientProfile: { type: 'object', required: true, description: '' }, query: { type: 'string', required: true, description: '' }, citedItemIds: { type: 'array', required: false, description: 'Item IDs already cited in chat (shown first)' } } },
    { name: 'get_persona_preview',            description: 'Get current persona snapshot',                  params: {} },
    { name: 'update_theme',                   description: 'Update coach website theme',                    params: { themeConfig: { type: 'object', required: true, description: '' } } },
    { name: 'get_recommendation_settings',    description: 'Get recommendation scoring parameters',         params: {} },
    { name: 'update_recommendation_settings', description: 'Update recommendation scoring parameters',      params: { settings: { type: 'object', required: true, description: 'Partial CoachRecommendationSettings' } } },
    { name: 'get_custom_chat_prompt',         description: 'Get the coach custom chat instructions',        params: {} },
    { name: 'update_custom_chat_prompt',      description: 'Save coach custom chat instructions',           params: { prompt: { type: 'string', required: true, description: 'Custom instructions for the chat' } } },
    { name: 'get_listener_first_mode',        description: 'Get listener-first mode setting',               params: {} },
    { name: 'update_listener_first_mode',     description: 'Save listener-first mode setting',              params: { enabled: { type: 'boolean', required: true, description: 'Enable listener-first mode' } } },
    { name: 'get_chat_tools',                 description: 'Get chat behaviour tools for this persona',     params: {} },
    { name: 'update_chat_tools',              description: 'Save chat behaviour tools for this persona',    params: { tools: { type: 'array', required: true, description: 'Array of ChatTool objects' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const [snapshot, ctx] = await Promise.all([
    getLatestPersonaSnapshot(req.userId),
    buildPersonaContext(req.userId),
  ]);

  return {
    snapshot: {
      agentId:        AGENT_ID,
      agentName:      manifest.name,
      domain:         manifest.domain,
      summary:        snapshot
        ? `Persona v${snapshot.version} · ${ctx.libraryItemCount} library items · tone: ${snapshot.tone}`
        : 'No persona built yet',
      keyEntities:    [],
      recentEvents:   [],
      pendingActions: [],
      rawContext: {
        personaSummary: snapshot
          ? `Persona v${snapshot.version} · tone: ${snapshot.tone} · built from ${ctx.libraryItemCount} library item(s)`
          : `No persona built yet. Click Build Persona to generate from your ${ctx.libraryItemCount} library item(s) and profile.`,
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'build_persona': {
      const force = (p.force as boolean | undefined) ?? false;
      try {
        const { corpus, libraryItemCount } = await buildPersonaContext(uid);
        const existing = !force ? await getLatestPersonaSnapshot(uid) : null;
        const prevCount = (existing?.rawSnapshot?.libraryItemCount as number | undefined) ?? -1;

        if (existing && prevCount === libraryItemCount) {
          // Library unchanged — skip LLM re-analysis; only re-index to Pinecone if missing
          hasPersonaVectors(uid).then((hasVectors: boolean) => {
            if (!hasVectors) {
              const chunks = corpus.match(/.{1,1600}/gs) ?? [corpus];
              upsertPersonaChunks(uid, chunks, { source: 'persona_build', version: String(existing.version) }).catch(() => {});
              indexPdfLibraryItems(uid).catch(() => {});
            }
          }).catch(() => {});
          return { success: true, message: 'Persona already up to date', data: existing as unknown as Record<string, unknown> };
        }

        const llm = getLLMClient();
        let tone = 'encouraging', style = 'conversational', summary = 'A dedicated coach.';

        // Map-reduce over full corpus so all content informs the persona.
        // Each chunk stays well under the 131k-token context limit (~75k tokens per chunk).
        const CHUNK_SIZE = 300_000;
        const corpusChunks: string[] = [];
        for (let i = 0; i < (corpus || 'I am a coach.').length; i += CHUNK_SIZE) {
          corpusChunks.push((corpus || 'I am a coach.').slice(i, i + CHUNK_SIZE));
        }

        const mapSys = 'Analyze the tone, style, and key themes in these coach materials. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "themes": ["..."] }';
        const mapResults = await Promise.allSettled(
          corpusChunks.map(chunk => llm.generateText(mapSys, chunk).then(r => r.trim().replace(/^```json\s*|```$/g, '')))
        );
        const validMaps = mapResults
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value);

        if (validMaps.length === 1) {
          try {
            const parsed = JSON.parse(validMaps[0]);
            tone    = parsed.tone    ?? tone;
            style   = parsed.style   ?? style;
            summary = parsed.summary ?? summary;
          } catch { /* use defaults */ }
        } else if (validMaps.length > 1) {
          const reduceSys = 'These are tone/style analyses from different sections of one coach\'s materials. Synthesize into a single unified persona. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "summary": "one sentence about this coach" }';
          const rawReduce = (await llm.generateText(reduceSys, validMaps.join('\n\n---\n\n'))).trim().replace(/^```json\s*|```$/g, '');
          try {
            const parsed = JSON.parse(rawReduce);
            tone    = parsed.tone    ?? tone;
            style   = parsed.style   ?? style;
            summary = parsed.summary ?? summary;
          } catch { /* use defaults */ }
        }
        const snap = await savePersonaSnapshot(uid, tone, style, summary, { libraryItemCount });
        await supabase.from('user_profiles').update({ persona_snapshot_id: snap.id }).eq('user_id', uid);
        const chunks = corpus.match(/.{1,1600}/gs) ?? [corpus];
        upsertPersonaChunks(uid, chunks, { source: 'persona_build', version: String(snap.version) }).catch(() => {});
        indexPdfLibraryItems(uid).catch(() => {});
        return { success: true, message: 'Persona built', data: snap as unknown as Record<string, unknown> };
      } catch (e: unknown) {
        const msg = (e as Error).message ?? String(e);
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit');
        return {
          success: false,
          message: isRateLimit
            ? 'API rate limit reached. Please wait ~1 minute and try again.'
            : `Persona build failed: ${msg}`,
        };
      }
    }

    case 'get_recommendations':
      return { success: true, message: 'Recommendations', data: { items: await getRecommendations(uid, p.clientProfile as ClientProfile, p.query as string, p.citedItemIds as string[] | undefined) } };

    case 'get_persona_preview':
      return { success: true, message: 'Persona', data: await getLatestPersonaSnapshot(uid) as unknown as Record<string, unknown> };

    case 'update_theme':
      await updateCoachTheme(uid, p.themeConfig as never);
      return { success: true, message: 'Theme updated' };

    case 'get_recommendation_settings': {
      const settings = await getRecommendationSettings(uid);
      return { success: true, message: 'Settings', data: settings as unknown as Record<string, unknown> };
    }

    case 'update_recommendation_settings': {
      await updateRecommendationSettings(uid, p.settings as Partial<CoachRecommendationSettings>);
      return { success: true, message: 'Settings updated' };
    }

    case 'get_custom_chat_prompt': {
      const coach = await getCoachById(uid);
      return { success: true, message: 'Custom prompt', data: { prompt: coach?.customChatPrompt ?? '' } as unknown as Record<string, unknown> };
    }

    case 'update_custom_chat_prompt': {
      await updateCustomChatPrompt(uid, (p.prompt as string) ?? '');
      return { success: true, message: 'Custom prompt saved' };
    }

    case 'get_listener_first_mode': {
      const coach = await getCoachById(uid);
      return { success: true, message: 'Listener-first mode', data: { enabled: coach?.listenerFirstMode ?? false } as unknown as Record<string, unknown> };
    }

    case 'update_listener_first_mode': {
      await updateListenerFirstMode(uid, (p.enabled as boolean) ?? false);
      return { success: true, message: 'Listener-first mode saved' };
    }

    case 'get_chat_tools': {
      const coach = await getCoachById(uid);
      return { success: true, message: 'Chat tools', data: { tools: coach?.chatTools ?? [] } as unknown as Record<string, unknown> };
    }

    case 'update_chat_tools': {
      await updateChatTools(uid, p.tools as import('@coaching/sdk').ChatTool[]);
      return { success: true, message: 'Chat tools saved' };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// ── RAG + AG-UI chat stream endpoint ────────────────────────────────────────

app.post('/chat/stream', requireShellToken, async (req: Request, res: Response) => {
  try {
    const { coachSlug, clientProfile, clientId, message, history, llmProvider, sessionId, questionState: incomingQState } = req.body as {
      coachSlug:      string;
      clientProfile?: ClientProfile;
      clientId?:      string;
      message:        string;
      history:        { role: 'user' | 'assistant'; content: string }[];
      llmProvider?:   'gemini' | 'azure-openai';
      sessionId?:     string;
      questionState?: QuestionState;
    };

    const coach    = await getCoachBySlug(coachSlug);
    const snapshot = await getLatestPersonaSnapshot(coach.userId);

    // ── Check spend limit before doing any LLM work ────────────────────────
    if (sessionId) {
      const limitCheck = await checkSpendLimit(sessionId, coach.userId);
      if (!limitCheck.allowed) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'limit_reached', limitType: limitCheck.limitType })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        auditLog('chat.limit_reached', { resourceType: 'prospect_chat_session', resourceId: sessionId, coachId: coach.userId }).catch(() => {});
        return;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // ── Resolve active chat tools (sync) ──────────────────────────────────────
    const chatTools = coach.chatTools ?? [];
    const listenFirstTool  = true; // always on
    const reflectiveTool   = chatTools.find(t => t.type === 'reflective_acknowledgement' && t.enabled);
    const replyStyleTool   = chatTools.find(t => t.type === 'reply_style' && t.enabled);
    const replyStyle = replyStyleTool?.settings?.replyStyle ?? 'narrative';
    const assistantTurnCount = (history ?? []).filter(m => m.role === 'assistant').length;
    const coachingTypeLabel = coach.coachingType ? coach.coachingType.replace(/_/g, ' ') : 'coach';

    // ── Helper: strip LLM wrapper noise before JSON.parse ─────────────────────
    function stripLLMNoise(raw: string): string {
      let s = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      // Extract just the JSON object — Gemini often wraps it in reasoning text
      const start = s.indexOf('{');
      const end   = s.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
      return s;
    }

    // ── Helper: compute clarity from a question list (AQI-weighted) ─────────────
    function computeClarity(questions: QuestionItem[]): number {
      if (!questions.length) return 0;
      const active   = questions.filter(q => !q.deprecated);
      const total    = active.reduce((s, q) => s + q.weight, 0);
      const answered = active.filter(q => q.answered).reduce((s, q) => s + q.weight * (q.quality ?? 1), 0);
      return total === 0 ? 0 : Math.round((answered / total) * 100);
    }

    // ── 1. Question-state engine (listen-first only) ───────────────────────────
    let questionState: QuestionState = incomingQState ?? { questions: [], clarity: 0 };
    let inQuestionPhase = false;
    let nextQuestion: QuestionItem | undefined;

    const personaMatchesPromise = vectorSearchPersona(coach.userId, message, 3).catch(() => []);
    let libraryMatches = [] as Awaited<ReturnType<typeof vectorSearchLibrary>>;
    let qaMatches      = [] as Awaited<ReturnType<typeof vectorSearchQA>>;
    let itemMap        = new Map<string, Awaited<ReturnType<typeof getLibraryByCoach>>[number]>();
    let matchedItems   = [] as Awaited<ReturnType<typeof getLibraryByCoach>>;

    // Background promises fired before streaming — awaited post-stream to avoid blocking first byte
    let turn0GenPromise:     Promise<string | null>                                    = Promise.resolve(null);
    let qstateUpdatePromise: Promise<string | null>                                   = Promise.resolve(null);
    let libMatchesPromise:   Promise<Awaited<ReturnType<typeof vectorSearchLibrary>>> = Promise.resolve([]);
    let qaMatchesPromise:    Promise<Awaited<ReturnType<typeof vectorSearchQA>>>      = Promise.resolve([]);
    let qstateUpdatePromptText = '';

    {
      const qLlm = getLLMClient(llmProvider);

      if (assistantTurnCount === 0) {
        // ── Turn 0: fire question generation in background, stream immediately ──
        turn0GenPromise = qLlm.generateText(
          `You are an expert ${coachingTypeLabel} who needs to understand a client's situation before giving advice. Given the client's opening message, generate a prioritised list of clarifying questions you must ask — in order of importance — before you can give useful, personalised advice. Each question should target one concrete piece of missing information (specific events, duration, outcome wanted, what's been tried, key people involved, etc.). Do NOT include vague or meta questions. Return ONLY valid JSON: { "questions": [ { "text": "...", "weight": <1-7> }, ... ] } where weight 7 = absolutely essential, 1 = minor detail. Generate 5-8 questions.`,
          `Client's message: "${message}"`
        ).catch(() => null);

        // Seed fallback question so system prompt has something to ask right now
        questionState = { questions: [{ id: 'q1', text: 'Can you walk me through exactly what\'s been happening — what the specific situation is, who is involved, and what outcome you\'re hoping for?', weight: 7, priority: 1, answered: false }], clarity: 0 };
        inQuestionPhase = true;
      } else {
        // ── Turns 1+: fire everything in background, derive phase from incoming state ──
        const historyText = (history ?? [])
          .map(m => `${m.role === 'user' ? 'Person' : 'Coach'}: ${m.content}`)
          .join('\n');
        const existingJson = JSON.stringify(questionState.questions.map(q => ({ id: q.id, text: q.text, weight: q.weight, answered: q.answered, deprecated: q.deprecated })));

        qstateUpdatePromptText = `Conversation so far:\n${historyText}\n\nLatest message: "${message}"`;

        const updatePrompt = `You are tracking clarifying questions in a coaching conversation. Analyze the latest message and return a JSON update.

EXISTING QUESTIONS: ${existingJson}

RULES:
1. answeredQuestions — list ONLY questions explicitly and directly addressed in the latest message. For each, assign a quality score:
   - 1.0 = complete, explicit, specific (e.g. "I am a parent, he is 13, he won't study")
   - 0.7 = mostly answered, minor detail missing
   - 0.4 = partial or only implied
   - 0.1 = vague label only (e.g. "acting rebellious", "has issues") — barely counts
   - Omit entirely if not answered at all.
2. deprecatedIds — IDs of questions the person answered WITHOUT being asked (volunteered info). These become irrelevant to ask.
3. weightAdjustments — re-score remaining unanswered questions now that you know more context. Only include if weight should change.
4. newQuestions — You MUST return at least 1-2 new questions that dig deeper into what was just revealed. Only return an empty array if you have full explicit information on ALL of: specific incident/behaviour, desired outcome, duration, what has been tried, key relationships, and emotional context. New questions must not duplicate existing ones. Every new question MUST have weight ≥ 4 — do not add low-priority fillers.

Return ONLY valid JSON:
{ "answeredQuestions": [{"id": "q1", "quality": 0.9}], "deprecatedIds": ["q2"], "weightAdjustments": [{"id": "q3", "weight": 6}], "newQuestions": [{"text": "...", "weight": 5}] }`;

        // Fire all async work without awaiting — do not block streaming
        qstateUpdatePromise = qLlm.generateText(updatePrompt, qstateUpdatePromptText).catch(() => null);
        libMatchesPromise   = vectorSearchLibrary(coach.userId, message, 5).catch(() => []);
        qaMatchesPromise    = vectorSearchQA(coach.userId, message, 3).catch(() => []);

        // Derive phase from incoming state — no LLM round-trip needed here
        const unansweredNow        = questionState.questions.filter(q => !q.answered && !q.deprecated);
        const allLowWeightNow        = unansweredNow.length > 0 && unansweredNow.every(q => q.weight < 3);
        const meaningfulUnanswered   = unansweredNow.filter(q => q.weight >= 4);
        // Stay in question phase if ≥2 meaningful questions remain OR clarity is still low
        inQuestionPhase = (meaningfulUnanswered.length >= 2 || questionState.clarity <= 80) && !allLowWeightNow;

        if (!inQuestionPhase) {
          // Coaching mode: tools will search on demand — no pre-fetch needed
          // (libMatchesPromise + qaMatchesPromise are still fired but we won't await them)
        }
      }

      // Find next question to ask (first active unanswered by priority)
      nextQuestion = questionState.questions.find(q => !q.answered && !q.deprecated);
    }

    const personaMatches = await personaMatchesPromise;

    // ── 2. Build enriched context strings ─────────────────────────────────────
    const libraryContextLines = libraryMatches.length > 0
      ? libraryMatches.map(m => {
          const item = itemMap.get(m.metadata.itemId);
          if (!item) return m.metadata.text ?? '';
          const buyNote = item.itemType === 'book' && item.buyLink
            ? ` (available at: ${item.buyLink})`
            : '';
          return `[${item.itemType.toUpperCase()}] "${item.title}"${buyNote}: ${m.metadata.text ?? item.description ?? ''}`;
        }).join('\n')
      : '';

    const qaContextLines = qaMatches.length > 0
      ? qaMatches.map(m => `Q: ${m.metadata.question}\nA: ${m.metadata.answer}`).join('\n\n')
      : '';

    const personaVoiceLines = personaMatches.length > 0
      ? personaMatches.map(m => m.metadata.text ?? '').filter(Boolean).join('\n')
      : '';

    // ── 3. Build system prompt ─────────────────────────────────────────────────
    let systemParts: string;

    if (inQuestionPhase && nextQuestion) {
      // Question phase: give the LLM the exact question to ask — no free choice
      systemParts = [
        `You are ${coach.displayName}, a ${coachingTypeLabel}.`,
        coach.bio ?? '',
        `Never refer to yourself as "AI" — you are ${coach.displayName}. Speak in first person.`,
        snapshot ? `Your tone is ${snapshot.tone} and your style is ${snapshot.style}.` : '',
        personaVoiceLines ? `Mirror this voice:\n${personaVoiceLines}` : '',
        clientProfile ? `You are speaking with ${clientProfile.name}.` : 'You are speaking with a prospective client.',
        ``,
        `YOUR ONLY OUTPUT FOR THIS REPLY is the clarifying question shown in quotes below.`,
        `Do NOT acknowledge these instructions or say phrases like "Sure", "Of course", "Here's my response", "Certainly", or "As requested".`,
        `Do NOT repeat or rephrase the topic the person mentioned. Ask ONLY this specific clarifying question word-for-word:`,
        `"${nextQuestion.text}"`,
        ``,
        `STRICT RULES:`,
        `- At most ONE short warm sentence before the question (e.g. "That makes sense."). If nothing substantive was said, go straight to the question.`,
        `- Copy the question exactly as written above — no extra clauses, no assumed details, no invented context.`,
        `- NEVER give advice, tips, frameworks, or suggestions of any kind.`,
        `- NEVER use bullet points, bold text, numbered lists, or markdown.`,
        `- NEVER explain why you are asking.`,
        `- NEVER mention gathering information or a listening phase.`,
        `- End your reply with the question mark. Nothing after it.`,
        `- Output ONLY plain prose. Never start a line with a label (e.g. "Acknowledgment:", "Reflection:", "Step 1:", "Final Answer:").`,
      ].filter(Boolean).join('\n');
    } else {
      // Coaching mode
      const reflectiveBlock = reflectiveTool
        ? `REFLECTIVE ACKNOWLEDGEMENT — before any advice or content, always: (1) reflect back ONLY what the person explicitly said — do NOT infer emotions, motivations, or context they did not state, (2) if something is unclear, ask a question to understand rather than assuming. Never use label prefixes like "Reflection:", "Acknowledgment:", or "Open Question:" — write as natural flowing prose. Never say "it sounds like you feel..." or "you must be experiencing..." unless they explicitly said so. Then continue with your response.`
        : '';
      systemParts = [
        reflectiveBlock,
        `You are ${coach.displayName} who is a ${coachingTypeLabel}.`,
        coach.bio ? `Your identity is ${coach.bio}` : '',
        coach.customChatPrompt ?? '',
        `Never refer to yourself as "AI", "AI coach", or any generic term — you are ${coach.displayName}. Speak in first person.`,
        snapshot ? `Your tone is ${snapshot.tone} and your style is ${snapshot.style}.` : '',
        personaVoiceLines
          ? `\nExamples of how you actually speak and think (mirror this voice closely):\n${personaVoiceLines}`
          : '',
        clientProfile
          ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
          : 'You are speaking with a prospective client visiting your website.',
        `\nYou have access to tools: call search_qa first to find relevant personal experience, then search_library for supporting resources. Call recommend_resource for any specific item you reference so a card is shown to the client.`,
        replyStyleTool ? (() => {
          const styleMap: Record<string, string> = {
            narrative: 'Write ONLY in flowing prose paragraphs. ABSOLUTELY NO numbered lists, bullet points, headings, bold text, or any markdown formatting whatsoever. If you are about to write a number followed by a period or a dash at the start of a line, stop and rewrite as a prose sentence instead.',
            bullet:    'Structure your reply as short bullet points. No long paragraphs.',
            mixed:     'Start with one sentence of context, then use 2-4 bullet points for the key ideas.',
            socratic:  'Respond primarily with questions that guide the person to their own insight. Minimise direct statements.',
          };
          return `FORMAT RULE (non-negotiable, applies to every sentence): ${styleMap[replyStyle] ?? styleMap['narrative']}`;
        })() : '',
        `\nGuidelines:`,
        `- Keep replies concise and conversational.`,
        `- Stay brief — 2-3 short paragraphs maximum.`,
        `- For books mention title and buy link. For videos mention the title only.`,
      ].filter(Boolean).join('\n');
    }

    // ── 4. Stream LLM response (with CoT line filter) ────────────────────────
    const llm = getLLMClient(llmProvider);
    let fullResponse = '';

    const effectiveHistory = (history ?? []);

    // Lines matching these patterns are Gemini chain-of-thought / reasoning labels that leaked out
    const COT_LINE_PATTERNS = [
      /^Step \d+[:.]/i,
      /^Final Answer:/i,
      /^Final Check-In:/i,
      /^Acknowledgment:/i,
      /^Reflection:/i,
      /^Open Question:/i,
      /^\d+\.\s+[A-Z]/,
      /^By (approaching|structuring|framing)/i,
      /^Example Conversation/i,
      /^\*Example/i,
      /^I should /i,
      /^I will /i,
      /^I need to /i,
      /^\\boxed\{/,
      /^\\text\{/,
      /^Step-by-Step/i,
      /^\*+\s*Final Answer:/i,
      /^<details/i,
      /^<summary/i,
      /^Sure,?\s+I/i,
      /^Of course/i,
      /^Certainly/i,
      /^Here'?s (the|my)/i,
      /^Here is (the|my)/i,
      /^As (requested|instructed|per)/i,
      /^Clarifying Question:/i,
      /^Key Points/i,
      /^Underlying Assumptions/i,
      /^Next Steps/i,
      /^Final Question/i,
      /^[-•*]\s/,
      /^\*{1,2}\d+\./,
    ];

    let firstTextChunk = true;
    let lineBuf = '';
    let inBoxed = false;
    let inDetails = false;
    let questionEmitted = false;

    const emitChunk = (chunk: string) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'text', chunk })}\n\n`);
    };

    const processLine = (line: string, isLast = false) => {
      const trimmed = line.trimStart();
      // In question phase, stop emitting once we've sent the question
      if (inQuestionPhase && questionEmitted) return;
      // Suppress everything inside <details>...</details> CoT blocks
      if (trimmed.startsWith('<details')) { inDetails = true; return; }
      if (inDetails) { if (trimmed.startsWith('</details')) inDetails = false; return; }
      // Single-line \boxed{content} or \text{content} — emit just the inner content
      const inlineWrapped = trimmed.match(/^\\(?:boxed|text)\{(.*)\}\s*$/);
      if (inlineWrapped) { emitChunk(isLast ? inlineWrapped[1] : inlineWrapped[1] + '\n'); return; }
      // Multi-line \boxed{ ... } or \text{ ... } block
      if (trimmed === '\\boxed{' || trimmed === '\\text{') { inBoxed = true; return; }
      if (inBoxed) { if (trimmed === '}') { inBoxed = false; return; } emitChunk(isLast ? line : line + '\n'); return; }
      // Suppress CoT patterns
      if (COT_LINE_PATTERNS.some(re => re.test(trimmed))) return;
      emitChunk(isLast ? line : line + '\n');
      // Hard stop: once we've emitted the question, suppress everything after
      if (inQuestionPhase && trimmed.trimEnd().endsWith('?')) questionEmitted = true;
    };

    const feedChunk = (chunk: string) => {
      if (firstTextChunk) {
        chunk = chunk.trimStart();
        if (!chunk) return;
        firstTextChunk = false;
      }
      lineBuf += chunk;
      const parts = lineBuf.split('\n');
      lineBuf = parts.pop() ?? '';
      for (const line of parts) processLine(line);
    };

    if (inQuestionPhase) {
      // Question phase: plain streaming, no tools
      for await (const event of llm.streamChatWithThinking(systemParts, effectiveHistory, message)) {
        if (event.type === 'thought') continue;
        feedChunk(event.chunk);
      }
    } else {
      // Coaching mode: agentic tool-calling loop
      const recommendedItemIds: string[] = [];
      const executor = buildToolExecutor(coach.userId, recommendedItemIds);

      for await (const event of llm.streamChatWithTools(systemParts, effectiveHistory, message, CHAT_FUNCTION_DECLARATIONS, executor)) {
        if (event.type === 'tool_start') {
          res.write(`data: ${JSON.stringify({ type: 'agui', event: { type: 'TOOL_CALL_START', toolCallId: event.toolCallId, toolName: event.toolName } })}\n\n`);
          continue;
        }
        if (event.type === 'tool_end') {
          // For recommend_resource, emit a library card event
          if (event.toolName === 'recommend_resource') {
            const result = event.result as { success?: boolean } | undefined;
            const itemId = recommendedItemIds[recommendedItemIds.length - 1];
            if (result?.success && itemId) {
              const allItems = await getLibraryByCoach(coach.userId);
              const item = allItems.find(i => i.itemId === itemId);
              if (item) {
                const resourceItemTypes = new Set(['book', 'article', 'podcast', 'youtube', 'pdf', 'file']);
                if (resourceItemTypes.has(item.itemType)) {
                  const desc = item.description
                    ? item.description.slice(0, 140) + (item.description.length > 140 ? '…' : '')
                    : undefined;
                  const cardEvent: AguiLibraryCardEvent = {
                    type:     'TOOL_CALL_END',
                    toolName: 'library_item_card',
                    output: {
                      itemId:       item.itemId,
                      title:        item.title,
                      itemType:     item.itemType,
                      description:  desc,
                      buyLink:      item.buyLink,
                      thumbnailUrl: item.thumbnailUrl,
                      url:          item.itemType === 'book' ? item.buyLink : item.url,
                      tags:         item.tags,
                    },
                  };
                  res.write(`data: ${JSON.stringify({ type: 'agui', event: cardEvent })}\n\n`);
                }
              }
            }
          }
          res.write(`data: ${JSON.stringify({ type: 'agui', event: { type: 'TOOL_CALL_END', toolCallId: event.toolCallId, toolName: event.toolName } })}\n\n`);
          continue;
        }
        if (event.type === 'thought') continue;
        feedChunk(event.chunk);
      }
    }
    if (lineBuf) processLine(lineBuf, true);
    if (assistantTurnCount === 0) {
      // Turn 0: apply the generated question list now that stream is done
      const raw = await turn0GenPromise;
      if (raw) {
        try {
          const parsed = JSON.parse(stripLLMNoise(raw)) as { questions: { text: string; weight: number }[] };
          let priority = 1;
          questionState = {
            questions: (parsed.questions ?? [])
              .sort((a, b) => b.weight - a.weight)
              .map(q => ({ id: `q${priority++}`, text: q.text, weight: Math.min(7, Math.max(1, Math.round(q.weight))), priority: priority - 1, answered: false })),
            clarity: 0,
          };
          questionState.questions.forEach((q, i) => { q.priority = i + 1; });
        } catch (e) {
          console.warn('[qstate] failed to parse initial question list:', (e as Error).message);
        }
      }
    } else if (inQuestionPhase) {
      // Turns 1+ (question phase): apply background update
      const updateRaw = await qstateUpdatePromise;
      [libraryMatches, qaMatches] = await Promise.all([libMatchesPromise, qaMatchesPromise]);
      console.warn('[qstate] updateRaw:', updateRaw ? updateRaw.slice(0, 400) : '(null/empty)');
      if (updateRaw) {
        try {
          const update = JSON.parse(stripLLMNoise(updateRaw)) as {
            answeredQuestions?: { id: string; quality: number }[];
            deprecatedIds?: string[];
            weightAdjustments?: { id: string; weight: number }[];
            newQuestions?: { text: string; weight: number }[];
          };
          const answeredMap = new Map((update.answeredQuestions ?? []).map(a => [a.id, a.quality]));
          questionState.questions.forEach(q => {
            if (answeredMap.has(q.id)) { q.answered = true; q.quality = Math.min(1, Math.max(0, answeredMap.get(q.id)!)); }
          });
          const deprecatedSet = new Set(update.deprecatedIds ?? []);
          questionState.questions.forEach(q => { if (deprecatedSet.has(q.id)) q.deprecated = true; });
          const weightMap = new Map((update.weightAdjustments ?? []).map(w => [w.id, w.weight]));
          questionState.questions.forEach(q => {
            if (!q.answered && !q.deprecated && weightMap.has(q.id)) q.weight = Math.min(7, Math.max(1, Math.round(weightMap.get(q.id)!)));
          });
          const existingTexts = questionState.questions.map(q => q.text.toLowerCase());
          const newOnes = (update.newQuestions ?? []).filter(nq => {
            const lower = nq.text.toLowerCase();
            return !existingTexts.some(et => et.includes(lower.slice(0, 20)) || lower.includes(et.slice(0, 20)));
          });
          const maxId = questionState.questions.reduce((m, q) => Math.max(m, parseInt(q.id.replace('q', ''), 10) || 0), 0);
          newOnes.forEach((nq, i) => {
            questionState.questions.push({ id: `q${maxId + i + 1}`, text: nq.text, weight: Math.min(7, Math.max(1, Math.round(nq.weight))), priority: 999, answered: false });
          });
          questionState.questions.sort((a, b) => {
            const aActive = !a.answered && !a.deprecated;
            const bActive = !b.answered && !b.deprecated;
            if (aActive !== bActive) return aActive ? -1 : 1;
            if (!a.answered && !b.answered) return b.weight - a.weight;
            return 0;
          });
          let p = 1;
          questionState.questions.forEach(q => { q.priority = (!q.answered && !q.deprecated) ? p++ : 999; });
          questionState.clarity = computeClarity(questionState.questions);
        } catch (e) {
          console.warn('[qstate] failed to parse update:', (e as Error).message);
        }
      }
    }

    if (listenFirstTool) {
      res.write(`data: ${JSON.stringify({ type: 'question_state', state: questionState })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // ── Record spend after response (fire-and-forget) ──────────────────────
    if (sessionId && fullResponse) {
      // Approximate token counts from character length (4 chars ≈ 1 token)
      const inputTokens  = Math.ceil((systemParts.length + message.length) / 4);
      const outputTokens = Math.ceil(fullResponse.length / 4);
      const costCents    = estimateCostCents(llmProvider ?? 'gemini', inputTokens, outputTokens);
      updateSessionSpend(sessionId, message, fullResponse, costCents).catch(e =>
        console.error('[spend] updateSessionSpend failed:', (e as Error).message)
      );
    }

  } catch (e: unknown) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', chunk: (e as Error).message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({ error: (e as Error).message });
    }
  }
});

// ── Generate questions from a completed chat session ─────────────────────────

app.post('/chat/generate-questions', requireShellToken, async (req: Request, res: Response) => {
  try {
    const { coachSlug, history, personType, llmProvider } = req.body as {
      coachSlug:   string;
      history:     { role: 'user' | 'assistant'; content: string }[];
      personType?: 'client' | 'trainee' | 'prospect';
      llmProvider?: 'gemini' | 'azure-openai';
    };

    if (!history || history.length < 3) {
      res.json({ success: true, count: 0, reason: 'below_min_turns' });
      return;
    }

    console.log(`[generate-questions] coach=${coachSlug} personType=${personType ?? 'prospect'} historyLength=${history.length}`);

    const coach = await getCoachBySlug(coachSlug);

    const conversationText = history
      .map(m => `${m.role === 'user' ? 'Person' : 'Coach AI'}: ${m.content}`)
      .join('\n');

    const systemPrompt = [
      'You are analyzing a coaching conversation.',
      'Extract all distinct questions — explicit or implicit — that the person had during this conversation.',
      'Include questions about the coach\'s methods, opinions, experiences, or any topic they were curious about.',
      'Output ONLY a valid JSON array of short question strings (under 30 words each).',
      'If there are no questions at all, output: []',
    ].join(' ');

    const llm = getLLMClient(llmProvider);
    const rawFull = (await llm.generateText(systemPrompt, conversationText)).trim();
    // Strip <think>...</think> blocks (Phi-4 reasoning model), then markdown code fences (Gemini/GPT)
    const raw = rawFull
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
    console.log(`[generate-questions] LLM raw output:`, raw);

    let questions: string[] = [];
    let parseError = false;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        questions = parsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 5);
      }
      console.log(`[generate-questions] parsed ${parsed.length} items from LLM, ${questions.length} passed filter (string + length > 5)`);
    } catch {
      parseError = true;
      console.warn(`[generate-questions] LLM output was not valid JSON — attempting line extraction. Raw: ${raw}`);
      // Fallback: extract any sentence ending with "?" from the raw output
      questions = raw
        .split(/\n/)
        .map(line => line.replace(/^[\s\-*\d.]+/, '').trim())
        .filter(line => line.endsWith('?') && line.length > 5);
      console.log(`[generate-questions] fallback extracted ${questions.length} question(s)`);
    }

    if (questions.length === 0) {
      const reason = parseError ? 'json_parse_error' : 'llm_empty';
      console.log(`[generate-questions] 0 questions after filtering — reason: ${reason}`);
      res.json({ success: true, count: 0, reason });
      return;
    }

    // Deduplicate against existing questions for this coach
    const { data: existingRows } = await supabase
      .from('coach_questions')
      .select('question')
      .eq('coach_id', coach.userId);

    function normalizeQ(q: string) {
      return q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    const existingNormalized = new Set<string>(
      (existingRows ?? []).map((r: { question: string }) => normalizeQ(r.question))
    );

    const newQuestions = questions.filter(q => !existingNormalized.has(normalizeQ(q)));
    const duplicateCount = questions.length - newQuestions.length;
    if (duplicateCount > 0) {
      console.log(`[generate-questions] ${duplicateCount} duplicate(s) skipped, ${newQuestions.length} new question(s) to insert`);
    }

    if (newQuestions.length === 0) {
      res.json({ success: true, count: 0, reason: 'all_duplicates' });
      return;
    }

    const rows = newQuestions.map(q => ({
      coach_id:      coach.userId,
      question:      q.trim(),
      person_type:   personType ?? 'prospect',
      coaching_type: coach.coachingType ?? null,
    }));

    console.log(`[generate-questions] inserting ${rows.length} question(s):`, rows.map(r => r.question));
    const { error: insertError } = await supabase.from('coach_questions').insert(rows);
    if (insertError) {
      console.error(`[generate-questions] Supabase insert error:`, insertError);
    } else {
      console.log(`[generate-questions] successfully inserted ${newQuestions.length} question(s) into coach_questions`);
    }

    res.json({ success: true, count: newQuestions.length });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Multi-agent mode: export app for mounting by parent server
if (process.env.MULTI_AGENT_MODE === 'true') {
  export { app as personaChatApp };
  console.log(`[${AGENT_ID}] Exported for multi-agent mode`);
} else {
  // Standalone mode: start server
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}
