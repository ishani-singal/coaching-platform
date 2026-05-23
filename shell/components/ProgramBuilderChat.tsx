'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

// -- Types ---------------------------------------------------------------------

interface TextEvent   { type: 'text';  chunk: string; }
interface AguiEvent   { type: 'agui';  event: AgUiPayload; }
interface ErrorEvent  { type: 'error'; message: string; }
type SseEvent = TextEvent | AguiEvent | ErrorEvent;

interface AgUiPayload {
  type: string;
  toolCallId?: string;
  toolName?:   string;
  result?:     unknown;
}

interface ChatMessage {
  id:      string;
  role:    'user' | 'assistant';
  content: string;    // accumulated text
  cards:   ContentCard[];
  pending: boolean;   // true while still streaming
}

interface ContentCard {
  cardType: 'module' | 'program' | 'package' | 'tool';
  label:    string;
  detail?:  string;
  toolName: string;
  result:   unknown;
}

interface MessageParam {
  role:    'user' | 'assistant';
  content: string | { type: 'text'; text: string }[];
}

// -- Tool label map ------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  create_module:           'Creating module...',
  update_module:           'Updating module...',
  delete_module:           'Deleting module...',
  add_section:             'Adding section...',
  update_section:          'Updating section...',
  delete_section:          'Deleting section...',
  get_module_detail:       'Loading module details...',
  build_program:           'Building program...',
  build_program_with_periods: 'Building program with periods...',
  create_inline_module:    'Creating inline module...',
  update_program:          'Updating program...',
  delete_program:          'Deleting program...',
  add_module_to_period:    'Adding module to period...',
  create_program_period:   'Creating period...',
  delete_program_period:   'Deleting period...',
  rename_program_period:   'Renaming period...',
  assemble_package:        'Assembling package...',
  update_package:          'Updating package...',
  publish_package:         'Publishing package...',
  unpublish_package:       'Unpublishing package...',
  delete_package:          'Deleting package...',
  list_modules:            'Loading modules...',
  list_programs:           'Loading programs...',
  list_packages:           'Loading packages...',
  get_program_detail:      'Loading program details...',
  get_package_detail:      'Loading package details...',
};

// -- Helpers -------------------------------------------------------------------

function genId() { return Math.random().toString(36).slice(2); }

function cardColorCls(cardType: ContentCard['cardType']): string {
  switch (cardType) {
    case 'module':  return 'bg-indigo-50 border-indigo-200 text-indigo-800';
    case 'program': return 'bg-purple-50 border-purple-200 text-purple-800';
    case 'package': return 'bg-green-50  border-green-200  text-green-800';
    default:        return 'bg-gray-50   border-gray-200   text-gray-700';
  }
}

function resultToCard(toolName: string, result: unknown): ContentCard | null {
  const r = result as { success?: boolean; data?: { moduleId?: string; title?: string; programId?: string; packageId?: string } };
  if (!r?.success) return null;
  const d = r.data;
  if (!d) return null;

  if (d.moduleId) {
    return { cardType: 'module', label: d.title ?? 'Module', detail: d.moduleId, toolName, result };
  }
  if (d.programId) {
    return { cardType: 'program', label: d.title ?? 'Program', detail: d.programId, toolName, result };
  }
  if (d.packageId) {
    return { cardType: 'package', label: d.title ?? 'Package', detail: d.packageId, toolName, result };
  }
  return null;
}

// -- Markdown-lite renderer ----------------------------------------------------

function renderText(text: string): React.ReactNode {
  // Bold, code spans, line breaks
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

// -- ContentCard UI ------------------------------------------------------------

function CardView({ card }: { card: ContentCard }) {
  const cls = cardColorCls(card.cardType);
  const icon = card.cardType === 'module' ? '📋' : card.cardType === 'program' ? '📚' : '📦';
  return (
    <div className={'border rounded-xl px-4 py-3 flex items-center gap-3 mt-2 ' + cls}>
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{card.label}</p>
        {card.detail && <p className="text-xs opacity-70 truncate">{card.detail}</p>}
      </div>
    </div>
  );
}

// -- Message bubble ------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}>
      <div className={'max-w-[85%] ' + (isUser ? 'items-end' : 'items-start') + ' flex flex-col gap-1'}>
        <div className={
          'rounded-2xl px-4 py-3 text-sm leading-relaxed ' +
          (isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm')
        }>
          {renderText(msg.content)}
          {msg.pending && msg.content === '' && (
            <span className="inline-flex gap-1 py-0.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
          )}
        </div>
        {msg.cards.map((card, i) => <CardView key={i} card={card} />)}
      </div>
    </div>
  );
}

