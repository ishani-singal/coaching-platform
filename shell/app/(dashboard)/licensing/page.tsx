'use client';
import { useState, useEffect } from 'react';

export default function LicensingPage() {
  const [dashboard, setDashboard] = useState<{ granted: unknown[]; held: unknown[]; revenueThisMonth: number } | null>(null);
  const [grantForm, setGrantForm] = useState({ moduleId: '', licenseeCoachId: '', directCutPct: 10, derivativeCutPct: 5, canSublicense: false });
  const [status, setStatus] = useState('');

  async function call(action: string, params: Record<string, unknown>) {
    return fetch('/api/agents/coaching-licensing/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action, params }),
    }).then(r => r.json());
  }

  useEffect(() => {
    call('get_license_dashboard', {}).then(r => setDashboard(r.data ?? null));
  }, []);

  async function grantLicense(e: React.FormEvent) {
    e.preventDefault();
    const r = await call('grant_license', grantForm) as { success: boolean; message: string };
    setStatus(r.success ? '✓ License granted' : '✗ ' + r.message);
    if (r.success) call('get_license_dashboard', {}).then(r => setDashboard(r.data ?? null));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Licensing & Revenue</h1>

      {dashboard && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Stat label="Licenses Granted" value={dashboard.granted.length} />
          <Stat label="Licenses Held"    value={dashboard.held.length} />
          <Stat label="Revenue This Month" value={`$${dashboard.revenueThisMonth.toFixed(2)}`} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Grant Module License</h2>
        <form onSubmit={grantLicense} className="space-y-3 max-w-sm">
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Module ID" value={grantForm.moduleId} onChange={e => setGrantForm(f => ({ ...f, moduleId: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Licensee Coach ID" value={grantForm.licenseeCoachId} onChange={e => setGrantForm(f => ({ ...f, licenseeCoachId: e.target.value }))} required />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Direct cut %</label>
              <input className="w-full border rounded px-3 py-2 text-sm" type="number" min="0" max="100" value={grantForm.directCutPct} onChange={e => setGrantForm(f => ({ ...f, directCutPct: +e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Derivative cut %</label>
              <input className="w-full border rounded px-3 py-2 text-sm" type="number" min="0" max="100" value={grantForm.derivativeCutPct} onChange={e => setGrantForm(f => ({ ...f, derivativeCutPct: +e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={grantForm.canSublicense} onChange={e => setGrantForm(f => ({ ...f, canSublicense: e.target.checked }))} />
            Allow sublicensing
          </label>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Grant License</button>
          {status && <p className="text-sm text-green-700">{status}</p>}
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
