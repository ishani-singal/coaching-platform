import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const AGENTS = [
  { id: 'coaching-program-builder', port: 3001, label: '📚 Program Builder' },
  { id: 'coaching-program-runner',  port: 3002, label: '🎯 Program Runner' },
  { id: 'coaching-coach-library',   port: 3003, label: '🎬 Coach Library' },
  { id: 'coaching-persona-chat',    port: 3004, label: '🧠 Persona Chat' },
  { id: 'coaching-crm',             port: 3005, label: '👥 CRM' },
  { id: 'coaching-licensing',       port: 3006, label: '💰 Licensing' },
];

async function fetchSnapshot(port: number, userId: string) {
  try {
    const res = await fetch(`http://localhost:${port}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {} }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { snapshot: { summary: string; pendingActions: { label: string; priority: string }[] } };
    return data.snapshot;
  } catch {
    return null;
  }
}

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const userId = user.id;

  const snapshots = await Promise.all(
    AGENTS.map(async a => ({ ...a, snapshot: await fetchSnapshot(a.port, userId) }))
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {snapshots.map(({ id, label, snapshot }) => (
          <div key={id} className="bg-white rounded-xl shadow p-5 border border-gray-100">
            <div className="font-semibold text-gray-800 mb-2">{label}</div>
            {snapshot ? (
              <>
                <p className="text-sm text-gray-600 mb-3">{snapshot.summary}</p>
                {snapshot.pendingActions.length > 0 && (
                  <ul className="space-y-1">
                    {snapshot.pendingActions.slice(0, 2).map((a, i) => (
                      <li key={i} className={`text-xs px-2 py-1 rounded ${a.priority === 'high' ? 'bg-red-50 text-red-700' : a.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-600'}`}>
                        {a.label}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Agent offline</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
