'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/SessionProvider';

type EnrollmentType = 'client' | 'trainee' | null;

type Client = {
  clientId:          string;
  name:              string;
  email:             string;
  tags:              string[];
  enrollmentStatus:  string;
  enrollmentType:    EnrollmentType;
  noteCount:         number;
  packageTitle:      string | null;
  paymentStatus:     'paid' | 'unpaid' | null;
  completedSections: number;
};

type Overview = { active: Client[]; completed: Client[]; prospect: Client[] };

type DashboardStats = {
  clientCount:    number;
  traineeCount:   number;
  clientRevenue:  number;
  traineeRevenue: number;
  clientHours:    number;
  traineeHours:   number;
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 border border-gray-100">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  );
}

export default function CRMPage() {
  const { userId } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'prospect' | 'dashboard'>('active');
  const [typeFilter, setTypeFilter] = useState<'all' | 'client' | 'trainee'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [resending, setResending] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<Record<string, string>>({});

  const callAgent = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    return fetch('/api/agents/coaching-crm/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    }).then(r => r.json());
  }, [userId]);

  const load = useCallback(async () => {
    const r = await callAgent('get_client_list') as { data: Overview };
    setOverview(r.data ?? { active: [], completed: [], prospect: [] });
  }, [callAgent]);

  useEffect(() => {
    load();
    callAgent('get_dashboard_stats').then(r => {
      setStats((r as { data: DashboardStats }).data ?? null);
    });
  }, [load, callAgent]);

  async function resendInvite(clientId: string) {
    setResending(clientId);
    const r = await callAgent('resend_invite', { clientId }) as { success: boolean; message: string };
    setResendStatus(s => ({ ...s, [clientId]: r.success ? '✓ Sent' : `✗ ${r.message}` }));
    setResending(null);
  }

  function tabCount(key: 'active' | 'completed' | 'prospect') {
    const list = overview?.[key] ?? [];
    return typeFilter === 'all'
      ? list.length
      : list.filter(c => c.enrollmentType === typeFilter).length;
  }

  const currentList = activeTab !== 'dashboard' ? (overview?.[activeTab] ?? []) : [];
  const filtered = currentList
    .filter(c => typeFilter === 'all' || c.enrollmentType === typeFilter)
    .filter(c => !tagFilter || c.tags.includes(tagFilter));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Client CRM</h1>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {(['active', 'completed', 'prospect'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
          >
            {t} ({tabCount(t)})
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setActiveTab('dashboard'); setTypeFilter('all'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-700'}`}
        >
          Dashboard
        </button>

        {activeTab !== 'dashboard' && (
          <>
            <div className="ml-auto flex gap-1">
              {(['all', 'client', 'trainee'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-medium capitalize ${typeFilter === f ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="Filter by tag…"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
            />
          </>
        )}
      </div>

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div>
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Active Clients"     value={stats.clientCount} />
              <StatCard label="Active Trainees"    value={stats.traineeCount} />
              <StatCard label="Client Revenue"     value={`$${stats.clientRevenue.toFixed(2)}`} />
              <StatCard label="Trainee Revenue"    value={`$${stats.traineeRevenue.toFixed(2)}`} />
              <StatCard label="Hours with Clients"  value={stats.clientHours.toFixed(1)} />
              <StatCard label="Hours with Trainees" value={stats.traineeHours.toFixed(1)} />
            </div>
          ) : (
            <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>
          )}
        </div>
      )}

      {/* Client list table */}
      {activeTab !== 'dashboard' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Package</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Completion</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.clientId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3">
                    {c.enrollmentType
                      ? <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full capitalize">{c.enrollmentType}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                    {c.packageTitle ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.enrollmentStatus === 'completed' ? (
                      <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ Completed</span>
                    ) : c.enrollmentStatus === 'active' ? (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {c.completedSections > 0 ? `${c.completedSections} sections done` : 'Active'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.paymentStatus === 'paid' ? (
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">Paid</span>
                    ) : c.paymentStatus === 'unpaid' ? (
                      <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">Unpaid</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(t => <span key={t} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.enrollmentType && (
                        <div className="flex flex-col items-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => resendInvite(c.clientId)}
                            disabled={resending === c.clientId}
                            className="text-xs text-indigo-600 border border-indigo-200 rounded px-2 py-1 hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            {resending === c.clientId ? 'Sending…' : 'Resend'}
                          </button>
                          {resendStatus[c.clientId] && (
                            <span className="text-xs text-indigo-600">{resendStatus[c.clientId]}</span>
                          )}
                        </div>
                      )}
                      <Link href={`/crm/${c.clientId}`} className="text-indigo-600 text-xs hover:underline whitespace-nowrap">View →</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No clients.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
