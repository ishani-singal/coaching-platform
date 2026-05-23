'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '@/components/SessionProvider';

type Snapshot = { version: number; tone: string; style: string; summary: string } | null;
type ChatToolType = 'listen_first' | 'reflective_acknowledgement' | 'reply_style';
type ReplyStyle = 'narrative' | 'bullet' | 'mixed' | 'socratic';
interface ChatTool { type: ChatToolType; enabled: boolean; settings?: { questionPhaseRounds?: number; replyStyle?: ReplyStyle } }

const DEFAULT_TOOLS: ChatTool[] = [
  { type: 'listen_first',              enabled: false, settings: { questionPhaseRounds: 3 } },
  { type: 'reflective_acknowledgement', enabled: false, settings: {} },
  { type: 'reply_style',               enabled: false, settings: { replyStyle: 'narrative' } },
];

function mergeChatTools(saved: ChatTool[]): ChatTool[] {
  return DEFAULT_TOOLS.map(def => {
    const found = saved.find(t => t.type === def.type);
    return found ?? def;
  });
}

interface CoachQuestion {
  question_id:   string;
  question:      string;
  person_type:   'client' | 'trainee' | 'prospect' | null;
  coaching_type: string | null;
  answer:        string | null;
  answered_at:   string | null;
  created_at:    string;
}

