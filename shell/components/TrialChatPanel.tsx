'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from '@/components/SessionProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionItem {
  id: string;
  text: string;
  weight: number;
  priority: number;
  answered: boolean;
}

interface QuestionState {
  questions: QuestionItem[];
  clarity: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking: string;
  cards: LibraryCard[];
  pending: boolean;
}

interface LibraryCard {
  itemId: string;
  title: string;
  itemType: string;
  description?: string;
  buyLink?: string;
  thumbnailUrl?: string;
  url?: string;
  tags?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2); }

function renderText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-100 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    if (part === '\n') return <br key={i} />;
    return part;
  });
}

function typeIcon(itemType: string) {
  switch (itemType) {
    case 'video':   return '🎬';
    case 'book':    return '📖';
    case 'article': return '📄';
    case 'podcast': return '🎙️';
    default:        return '🗂️';
  }
}

// ── Library card ──────────────────────────────────────────────────────────────

function LibraryCardView({ card }: { card: LibraryCard }) {
  const href = card.buyLink ?? card.url;
  const inner = (
    <div className="border rounded-xl p-3 flex items-start gap-2.5 mt-1 bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors w-56">
      {card.thumbnailUrl ? (
        <img src={card.thumbnailUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" />
      ) : (
        <span className="text-lg shrink-0 mt-0.5">{typeIcon(card.itemType)}</span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-xs leading-tight">{card.title}</p>
        <p className="text-xs opacity-60 capitalize mt-0.5">{card.itemType}</p>
        {card.description && (
          <p className="text-xs opacity-70 mt-1 leading-snug line-clamp-2">{card.description}</p>
        )}
      </div>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a> : inner;
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div className={'max-w-[85%] flex flex-col gap-1 ' + (isUser ? 'items-end' : 'items-start')}>
        {!isUser && msg.thinking && (
          <p className="text-xs text-gray-400 italic leading-relaxed mb-1 max-w-[85%] line-clamp-3">
            ({msg.thinking.length > 140 ? msg.thinking.slice(0, 140) + '…' : msg.thinking})
          </p>
        )}
        <div className={
          'rounded-2xl px-4 py-3 text-sm leading-relaxed ' +
          (isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm')
        }>
          {msg.pending && msg.content === '' && !msg.thinking ? (
            <span className="inline-flex gap-1 py-0.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
          ) : renderText(msg.content)}
        </div>
        {msg.cards.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {msg.cards.map((card, i) => <LibraryCardView key={i} card={card} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrialChatPanel() {
  const { userId } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [slugError, setSlugError] = useState(false);
  const [noPersona, setNoPersona] = useState(false);
  const [questionState, setQuestionState] = useState<QuestionState | null>(null);
  const [chatTools, setChatTools] = useState<{type: string; enabled: boolean; settings?: {questionPhaseRounds?: number}}[]>(() => {
    try { const raw = localStorage.getItem('chatTools'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const bottomRef   = useRef<HTMLDivElement>(null);
  const historyRef  = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Fetch coach slug, persona status, and listener-first setting
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetch(`/api/coaches/profile?userId=${userId}`).then(r => r.json()) as Promise<{ success: boolean; data?: { slug?: string } }>,
      fetch('/api/agents/coaching-persona-chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_chat_tools', params: {}, userId }),
      }).then(r => r.json()) as Promise<{ success?: boolean; data?: { tools?: {type: string; enabled: boolean; settings?: {questionPhaseRounds?: number}}[] } }>,
    ]).then(async ([profileData, toolsData]) => {
      if (profileData.success && profileData.data?.slug) {
        setCoachSlug(profileData.data.slug);
        // Check if persona has been built yet
        try {
          const res = await fetch('/api/agents/coaching-persona-chat/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_persona_preview', params: {}, userId }),
          });
          const json = await res.json() as { success?: boolean; data?: unknown };
          if (!json.success || !json.data) setNoPersona(true);
        } catch { setNoPersona(true); }
      } else {
        setSlugError(true);
      }
      if (toolsData.success) {
        const tools = toolsData.data?.tools ?? [];
        setChatTools(tools);
        try { localStorage.setItem('chatTools', JSON.stringify(tools)); } catch { /* ignore */ }
      }
    }).catch(() => setSlugError(true));
  }, [userId]);

  // Sync when PromptTweakPanel saves tools
  useEffect(() => {
    function onSync(e: Event) {
      const tools = (e as CustomEvent<{type: string; enabled: boolean}[]>).detail;
      setChatTools(tools);
      try { localStorage.setItem('chatTools', JSON.stringify(tools)); } catch { /* ignore */ }
    }
    window.addEventListener('chat-tools-updated', onSync);
    return () => window.removeEventListener('chat-tools-updated', onSync);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const onPersonaUpdated = async () => {
      try {
        const res = await fetch('/api/agents/coaching-persona-chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_persona_preview', params: {}, userId }),
        });
        const json = await res.json() as { success?: boolean; data?: unknown };
        if (json.success && json.data) setNoPersona(false);
      } catch { /* ignore */ }
    };
    window.addEventListener('persona-updated', onPersonaUpdated);
    return () => window.removeEventListener('persona-updated', onPersonaUpdated);
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming || !coachSlug) return;
    setInput('');
    setStreaming(true);

    const userMsg: Message = { id: genId(), role: 'user', content: userText, cards: [], pending: false };
    setMessages(prev => [...prev, userMsg]);

    const asstId = genId();
    setMessages(prev => [...prev, { id: asstId, role: 'assistant', content: '', thinking: '', cards: [], pending: true }]);
    historyRef.current.push({ role: 'user', content: userText });

    let fullText = '';

    try {
      const res = await fetch(`/api/coaches/${coachSlug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyRef.current.slice(0, -1), questionState }),
      });

      if (!res.ok || !res.body) throw new Error(`Chat unavailable (${res.status})`);

      // Persona is clearly up — hide the "not built" banner
      setNoPersona(false);

      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();
      let buffer     = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        streamDone = done;
        if (value) buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;

            // Handle thought chunks — show as italic grey thinking text
            if (parsed.type === 'thought' && typeof parsed.chunk === 'string') {
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, thinking: m.thinking + parsed.chunk } : m
              ));
            // Handle both { type:'text', chunk } and bare { chunk } from the agent
            } else if (typeof parsed.chunk === 'string' && (parsed.type === 'text' || !parsed.type)) {
              // Replace the agent's raw "not configured" message with a friendlier CTA
              const chunk = (parsed.chunk as string).includes('persona not yet configured')
                ? 'Your persona hasn\'t been set up yet. Use the "Build Persona" button in the right panel to generate it from your library, then come back and chat.'
                : parsed.chunk as string;
              fullText += chunk;
              const snap = fullText;
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, content: snap, pending: true } : m
              ));
            } else if (parsed.type === 'question_state') {
              setQuestionState(parsed.state as QuestionState);
            } else if (parsed.type === 'agui') {
              const event = parsed.event as { type: string; toolName?: string; output?: LibraryCard };
              if (event?.type === 'TOOL_CALL_END' && event.toolName === 'library_item_card' && event.output) {
                setMessages(prev => prev.map(m =>
                  m.id === asstId ? { ...m, cards: [...m.cards, event.output!] } : m
                ));
              }
            }
          } catch { /* skip malformed */ }
        }
      }

      // Agent returned nothing — persona likely not built yet
      if (!fullText) {
        fullText = 'Your persona hasn\'t been built yet. Use "Rebuild Persona" on the right panel, then try again.';
        setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: fullText, thinking: '' } : m));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: `Error: ${msg}`, pending: false } : m
      ));
    } finally {
      historyRef.current.push({ role: 'assistant', content: fullText });
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, pending: false } : m));
      setStreaming(false);
    }
  }, [streaming, coachSlug]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <div>
            <h2 className="font-semibold text-gray-900 text-sm leading-tight">Trial Chat</h2>
            <p className="text-xs text-gray-400">Simulating your client experience · Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
      </div>

      {/* Slug error banner */}
      {slugError && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-xs text-red-600 shrink-0">
          Could not load your coach profile. Please refresh the page.
        </div>
      )}

      {/* No-persona banner */}
      {noPersona && !slugError && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 shrink-0 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>Your persona hasn&apos;t been built yet. Open the <strong>right panel</strong> and click <strong>Build Persona</strong> — this chat will work once it&apos;s done.</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            <p className="text-3xl mb-3">🧠</p>
            <p className="font-medium text-gray-500">This is how your clients will experience you.</p>
            <p className="text-xs mt-1">Your persona, library, and custom instructions all feed into this chat.</p>
            <div className="mt-6 flex flex-col gap-2">
              {[
                "What's your coaching approach?",
                'Can you recommend a book for me?',
                'How do I get started?',
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  className="text-left text-xs bg-white border border-gray-200 rounded-xl px-4 py-2 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-gray-200 bg-white shrink-0">
        {questionState && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 mb-2 px-1">
            <span className="shrink-0">Clarity</span>
            <div className="flex-1 bg-indigo-100 rounded-full h-1.5">
              <div style={{ width: `${questionState.clarity}%` }} className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" />
            </div>
            <span className="shrink-0 tabular-nums">{Math.round(questionState.clarity)}%</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px] max-h-32"
            placeholder={slugError ? 'Profile unavailable' : coachSlug ? 'Type a message…' : 'Loading your persona…'}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={streaming || !coachSlug || slugError}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={streaming || !input.trim() || !coachSlug}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
