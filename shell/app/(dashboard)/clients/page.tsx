'use client';
import { useState, useEffect } from 'react';

type DashboardRow = { enrollmentId: string; clientName: string; packageTitle: string; enrollmentType: string; completedAt: string | null };

export default function ClientsPage() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [enrollForm, setEnrollForm] = useState({ packageId: '', clientName: '', clientEmail: '', enrollmentType: 'client' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/agents/coaching-program-runner/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action: 'get_dashboard', params: {} }),
    }).then(r => r.json()).then(d => setRows(d.data?.rows ?? []));
  }, []);

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/agents/coaching-program-runner/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action: 'enroll_client', params: enrollForm }),
    }).then(r => r.json()) as { success: boolean; message: string; data: { portalUrl: string } };
    setStatus(r.success ? `✓ Enrolled — Portal: ${r.data?.portalUrl}` : `✗ ${r.message}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Program Runner</h1>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Enroll Client</h2>
          <form onSubmit={enroll} className="space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Package ID" value={enrollForm.packageId} onChange={e => setEnrollForm(f => ({ ...f, packageId: e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Client name" value={enrollForm.clientName} onChange={e => setEnrollForm(f => ({ ...f, clientName: e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Client email" type="email" value={enrollForm.clientEmail} onChange={e => setEnrollForm(f => ({ ...f, clientEmail: e.target.value }))} required />
            <select className="w-full border rounded px-3 py-2 text-sm" value={enrollForm.enrollmentType} onChange={e => setEnrollForm(f => ({ ...f, enrollmentType: e.target.value }))}>
              <option value="client">Client</option>
              <option value="trainee">Trainee</option>
            </select>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Enroll</button>
            {status && <p className="text-xs text-green-700 break-all">{status}</p>}
          </form>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Active Enrollments ({rows.length})</h2>
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.enrollmentId} className="border rounded p-3 text-sm">
                <div className="font-medium">{r.clientName}</div>
                <div className="text-gray-500">{r.packageTitle} · {r.enrollmentType}</div>
                {r.completedAt && <div className="text-green-600 text-xs">✓ Completed</div>}
              </div>
            ))}
            {rows.length === 0 && <p className="text-gray-400 text-sm">No enrollments yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
