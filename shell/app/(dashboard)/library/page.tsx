'use client';
import { useState, useEffect } from 'react';

type LibraryItem = { itemId: string; itemType: string; title: string; url?: string; thumbnailUrl?: string; tags: string[] };

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [channelUrl, setChannelUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  async function load() {
    const r = await fetch('/api/agents/coaching-coach-library/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action: 'get_library', params: {} }),
    }).then(r => r.json()) as { data: { items: LibraryItem[] } };
    setItems(r.data?.items ?? []);
  }

  useEffect(() => { load(); }, []);

  async function syncYoutube(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true);
    const r = await fetch('/api/agents/coaching-coach-library/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action: 'sync_youtube', params: { channelUrl } }),
    }).then(r => r.json()) as { data: { added: number; updated: number } };
    setSyncStatus(`Added: ${r.data?.added}, Updated: ${r.data?.updated}`);
    setSyncing(false);
    await load();
  }

  const byType: Record<string, LibraryItem[]> = {};
  for (const item of items) {
    (byType[item.itemType] ??= []).push(item);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Coach Library</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold mb-3">Sync YouTube Channel</h2>
        <form onSubmit={syncYoutube} className="flex gap-3">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="https://youtube.com/@yourhandle"
            value={channelUrl}
            onChange={e => setChannelUrl(e.target.value)}
            required
          />
          <button type="submit" disabled={syncing} className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </form>
        {syncStatus && <p className="text-sm text-green-700 mt-2">{syncStatus}</p>}
      </div>

      {Object.entries(byType).map(([type, list]) => (
        <div key={type} className="mb-6">
          <h2 className="font-semibold text-gray-700 mb-3 capitalize">{type} ({list.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map(item => (
              <div key={item.itemId} className="bg-white rounded-lg shadow p-3 text-sm">
                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt={item.title} className="w-full rounded mb-2 object-cover aspect-video" />}
                <div className="font-medium line-clamp-2">{item.title}</div>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map(t => <span key={t} className="bg-gray-100 text-gray-600 text-xs px-1 rounded">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && <p className="text-gray-400">No library items yet. Sync a YouTube channel to get started.</p>}
    </div>
  );
}
