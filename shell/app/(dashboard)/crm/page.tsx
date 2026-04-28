'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/SessionProvider';

type Client = { clientId: string; name: string; email: string; tags: string[]; enrollmentStatus: string };
type Overview = { active: Client[]; completed: Client[]; prospect: Client[] };

export default function CRMPage() {
  const { userId } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'prospect'>('active');
  const [tagFilter, setTagFilter] = useState('');

  async function load() {
    const r = await fetch('/api/agents/coaching-crm/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action: 'get_client_list', params: {} }),
    }).then(r => r.json()) as { data: Overview };
    setOverview(r.data ?? { active: [], completed: [], prospect: [] });
  }

  useEffect(() => { load(); }, []);

  const currentList = overview?.[activeTab] ?? [];
  const filtered = tagFilter
    ? currentList.filter(c => c.tags.includes(tagFilter))
    : currentList;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Client CRM</h1>
      <div className="flex gap-2 mb-4">
        {(['active', 'completed', 'prospect'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
          >
            {t} ({overview?.[t].length ?? 0})
          </button>
        ))}
        <input
          className="ml-auto border rounded px-3 py-2 text-sm"
          placeholder="Filter by tag…"
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.clientId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map(t => <span key={t} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/crm/${c.clientId}`} className="text-indigo-600 text-xs hover:underline">View →</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No clients.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
