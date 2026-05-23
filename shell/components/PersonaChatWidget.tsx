'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

type Message = { role: 'user' | 'assistant'; content: string; thinking?: string };
type LibraryCard = {
  itemId: string;
  title: string;
  itemType: string;
  url?: string;
  buyLink?: string;
  thumbnailUrl?: string;
  tags?: string[];
};

interface SessionState {
  sessionId:          string;
  messageCount:       number;
  estimatedCostCents: number;
  isPaid:             boolean;
  isAuthenticated:    boolean;
  paidChatEnabled:    boolean;
  limits: {
    freeMessageLimit:   number;
    freeCostLimitCents: number;
    paidChatPriceUsd:   number | null;
  };
}

const INACTIVITY_MS = 60 * 1000;
const MIN_TURNS     = 3;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function PersonaChatWidget({
  coachSlug,
  personType = 'prospect',
}: {
  coachSlug:   string;
  personType?: 'client' | 'trainee' | 'prospect';
}) {
  const [messages, setMessages]               = useState<Message[]>([]);
  const [cards, setCards]                     = useState<LibraryCard[]>([]);
  const [input, setInput]                     = useState('');
  const [streaming, setStreaming]             = useState(false);
  const [deepAnswer, setDeepAnswer]           = useState(false);
  const [session, setSession]                 = useState<SessionState | null>(null);
  const [limitReached, setLimitReached]       = useState(false);
  const [limitType, setLimitType]             = useState<'messages' | 'cost' | null>(null);
  const [unlockLoading, setUnlockLoading]     = useState(false);
  const [consentGiven, setConsentGiven]       = useState(false);
  const [showConsent, setShowConsent]         = useState(false);
  const [isAuth, setIsAuth]                   = useState(false);
  const bottomRef                             = useRef<HTMLDivElement>(null);
  const inactivityTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionsGenerated                    = useRef(false);
  const messagesRef                           = useRef<Message[]>([]);
  const sessionRef                            = useRef<SessionState | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionRef.current  = session;  }, [session]);

  // Check Supabase auth state
  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setIsAuth(!!data.session?.user);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, sess) => {
      setIsAuth(!!sess?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialise chat session on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/coaches/${coachSlug}/chat-session`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ consentGiven: true }),
        });
        if (!res.ok) return;
        const data = await res.json() as SessionState;
        setSession(data);
        // Show consent notice only on truly new sessions (no messages yet)
        if (data.messageCount === 0 && !data.isAuthenticated) {
          setShowConsent(true);
        }
        if (data.messageCount >= data.limits.freeMessageLimit && !data.isPaid) {
          setLimitReached(true);
        }
      } catch { /* session init failure is non-fatal — chat still works without spend tracking */ }
    };
    init();
  }, [coachSlug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateQuestions = useCallback(async (msgs: Message[]) => {
    if (questionsGenerated.current || msgs.length < MIN_TURNS) return;
    questionsGenerated.current = true;
    try {
      await fetch('/api/persona/generate-questions', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify({ coachSlug, history: msgs, personType }),
        keepalive: true,
      });
    } catch { /* fire-and-forget */ }
  }, [coachSlug, personType]);

  function resetInactivityTimer(msgs: Message[]) {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      generateQuestions(msgs).catch(() => {});
    }, INACTIVITY_MS);
  }

  useEffect(() => {
    function handleUnload() {
      generateQuestions(messagesRef.current).catch(() => {});
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      generateQuestions(messagesRef.current).catch(() => {});
    };
  }, [generateQuestions]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming || limitReached) return;

    const userMsg = input.trim();
    setInput('');
    setCards([]);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    const currentSession = sessionRef.current;
    const res = await fetch(`/api/coaches/${coachSlug}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message:   userMsg,
        history:   messages,
        deepAnswer,
        sessionId: currentSession?.sessionId,
      }),
    });

    if (!res.ok || !res.body) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am temporarily unavailable.' }]);
      setStreaming(false);
      return;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '' }]);
    const reader    = res.body.getReader();
    const decoder   = new TextDecoder();
    let buffer      = '';
    let completed   = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { completed = true; break; }
          try {
            const parsed = JSON.parse(payload) as Record<string, unknown>;
            if (parsed.type === 'limit_reached') {
              setLimitReached(true);
              setLimitType((parsed.limitType as 'messages' | 'cost') ?? 'messages');
              // Remove the empty assistant bubble we just added
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                if (last?.role === 'assistant' && !last.content) updated.pop();
                return updated;
              });
              completed = true;
              break;
            } else if (parsed.type === 'thought' && typeof parsed.chunk === 'string') {
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, thinking: (last.thinking ?? '') + parsed.chunk };
                return updated;
              });
            } else if (parsed.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Sorry, something went wrong. Please try again.' };
                return updated;
              });
            } else if (parsed.type === 'agui') {
              const event = parsed.event as Record<string, unknown> | undefined;
              if (event?.toolName === 'library_item_card' && event.output) {
                setCards(prev => {
                  const card = event.output as LibraryCard;
                  if (prev.some(c => c.itemId === card.itemId)) return prev;
                  return [...prev, card];
                });
              }
            } else if (typeof parsed.chunk === 'string' && (parsed.type === 'text' || !parsed.type)) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + (parsed.chunk as string),
                };
                return updated;
              });
            }
          } catch { /* skip malformed SSE line */ }
        }
        if (completed) break;
      }
    } catch (err) {
      console.error('[chat] stream interrupted:', err);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: 'Connection lost — please try again.' };
          return updated;
        }
        return prev;
      });
    } finally {
      reader.cancel().catch(() => {});
      setStreaming(false);
      // Optimistically update local spend count
      setSession(prev => prev ? {
        ...prev,
        messageCount:       prev.messageCount + 1,
        estimatedCostCents: prev.estimatedCostCents + 5, // rough estimate until server updates
      } : prev);
      setMessages(latest => {
        resetInactivityTimer(latest);
        return latest;
      });
    }
  }

  async function handleUnlock() {
    if (!session) return;
    setUnlockLoading(true);
    try {
      const res = await fetch(`/api/coaches/${coachSlug}/chat-unlock`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId: session.sessionId }),
      });
      const d = await res.json() as { checkoutUrl?: string; error?: string };
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
      } else {
        alert(d.error ?? 'Unable to start payment. Please try again.');
      }
    } finally {
      setUnlockLoading(false);
    }
  }

  const ITEM_TYPE_LABELS: Record<string, string> = {
    youtube: 'Video', book: 'Book', article: 'Article',
    podcast: 'Podcast', pdf: 'PDF', file: 'File',
  };

  const messagesLeft = session
    ? Math.max(0, session.limits.freeMessageLimit - session.messageCount)
    : null;

  return (
    <div className="flex flex-col h-full border rounded-2xl overflow-hidden bg-white shadow">

      {/* ── "Chat will be lost" warning banner ─────────────────────────────── */}
      {!isAuth && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Your chat will be lost when you leave — save it by creating a free account.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/coaches/${coachSlug}/account/signup`}
              className="text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-lg transition-colors"
            >
              Sign up free
            </a>
            <a
              href={`/coaches/${coachSlug}/account/login`}
              className="text-xs text-amber-700 hover:underline"
            >
              Log in
            </a>
          </div>
        </div>
      )}

      {isAuth && (
        <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-green-700">Chat saved to your account</p>
        </div>
      )}

      {/* ── Consent notice (first visit, anonymous) ─────────────────────────── */}
      {showConsent && !consentGiven && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-start gap-3">
          <div className="flex-1 text-xs text-gray-600 leading-relaxed">
            This chat may be temporarily stored to improve your experience.
            {' '}<a href="/privacy" className="text-indigo-600 underline" target="_blank">Privacy Policy</a>.
          </div>
          <button
            onClick={() => { setConsentGiven(true); setShowConsent(false); }}
            className="shrink-0 text-xs bg-gray-800 text-white px-3 py-1 rounded-lg hover:bg-gray-700"
          >
            OK
          </button>
        </div>
      )}

      {/* ── Message list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Ask me anything — I am here to help!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.role === 'assistant' && m.thinking && (
              <p className="text-xs text-gray-400 italic leading-relaxed mb-1 max-w-xs lg:max-w-md line-clamp-3">
                ({m.thinking.length > 140 ? m.thinking.slice(0, 140) + '…' : m.thinking})
              </p>
            )}
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content || (streaming && !m.thinking ? <span className="animate-pulse">…</span> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Limit-reached upsell panel ───────────────────────────────────── */}
      {limitReached && (
        <div className="border-t bg-gradient-to-br from-indigo-50 to-purple-50 px-4 py-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {limitType === 'cost' ? 'Free chat limit reached' : "You've used your free messages"}
          </h3>
          <p className="text-xs text-gray-600 mb-4">
            {session?.chatSettings && session.limits.paidChatPriceUsd != null
              ? `To keep chatting, book a session or unlock unlimited chat for $${session.limits.paidChatPriceUsd.toFixed(2)}.`
              : 'To keep chatting, book a session with this coach.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={`/coaches/${coachSlug}/book`}
              className="flex-1 text-center bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Book a session
            </a>
            {session?.paidChatEnabled && session.limits.paidChatPriceUsd != null && (
              <button
                onClick={handleUnlock}
                disabled={unlockLoading}
                className="flex-1 border border-indigo-300 text-indigo-700 text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {unlockLoading
                  ? 'Redirecting…'
                  : `Unlock chat — $${session.limits.paidChatPriceUsd.toFixed(2)}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Recommendation cards ──────────────────────────────────────────── */}
      {cards.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-xs text-gray-400 mb-2 font-medium">Recommended resources</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cards.map(card => {
              const href  = card.url ?? card.buyLink;
              const label = ITEM_TYPE_LABELS[card.itemType] ?? card.itemType;
              return (
                <a
                  key={card.itemId}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 w-40 rounded-xl border border-gray-200 p-2 hover:border-indigo-300 hover:shadow-sm transition-all block"
                >
                  {card.thumbnailUrl && (
                    <img
                      src={card.thumbnailUrl}
                      alt={card.title}
                      className="w-full h-20 object-cover rounded-lg mb-1.5"
                    />
                  )}
                  <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 mb-1">
                    {label}
                  </span>
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{card.title}</p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Input form ────────────────────────────────────────────────────── */}
      {!limitReached && (
        <form onSubmit={send} className="border-t p-3">
          {/* Spend indicator */}
          {session && !session.isPaid && session.messageCount > 0 && (
            <p className="text-[10px] text-gray-400 mb-2 text-right">
              {session.messageCount} / {session.limits.freeMessageLimit} free messages used
            </p>
          )}
          {session?.isPaid && (
            <p className="text-[10px] text-green-600 mb-2 text-right">Unlimited chat active</p>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={streaming}
            />
            <button
              type="button"
              onClick={() => setDeepAnswer(d => !d)}
              title={deepAnswer ? 'Deep answer on — up to 2000 words' : 'Deep answer off — up to 300 words'}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors shrink-0 ${
                deepAnswer
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              Deep
            </button>
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


  // Keep ref in sync with state so closures see fresh data
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateQuestions = useCallback(async (msgs: Message[]) => {
    console.log(`[generateQuestions] triggered — msgs.length=${msgs.length}, already generated=${questionsGenerated.current}`);
    if (questionsGenerated.current) {
      console.log('[generateQuestions] skipped — already generated for this session');
      return;
    }
    if (msgs.length < MIN_TURNS) {
      console.log(`[generateQuestions] skipped — only ${msgs.length} messages, need ${MIN_TURNS}`);
      return;
    }
    questionsGenerated.current = true;
    try {
      console.log(`[generateQuestions] firing request with ${msgs.length} messages`);
      const res = await fetch('/api/persona/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachSlug, history: msgs, personType }),
        keepalive: true,
      });
      const data = await res.json().catch(() => null);
      console.log('[generateQuestions] response:', res.status, data);
    } catch (err) {
      console.error('[generateQuestions] fetch failed:', err);
    }
  }, [coachSlug, personType]);

  // Reset inactivity timer on each new message
  function resetInactivityTimer(msgs: Message[]) {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      generateQuestions(msgs).catch(() => {});
    }, INACTIVITY_MS);
  }

  // Trigger on unmount or page close
  useEffect(() => {
    function handleUnload() {
      generateQuestions(messagesRef.current).catch(() => {});
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      generateQuestions(messagesRef.current).catch(() => {});
    };
  }, [generateQuestions]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMsg = input.trim();
    setInput('');
    setCards([]);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    const res = await fetch(`/api/coaches/${coachSlug}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, history: messages, deepAnswer }),
    });

    if (!res.ok || !res.body) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am temporarily unavailable.' }]);
      setStreaming(false);
      return;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '' }]);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { completed = true; break; }
          try {
            const parsed = JSON.parse(payload) as Record<string, unknown>;
            if (parsed.type === 'thought' && typeof parsed.chunk === 'string') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, thinking: (last.thinking ?? '') + parsed.chunk };
                return updated;
              });
            } else if (parsed.type === 'error' && typeof parsed.chunk === 'string') {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: 'Sorry, something went wrong. Please try again.' };
                return updated;
              });
            } else if (parsed.type === 'agui') {
              const event = parsed.event as Record<string, unknown> | undefined;
              if (event?.toolName === 'library_item_card' && event.output) {
                setCards(prev => {
                  const card = event.output as LibraryCard;
                  if (prev.some(c => c.itemId === card.itemId)) return prev;
                  return [...prev, card];
                });
              }
            } else if (typeof parsed.chunk === 'string' && (parsed.type === 'text' || !parsed.type)) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + (parsed.chunk as string),
                };
                return updated;
              });
            }
          } catch { /* skip malformed SSE line */ }
        }
        if (completed) break;
      }
    } catch (err) {
      console.error('[chat] stream interrupted:', err);
      // If we got a partial response, keep it — only show error if nothing came through
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: 'Connection lost — please try again.' };
          return updated;
        }
        return prev;
      });
    } finally {
      reader.cancel().catch(() => {});
      setStreaming(false);
      setMessages(latest => {
        console.log(`[chat] exchange complete — ${latest.length} messages total. Question generation fires after ${INACTIVITY_MS / 1000}s inactivity (need ${MIN_TURNS}+ messages).`);
        resetInactivityTimer(latest);
        return latest;
      });
    }
  }

  const ITEM_TYPE_LABELS: Record<string, string> = {
    youtube: 'Video', book: 'Book', article: 'Article',
    podcast: 'Podcast', pdf: 'PDF', file: 'File',
  };

  return (
    <div className="flex flex-col h-full border rounded-2xl overflow-hidden bg-white shadow">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Ask me anything — I am here to help!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.role === 'assistant' && m.thinking && (
              <p className="text-xs text-gray-400 italic leading-relaxed mb-1 max-w-xs lg:max-w-md line-clamp-3">
                ({m.thinking.length > 140 ? m.thinking.slice(0, 140) + '…' : m.thinking})
              </p>
            )}
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content || (streaming && !m.thinking ? <span className="animate-pulse">…</span> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Recommendation cards */}
      {cards.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-xs text-gray-400 mb-2 font-medium">Recommended resources</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cards.map(card => {
              const href = card.url ?? card.buyLink;
              const label = ITEM_TYPE_LABELS[card.itemType] ?? card.itemType;
              return (
                <a
                  key={card.itemId}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 w-40 rounded-xl border border-gray-200 p-2 hover:border-indigo-300 hover:shadow-sm transition-all block"
                >
                  {card.thumbnailUrl && (
                    <img
                      src={card.thumbnailUrl}
                      alt={card.title}
                      className="w-full h-20 object-cover rounded-lg mb-1.5"
                    />
                  )}
                  <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 mb-1">
                    {label}
                  </span>
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{card.title}</p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={send} className="border-t flex gap-2 p-3">
        <input
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={streaming}
        />
        <button
          type="button"
          onClick={() => setDeepAnswer(d => !d)}
          title={deepAnswer ? 'Deep answer on — up to 2000 words' : 'Deep answer off — up to 300 words'}
          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors shrink-0 ${
            deepAnswer
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          Deep
        </button>
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
