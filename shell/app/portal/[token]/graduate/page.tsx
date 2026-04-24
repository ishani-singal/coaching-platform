'use client';
import { useState, use } from 'react';

export default function GraduatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [result, setResult] = useState('');

  async function checkSlug() {
    const r = await fetch(`/api/coaches/slug-check?slug=${encodeURIComponent(slug)}`).then(r => r.json()) as { available: boolean };
    setSlugStatus(r.available ? '✓ Available' : '✗ Taken');
  }

  async function graduate(e: React.FormEvent) {
    e.preventDefault();
    // Get userId from enrollment token
    const enrollment = await fetch(`/api/portal/${token}`).then(r => r.json()) as { data: { enrollment: { installingCoachId: string } } };
    const userId = enrollment.data?.enrollment?.installingCoachId ?? '';
    const r = await fetch('/api/coaches/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, slug, displayName }),
    }).then(r => r.json()) as { success: boolean; data: { subdomainUrl: string } };
    setResult(r.success ? `🎉 Welcome, Coach! Your site: ${r.data?.subdomainUrl}` : '✗ Failed');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Become a Coach</h1>
        <p className="text-gray-500 text-sm mb-6">Set up your coaching profile to start delivering programs.</p>

        {result ? (
          <p className="text-green-700 font-medium break-all">{result}</p>
        ) : (
          <form onSubmit={graduate} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <input className="w-full border rounded px-3 py-2 text-sm mt-1" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Your URL slug</label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 border rounded px-3 py-2 text-sm" value={slug} onChange={e => setSlug(e.target.value)} required />
                <button type="button" onClick={checkSlug} className="border rounded px-3 py-2 text-sm">Check</button>
              </div>
              {slugStatus && <p className="text-xs mt-1 text-gray-600">{slugStatus}</p>}
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">Create My Profile</button>
          </form>
        )}
      </div>
    </div>
  );
}