// -- Tool spinner --------------------------------------------------------------

function ToolSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 pl-1 py-1">
      <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
      {label}
    </div>
  );
}

// -- Main component ------------------------------------------------------------

export interface ProgramBuilderChatProps {
  onRefresh: () => void;
}

export default function ProgramBuilderChat({ onRefresh }: ProgramBuilderChatProps) {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [streaming, setStreaming]   = useState(false);
  const [activeTools, setActiveTools] = useState<Map<string, string>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgHistory = useRef<MessageParam[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTools]);

  const send = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    setInput('');
    setStreaming(true);

    const userMsg: ChatMessage = { id: genId(), role: 'user', content: userText, cards: [], pending: false };
    setMessages(prev => [...prev, userMsg]);

    const assistantId  = genId();
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', cards: [], pending: true };
    setMessages(prev => [...prev, assistantMsg]);

    msgHistory.current.push({ role: 'user', content: userText });

    let assistantText = '';

    try {
      const res = await fetch('/api/agents/program-builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgHistory.current }),
      });

      if (!res.body) throw new Error('No response body');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { setStreaming(false); break; }

          let evt: SseEvent;
          try { evt = JSON.parse(raw) as SseEvent; } catch { continue; }

          if (evt.type === 'text') {
            assistantText += evt.chunk;
            const snapshot = assistantText;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: snapshot } : m
            ));
          } else if (evt.type === 'agui') {
            const agui = evt.event;

            if (agui.type === 'TOOL_CALL_START' && agui.toolCallId && agui.toolName) {
              setActiveTools(prev => new Map(prev).set(agui.toolCallId!, TOOL_LABELS[agui.toolName!] ?? agui.toolName!));
            } else if (agui.type === 'TOOL_CALL_END' && agui.toolCallId) {
              setActiveTools(prev => { const next = new Map(prev); next.delete(agui.toolCallId!); return next; });
              if (agui.result) {
                const card = resultToCard(agui.toolName ?? '', agui.result);
                if (card) {
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, cards: [...m.cards, card] } : m
                  ));
                }
              }
            } else if (agui.type === 'REFRESH_CONTENT') {
              onRefresh();
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Something went wrong. Please try again.', pending: false }
          : m
      ));
      console.error(err);
    } finally {
      setStreaming(false);
      setActiveTools(new Map());
      msgHistory.current.push({ role: 'assistant', content: assistantText });
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, pending: false } : m));
    }
  }, [streaming, onRefresh]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="font-semibold text-gray-900 text-sm">Program Builder</h2>
        <p className="text-xs text-gray-400">Ask me to create modules, programs, or packages</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="text-3xl mb-2">✨</p>
            <p>Start by describing what you want to build.</p>
            <div className="mt-4 space-y-2 text-left">
              {[
                'Create a 4-week mindset program',
                'Build a nutrition module with a quiz',
                'Assemble a coaching package for $297',
              ].map(suggestion => (
                <button key={suggestion} type="button"
                  onClick={() => send(suggestion)}
                  className="w-full text-left text-xs bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-lg px-3 py-2 transition-colors">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {activeTools.size > 0 && (
          <div className="space-y-1">
            {Array.from(activeTools.values()).map((label, i) => (
              <ToolSpinner key={i} label={label} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything about your content..."
            rows={2}
            disabled={streaming}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none placeholder-gray-400 disabled:opacity-60"
          />
          <button type="button" onClick={() => send(input)} disabled={!input.trim() || streaming}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
