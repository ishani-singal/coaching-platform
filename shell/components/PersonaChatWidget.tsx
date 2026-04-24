'use client';
import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function PersonaChatWidget({ coachSlug }: { coachSlug: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    const res = await fetch(`/api/coaches/${coachSlug}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, history: messages }),
    });

    if (!res.ok || !res.body) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am temporarily unavailable.' }]);
      setStreaming(false);
      return;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const { chunk } = JSON.parse(payload) as { chunk: string };
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: updated[updated.length - 1].content + chunk,
              };
              return updated;
            });
          } catch { /* skip malformed */ }
        }
      }
    }

    setStreaming(false);
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white shadow">
      <div className="h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Ask me anything — I am here to help!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content || (streaming ? <span className="animate-pulse">…</span> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t flex gap-2 p-3">
        <input
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={streaming}
        />
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
