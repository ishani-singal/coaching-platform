'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/components/SessionProvider';

type Snapshot = { version: number; tone: string; style: string; summary: string } | null;

export default function PersonaPage() {
  const [snapshot, setSnapshot] = useState<Snapshot>(null);
  const [building, setBuilding] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [status, setStatus] = useState('');

  async function call(action: string, params: Record<string, unknown>) {
    return fetch('/api/agents/coaching-persona-chat/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action, params }),
    }).then(r => r.json());
  }

  useEffect(() => {
    call('get_persona_preview', {}).then(r => setSnapshot(r.data ?? null));
  }, []);

  async function build() {
    setBuilding(true);
    await call('build_persona', {});
    const r = await call('get_persona_preview', {}) as { data: Snapshot };
    setSnapshot(r.data);
    setBuilding(false);
    setStatus('Persona rebuilt.');
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    await call('add_source', { sourceType: 'text', content: sourceText });
    setSourceText('');
    setStatus('Source added. Rebuild persona to apply.');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Persona Builder</h1>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Current Persona</h2>
          {snapshot ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500 text-xs uppercase">Version</dt><dd>v{snapshot.version}</dd></div>
              <div><dt className="text-gray-500 text-xs uppercase">Tone</dt><dd>{snapshot.tone}</dd></div>
              <div><dt className="text-gray-500 text-xs uppercase">Style</dt><dd>{snapshot.style}</dd></div>
              <div><dt className="text-gray-500 text-xs uppercase">Summary</dt><dd>{snapshot.summary}</dd></div>
            </dl>
          ) : (
            <p className="text-gray-400 text-sm">No persona built yet.</p>
          )}
          <button onClick={build} disabled={building} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            {building ? 'Building…' : 'Build Persona'}
          </button>
          {status && <p className="text-sm text-green-700 mt-2">{status}</p>}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Add Persona Source</h2>
          <form onSubmit={addSource} className="space-y-3">
            <textarea
              className="w-full border rounded px-3 py-2 text-sm h-32 resize-none"
              placeholder="Paste your bio, writing sample, or coaching philosophy…"
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              required
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Add Source</button>
          </form>
        </div>
      </div>
    </div>
  );
}
