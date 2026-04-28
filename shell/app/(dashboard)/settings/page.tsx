'use client';
import { useState } from 'react';
import { useSession } from '@/components/SessionProvider';

export default function SettingsPage() {
  const { userId } = useSession();
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [upgradeStatus, setUpgradeStatus] = useState('');

  async function checkSlug() {
    if (!slug) return;
    const r = await fetch(`/api/coaches/slug-check?slug=${encodeURIComponent(slug)}`).then(r => r.json()) as { available: boolean };
    setSlugStatus(r.available ? '✓ Available' : '✗ Taken');
  }

  async function upgrade(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/coaches/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, slug, displayName }),
    }).then(r => r.json()) as { success: boolean; message?: string; data: { subdomainUrl: string } };
    setUpgradeStatus(r.success ? `✓ Coach profile created! URL: ${r.data?.subdomainUrl}` : `✗ Failed: ${r.message}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-4">Upgrade to Coach</h2>
        <form onSubmit={upgrade} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase">Display Name</label>
            <input className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="Your Name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase">Slug</label>
            <div className="flex gap-2 mt-1">
              <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="yourslug" value={slug} onChange={e => setSlug(e.target.value)} required />
              <button type="button" onClick={checkSlug} className="border rounded px-3 py-2 text-sm text-gray-700">Check</button>
            </div>
            {slugStatus && <p className="text-xs mt-1 text-gray-600">{slugStatus}</p>}
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm w-full">Create Coach Profile</button>
          {upgradeStatus && <p className="text-sm text-green-700 break-all">{upgradeStatus}</p>}
        </form>
      </div>
    </div>
  );
}
