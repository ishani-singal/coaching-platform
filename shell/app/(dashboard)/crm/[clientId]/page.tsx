'use client';
import { useState, useEffect, use } from 'react';
import { useSession } from '@/components/SessionProvider';

type ClientDetail = {
  profile: { name: string; email: string; goals: string; background: string };
  notes: { note_id: string; note: string; created_at: string }[];
  tags: string[];
  sessions: { sessionId: string; scheduledAt: string; status: string }[];
};

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');

  async function call(action: string, p: Record<string, unknown>) {
    return fetch('/api/agents/coaching-crm/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action, params: p }),
    }).then(r => r.json());
  }

  async function load() {
    const r = await call('get_client_detail', { clientId }) as { data: ClientDetail };
    setDetail(r.data ?? null);
  }

  useEffect(() => { load(); }, [clientId]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    await call('add_note', { clientId, note });
    setNote('');
    await load();
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    await call('add_tag', { clientId, tag });
    setTag('');
    await load();
  }

  if (!detail) return <div className="p-8 text-gray-400">Loading…</div>;
  const { profile, notes, tags, sessions } = detail;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
      <p className="text-gray-500 text-sm mb-6">{profile.email}</p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-3">Profile</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-400 text-xs uppercase">Goals</dt><dd>{profile.goals || '—'}</dd></div>
              <div><dt className="text-gray-400 text-xs uppercase">Background</dt><dd>{profile.background || '—'}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-3">Notes</h2>
            <form onSubmit={addNote} className="flex gap-2 mb-4">
              <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add a note…" value={note} onChange={e => setNote(e.target.value)} required />
              <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">Add</button>
            </form>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.note_id} className="border rounded p-3 text-sm">
                  <p>{n.note}</p>
                  <p className="text-gray-400 text-xs mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-gray-400 text-sm">No notes yet.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-3">Sessions ({sessions.length})</h2>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.sessionId} className="flex justify-between text-sm border rounded p-3">
                  <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                  <span className={s.status === 'completed' ? 'text-green-600' : s.status === 'cancelled' ? 'text-red-600' : 'text-blue-600'}>{s.status}</span>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-gray-400 text-sm">No sessions.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold mb-3">Tags</h2>
            <form onSubmit={addTag} className="flex gap-2 mb-3">
              <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="New tag…" value={tag} onChange={e => setTag(e.target.value)} required />
              <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">Add</button>
            </form>
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <span key={t} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