export default function PromptTweakPanel() {
  const { userId } = useSession();
  const [snapshot, setSnapshot]   = useState<Snapshot>(null);
  const [chatTools, setChatTools]   = useState<ChatTool[]>(() => {
    try {
      const raw = localStorage.getItem('chatTools');
      return raw ? mergeChatTools(JSON.parse(raw) as ChatTool[]) : DEFAULT_TOOLS;
    } catch { return DEFAULT_TOOLS; }
  });
  const [toolsSaving, setToolsSaving] = useState(false);
  const [building, setBuilding]     = useState(false);
  const [buildStatus, setBuildStatus] = useState('');
  const [indexing, setIndexing]     = useState(false);
  // Questions from conversations
  const [questions, setQuestions]       = useState<CoachQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [answerDraft, setAnswerDraft]   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]     = useState<Record<string, boolean>>({});
  const [indexLogs, setIndexLogs]   = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const autoBuildAttempted = useRef(false);

  // Picker state (shared between Videos and Podcasts)
  type LibItem = { itemId: string; title: string; itemType: string; embeddedAt?: string; thumbnailUrl?: string; transcript?: string };
  const [pickerType,    setPickerType]    = useState<'video' | 'podcast' | null>(null);
  const [pickerItems,   setPickerItems]   = useState<LibItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [manualItemId,  setManualItemId]  = useState<string | null>(null);
  const [manualText,    setManualText]    = useState('');
  const [manualSaving,  setManualSaving]  = useState(false);

  // Whisper stats
  type WhisperStats = { totalMinutes: number; totalItems: number };
  const [whisperStats,        setWhisperStats]        = useState<WhisperStats | null>(null);
  const [whisperStatsLoading, setWhisperStatsLoading] = useState(false);

  const callAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/agents/coaching-persona-chat/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    });
    const json = await res.json() as { success: boolean; data?: Record<string, unknown>; message?: string };
    if (!res.ok || json.success === false) {
      throw new Error(json.message ?? `Action ${action} failed (${res.status})`);
    }
    return json;
  }, [userId]);

  const callLibraryAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/agents/coaching-coach-library/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    });
    const json = await res.json() as { success: boolean; message?: string; data?: Record<string, unknown> };
    if (!res.ok || json.success === false) {
      throw new Error(json.message ?? `Action ${action} failed`);
    }
    return json;
  }, [userId]);

  const loadWhisperStats = useCallback(async () => {
    if (!userId) return;
    setWhisperStatsLoading(true);
    try {
      const r = await callLibraryAction('get_whisper_stats', {});
      const d = r.data as { totalMinutes?: number; totalItems?: number };
      setWhisperStats({ totalMinutes: d?.totalMinutes ?? 0, totalItems: d?.totalItems ?? 0 });
    } catch { /* silently ignore */ } finally {
      setWhisperStatsLoading(false);
    }
  }, [userId, callLibraryAction]);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const res  = await fetch('/api/coach-questions');
      const json = await res.json() as { success: boolean; data?: CoachQuestion[] };
      if (json.success && json.data) setQuestions(json.data);
    } catch { /* ignore */ } finally {
      setQuestionsLoading(false);
    }
  }, []);

  async function handleAnswer(q: CoachQuestion) {
    const answer = answerDraft[q.question_id]?.trim();
    if (!answer) return;
    setSubmitting(prev => ({ ...prev, [q.question_id]: true }));
    try {
      const res = await fetch(`/api/coach-questions/${q.question_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      if (res.ok) {
        setQuestions(prev =>
          prev.map(item =>
            item.question_id === q.question_id
              ? { ...item, answer, answered_at: new Date().toISOString() }
              : item
          )
        );
        setAnswerDraft(prev => { const n = { ...prev }; delete n[q.question_id]; return n; });
      }
    } catch { /* ignore */ } finally {
      setSubmitting(prev => { const n = { ...prev }; delete n[q.question_id]; return n; });
    }
  }

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      callAction('get_persona_preview', {}),
      callAction('get_chat_tools', {}),
    ]).then(async ([snapRes, toolsRes]) => {
      const savedTools = (toolsRes.data as { tools?: ChatTool[] })?.tools ?? [];
      const merged = mergeChatTools(savedTools);
      setChatTools(merged);
      try { localStorage.setItem('chatTools', JSON.stringify(merged)); } catch { /* ignore */ }
      const snap = (snapRes.data as Snapshot) ?? null;
      if (snap) {
        setSnapshot(snap);
      } else if (!autoBuildAttempted.current) {
        autoBuildAttempted.current = true;
        // No persona yet — auto-build from existing library & settings
        setBuilding(true);
        setBuildStatus('Building your persona from your library…');
        try {
          await callAction('build_persona', {});
          const rebuilt = await callAction('get_persona_preview', {});
          setSnapshot((rebuilt.data as Snapshot) ?? null);
          setBuildStatus('Persona ready.');
          window.dispatchEvent(new Event('persona-updated'));
          setTimeout(() => setBuildStatus(''), 4000);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setBuildStatus(msg);
        } finally {
          setBuilding(false);
        }
      }
    });
    loadWhisperStats();
    loadQuestions();
  }, [userId, callAction, loadWhisperStats, loadQuestions]);

  // Sync when TrialChatPanel updates tools
  useEffect(() => {
    function onSync(e: Event) {
      const tools = (e as CustomEvent<ChatTool[]>).detail;
      setChatTools(tools);
    }
    window.addEventListener('chat-tools-updated', onSync);
    return () => window.removeEventListener('chat-tools-updated', onSync);
  }, []);

  async function handleIndex(label: string, types: string[]) {
    if (indexing) return;
    setIndexing(true);
    setIndexLogs([`🔍 Fetching unindexed ${label} items…`]);

    const pushLog = (line: string) =>
      setIndexLogs(prev => {
        const next = [...prev, line];
        // auto-scroll on next paint
        requestAnimationFrame(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
        });
        return next;
      });

    try {
      // 1. Collect all pending items across the requested types
      type LibItem = { itemId: string; title: string; itemType: string; embeddedAt?: string };
      const pending: LibItem[] = [];
      for (const type of types) {
        const res = await callLibraryAction('get_library', { itemType: type });
        const all = ((res.data as { items?: LibItem[] })?.items ?? []) as LibItem[];
        const unembedded = all.filter(i => !i.embeddedAt);
        pending.push(...unembedded);
      }

      if (pending.length === 0) {
        pushLog(`✅ Nothing to index — all ${label} items are already embedded.`);
        return;
      }

      pushLog(`📋 Found ${pending.length} item${pending.length > 1 ? 's' : ''} to index:`);
      for (const item of pending) pushLog(`   • ${item.title}`);
      pushLog('');

      // 2. Transcribe one by one
      let done = 0, failed = 0;
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        pushLog(`⏳ [${i + 1}/${pending.length}] Indexing: "${item.title}"…`);
        try {
          const r = await callLibraryAction('transcribe_item', { itemId: item.itemId });
          pushLog(`   ✓ ${r.message ?? 'Done'}`);
          done++;
        } catch (err: unknown) {
          pushLog(`   ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
          failed++;
        }
      }

      pushLog('');
      pushLog(`🏁 Finished — ${done} indexed${failed > 0 ? `, ${failed} failed` : ''}.`);

      if (done > 0) {
        pushLog('');
        pushLog('🔄 Rebuilding persona with new content…');
        try {
          await callAction('build_persona', {});
          const rebuilt = await callAction('get_persona_preview', {});
          const newSnap = (rebuilt.data as Snapshot) ?? null;
          setSnapshot(newSnap);
          pushLog(`✓ Persona updated${newSnap ? ` (v${newSnap.version})` : ''}.`);
          window.dispatchEvent(new Event('persona-updated'));
        } catch (err: unknown) {
          pushLog(`⚠️ Persona rebuild failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        await loadWhisperStats();
      }
    } catch (err: unknown) {
      pushLog(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIndexing(false);
    }
  }

  async function openPicker(type: 'video' | 'podcast') {
    setPickerType(type);
    setPickerItems([]);
    setManualItemId(null);
    setManualText('');
    setPickerLoading(true);
    try {
      const itemType = type === 'video' ? 'youtube' : 'podcast';
      const res = await callLibraryAction('get_library', { itemType });
      const all = ((res.data as { items?: LibItem[] })?.items ?? []) as LibItem[];
      // Show items without a transcript (need indexing)
      const pending = all.filter(i => !i.transcript);
      setPickerItems(pending);
    } catch (err) {
      console.error('[PromptTweakPanel] openPicker failed:', err);
    } finally {
      setPickerLoading(false);
    }
  }

  async function handleSaveManualTranscript(item: LibItem) {
    if (!manualText.trim()) return;
    setManualSaving(true);
    setPickerType(null);
    setIndexLogs([]);
    setIndexing(true);
    const pushLog = (line: string) =>
      setIndexLogs(prev => {
        const next = [...prev, line];
        requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });
        return next;
      });
    pushLog(`📝 Saving manual transcript for "${item.title}"…`);
    pushLog(`   ${manualText.trim().length.toLocaleString()} chars`);
    pushLog(`🔧 Chunking and embedding into vector store…`);
    try {
      await callLibraryAction('save_and_index_transcript', { itemId: item.itemId, transcript: manualText });
      pushLog(`✅ Transcript indexed.`);
      pushLog('');
      pushLog('🔄 Rebuilding persona…');
      try {
        await callAction('build_persona', {});
        const rebuilt = await callAction('get_persona_preview', {});
        const newSnap = (rebuilt.data as Snapshot) ?? null;
        setSnapshot(newSnap);
        pushLog(`✓ Persona updated${newSnap ? ` (v${newSnap.version})` : ''}.`);
        window.dispatchEvent(new Event('persona-updated'));
      } catch (err: unknown) {
        pushLog(`⚠️ Persona rebuild failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      await loadWhisperStats();
    } catch (err) {
      pushLog(`❌ Failed: ${err instanceof Error ? (err as Error).message : String(err)}`);
      console.error('[PromptTweakPanel] save_and_index_transcript failed:', err);
    } finally {
      setManualSaving(false);
      setIndexing(false);
      setManualItemId(null);
      setManualText('');
    }
  }

  async function handleTranscribeItem(item: LibItem) {
    setPickerType(null);
    setIndexLogs([]);
    setIndexing(true);
    const pushLog = (line: string) =>
      setIndexLogs(prev => {
        const next = [...prev, line];
        requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });
        return next;
      });
    pushLog(`⏳ Transcribing: "${item.title}"…`);
    try {
      const r = await callLibraryAction('transcribe_item', { itemId: item.itemId });
      pushLog(`   ✓ ${r.message ?? 'Done'}`);
      pushLog('');
      pushLog('🔄 Rebuilding persona…');
      await callAction('build_persona', {});
      const rebuilt = await callAction('get_persona_preview', {});
      const newSnap = (rebuilt.data as Snapshot) ?? null;
      setSnapshot(newSnap);
      pushLog(`✓ Persona updated${newSnap ? ` (v${newSnap.version})` : ''}.`);
      window.dispatchEvent(new Event('persona-updated'));
      await loadWhisperStats();
    } catch (err: unknown) {
      pushLog(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIndexing(false);
    }
  }

  return (
    <>
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎛️</span>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm leading-tight">Chat Instructions</h2>
            <p className="text-xs text-gray-400">Customise how your AI responds to clients</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

        {/* No-persona setup banner — only shown if auto-build failed */}
        {!snapshot && !building && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Persona not yet built</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Add library items to your coaching library — your persona will be built automatically once content is indexed.
            </p>
            {buildStatus && <p className="text-xs text-red-600 mt-2">{buildStatus}</p>}
          </div>
        )}

        {/* Auto-building indicator */}
        {building && !snapshot && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-4 flex items-center gap-3">
            <svg className="animate-spin h-4 w-4 text-indigo-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-xs text-indigo-700">{buildStatus || 'Building your persona…'}</p>
          </div>
        )}

        {/* ── 1. How the chat is built ─────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How the chat is built</p>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Persona — extracted tone &amp; style from your library</li>
            <li>RAG context — library items relevant to the client&apos;s question</li>
            <li>Chat behaviours — listen-first, reflective acknowledgement, reply style</li>
          </ol>
          <p className="text-xs text-gray-400 mt-2">The trial chat on the left uses the same prompt as the live client chat on your website.</p>
        </div>

        {/* ── 2. RAG Index ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">RAG Index</p>
          <p className="text-xs text-gray-400 mb-3">
            Embed library content into your vector store so the chat can retrieve it. Run after adding new items.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Podcasts', type: 'podcast' as const },
              { label: 'Videos',   type: 'video'   as const },
            ]).map(({ label, type }) => (
              <button
                key={label}
                type="button"
                onClick={() => openPicker(type)}
                disabled={indexing || pickerLoading}
                className="text-xs border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-left"
              >
                {label}
              </button>
            ))}
          </div>

          {indexLogs.length > 0 && (
            <div
              ref={logRef}
              className="mt-3 bg-gray-950 rounded-lg px-3 py-2.5 max-h-52 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
            >
              {indexLogs.map((line, i) =>
                line === '' ? (
                  <div key={i} className="h-1" />
                ) : (
                  <div
                    key={i}
                    className={
                      line.startsWith('✅') || line.startsWith('✓') || line.startsWith('🏁')
                        ? 'text-green-400'
                        : line.startsWith('✗') || line.startsWith('❌')
                          ? 'text-red-400'
                          : line.startsWith('⏳')
                            ? 'text-yellow-300'
                            : line.startsWith('📋') || line.startsWith('🔍')
                              ? 'text-indigo-300'
                              : line.startsWith('   •')
                                ? 'text-gray-300'
                                : 'text-gray-400'
                    }
                  >
                    {line}
                  </div>
                )
              )}
              {indexing && (
                <div className="text-gray-500 animate-pulse">▌</div>
              )}
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400">
            {whisperStatsLoading
              ? 'Loading stats…'
              : whisperStats !== null
                ? `~${whisperStats.totalMinutes} min whisper-transcribed (${whisperStats.totalItems} item${whisperStats.totalItems !== 1 ? 's' : ''})`
                : null
            }
          </div>
        </div>

        {/* ── 3. Questions from Conversations ──────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions from Conversations</p>
              <p className="text-xs text-gray-400 mt-0.5">Your answers improve AI chat responses</p>
            </div>
            {questions.filter(q => !q.answer).length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">
                {questions.filter(q => !q.answer).length} new
              </span>
            )}
          </div>

          {questionsLoading && (
            <p className="text-xs text-gray-400">Loading…</p>
          )}

          {!questionsLoading && questions.filter(q => !q.answer).length === 0 && (
            <p className="text-xs text-gray-400">No unanswered questions yet. Questions appear as clients chat with your AI persona.</p>
          )}

          <div className="space-y-3">
            {questions.filter(q => !q.answer).map(q => (
              <div key={q.question_id} className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-800 leading-snug mb-2">{q.question}</p>
                <div className="flex gap-1.5 mb-3">
                  {q.person_type && (
                    <span className="text-xs bg-white border border-indigo-200 text-indigo-600 rounded-full px-2 py-0.5">
                      {q.person_type === 'trainee' ? 'Trainee' : q.person_type === 'client' ? 'Client' : 'Prospect'}
                    </span>
                  )}
                  {q.coaching_type && (
                    <span className="text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5 capitalize">
                      {q.coaching_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <textarea
                  className="w-full resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[68px] bg-white"
                  placeholder="Share your experience or perspective…"
                  value={answerDraft[q.question_id] ?? ''}
                  onChange={e => setAnswerDraft(prev => ({ ...prev, [q.question_id]: e.target.value }))}
                  disabled={submitting[q.question_id]}
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    disabled={submitting[q.question_id] || !answerDraft[q.question_id]?.trim()}
                    onClick={() => handleAnswer(q)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    {submitting[q.question_id] ? 'Saving…' : 'Save Answer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. Chat Behaviours ───────────────────────────────────────────── */}
        {snapshot && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chat Behaviours</p>

            {/* Listen First */}
            {(() => {
              const tool = chatTools.find(t => t.type === 'listen_first')!;
              const saveTool = async (patch: Partial<ChatTool>) => {
                const next = chatTools.map(t => t.type === 'listen_first' ? { ...t, ...patch, settings: { ...t.settings, ...(patch.settings ?? {}) } } : t);
                setToolsSaving(true);
                try {
                  await callAction('update_chat_tools', { tools: next });
                  setChatTools(next);
                  try { localStorage.setItem('chatTools', JSON.stringify(next)); } catch { /* ignore */ }
                  window.dispatchEvent(new CustomEvent('chat-tools-updated', { detail: next }));
                } catch { /* ignore */ } finally { setToolsSaving(false); }
              };
              return (
                <div className={`rounded-lg border px-3 py-2.5 bg-white ${tool.enabled ? 'border-teal-300' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">🎧 Listen First</p>
                      <p className="text-xs text-gray-400 mt-0.5">Asks questions until it fully understands the situation — no fixed number.</p>
                    </div>
                    <button
                      type="button"
                      disabled={toolsSaving}
                      onClick={() => saveTool({ enabled: !tool.enabled })}
                      className={`shrink-0 text-xs rounded-full px-3 py-1 border transition-colors disabled:opacity-50 ${tool.enabled ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600'}`}
                    >
                      {toolsSaving ? '…' : tool.enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Reflective Acknowledgement */}
            {(() => {
              const tool = chatTools.find(t => t.type === 'reflective_acknowledgement')!;
              const saveTool = async (patch: Partial<ChatTool>) => {
                const next = chatTools.map(t => t.type === 'reflective_acknowledgement' ? { ...t, ...patch } : t);
                setToolsSaving(true);
                try {
                  await callAction('update_chat_tools', { tools: next });
                  setChatTools(next);
                  try { localStorage.setItem('chatTools', JSON.stringify(next)); } catch { /* ignore */ }
                  window.dispatchEvent(new CustomEvent('chat-tools-updated', { detail: next }));
                } catch { /* ignore */ } finally { setToolsSaving(false); }
              };
              return (
                <div className={`rounded-lg border px-3 py-2.5 bg-white ${tool.enabled ? 'border-indigo-300' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">🪞 Reflective Acknowledgement</p>
                      <p className="text-xs text-gray-400 mt-0.5">Reflect + acknowledge before every answer.</p>
                    </div>
                    <button
                      type="button"
                      disabled={toolsSaving}
                      onClick={() => saveTool({ enabled: !tool.enabled })}
                      className={`shrink-0 text-xs rounded-full px-3 py-1 border transition-colors disabled:opacity-50 ${tool.enabled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'}`}
                    >
                      {toolsSaving ? '…' : tool.enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Reply Style */}
            {(() => {
              const tool = chatTools.find(t => t.type === 'reply_style')!;
              const style = tool?.settings?.replyStyle ?? 'narrative';
              const styles: { value: ReplyStyle; label: string; desc: string }[] = [
                { value: 'narrative', label: 'Narrative', desc: 'Flowing prose sentences' },
                { value: 'bullet',    label: 'Bullets',   desc: 'Short bullet points' },
                { value: 'mixed',     label: 'Mixed',     desc: 'One sentence + bullet points' },
                { value: 'socratic',  label: 'Socratic',  desc: 'Questions that guide insight' },
              ];
              const saveTool = async (patch: Partial<ChatTool>) => {
                const next = chatTools.map(t => t.type === 'reply_style' ? { ...t, ...patch, settings: { ...t.settings, ...(patch.settings ?? {}) } } : t);
                setToolsSaving(true);
                try {
                  await callAction('update_chat_tools', { tools: next });
                  setChatTools(next);
                  try { localStorage.setItem('chatTools', JSON.stringify(next)); } catch { /* ignore */ }
                  window.dispatchEvent(new CustomEvent('chat-tools-updated', { detail: next }));
                } catch { /* ignore */ } finally { setToolsSaving(false); }
              };
              return (
                <div className={`rounded-lg border px-3 py-2.5 bg-white ${tool?.enabled ? 'border-violet-300' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">✏️ Reply Style</p>
                      <p className="text-xs text-gray-400 mt-0.5">How the coach structures its replies.</p>
                    </div>
                    <button
                      type="button"
                      disabled={toolsSaving}
                      onClick={() => saveTool({ enabled: !tool?.enabled })}
                      className={`shrink-0 text-xs rounded-full px-3 py-1 border transition-colors disabled:opacity-50 ${tool?.enabled ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-500 hover:border-violet-400 hover:text-violet-600'}`}
                    >
                      {toolsSaving ? '…' : tool?.enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  {tool?.enabled && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {styles.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          disabled={toolsSaving}
                          onClick={() => saveTool({ settings: { replyStyle: s.value } })}
                          title={s.desc}
                          className={`text-xs rounded-full px-3 py-1 border transition-colors disabled:opacity-50 ${style === s.value ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-400'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── 5. Current Persona ───────────────────────────────────────────── */}
        {snapshot && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Persona · v{snapshot.version}</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700">
                <span className="text-gray-400">Tone</span> {snapshot.tone}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-700">
                <span className="text-gray-400">Style</span> {snapshot.style}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{snapshot.summary}</p>
          </div>
        )}

      </div>
    </div>

    {/* RAG Picker Popup Modal */}
    {pickerType && !indexing && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40"
        onClick={() => { setPickerType(null); setManualItemId(null); setManualText(''); }}
      >
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[80vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <span className="text-sm font-semibold text-gray-800">
              {pickerType === 'video' ? '🎥 Videos' : '🎙️ Podcasts'} without a transcript
            </span>
            <button
              type="button"
              title="Close"
              onClick={() => { setPickerType(null); setManualItemId(null); setManualText(''); }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {pickerLoading ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">Loading…</div>
            ) : pickerItems.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">All items already have a transcript.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pickerItems.map(item => (
                  <li key={item.itemId} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700 truncate flex-1" title={item.title}>{item.title}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setManualItemId(manualItemId === item.itemId ? null : item.itemId); setManualText(''); }}
                          title="Enter transcript manually"
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                        >
                          ✏️ Manual
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTranscribeItem(item)}
                          title="Transcribe with Whisper AI"
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                        >
                          🎙️ Whisper
                        </button>
                      </div>
                    </div>
                    {manualItemId === item.itemId && (
                      <div className="mt-2">
                        <textarea
                          className="w-full border border-gray-200 rounded px-2.5 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Paste transcript here…"
                          value={manualText}
                          onChange={e => setManualText(e.target.value)}
                          disabled={manualSaving}
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button
                            type="button"
                            disabled={manualSaving || !manualText.trim()}
                            onClick={() => handleSaveManualTranscript(item)}
                            className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {manualSaving ? 'Saving…' : 'Save & Index'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setManualItemId(null); setManualText(''); }}
                            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

    </>
  );
}
