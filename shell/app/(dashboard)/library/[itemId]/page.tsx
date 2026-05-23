'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/components/SessionProvider';

type LibraryItem = { itemId: string; itemType: string; title: string; url?: string; thumbnailUrl?: string; tags: string[] };

function videoIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

export default function VideoWatchPage() {
  const { userId } = useSession();
  const router = useRouter();
  const { itemId } = useParams<{ itemId: string }>();
  const [videos, setVideos] = useState<LibraryItem[]>([]);
  const [activeId, setActiveId] = useState(itemId);

  useEffect(() => {
    fetch('/api/agents/coaching-coach-library/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action: 'get_library', params: { itemType: 'youtube' } }),
    })
      .then(r => r.json())
      .then(d => setVideos(d.data?.items ?? []));
  }, [userId]);

  const active = videos.find(v => v.itemId === activeId) ?? videos[0];
  const videoId = active ? videoIdFromUrl(active.url ?? '') : null;

  return (
    <div className="flex -m-8 h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 className="font-semibold text-sm">Videos</h2>
          <button type="button" onClick={() => router.push('/library')} className="text-xs text-gray-400 hover:text-gray-700">
            ← Library
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {videos.map(v => (
            <button
              key={v.itemId}
              type="button"
              onClick={() => setActiveId(v.itemId)}
              className={`w-full text-left p-3 border-b hover:bg-gray-50 transition-colors ${v.itemId === activeId ? 'bg-red-50 border-l-2 border-l-red-600' : ''}`}
            >
              {v.thumbnailUrl && (
                <img src={v.thumbnailUrl} alt={v.title} className="w-full rounded aspect-video object-cover mb-2"
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    const src = img.src;
                    if (src.includes('/mqdefault.jpg')) img.src = src.replace('/mqdefault.jpg', '/hqdefault.jpg');
                    else if (src.includes('/hqdefault.jpg')) img.src = src.replace('/hqdefault.jpg', '/sddefault.jpg');
                    else if (src.includes('/sddefault.jpg')) img.src = src.replace('/sddefault.jpg', '/default.jpg');
                    else img.style.display = 'none';
                  }}
                />
              )}
              <p className="text-xs font-medium line-clamp-2 text-gray-800">{v.title}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Player */}
      <div className="flex-1 flex flex-col bg-black overflow-hidden">
        <div className="flex-1">
          {videoId
            ? <iframe
                key={videoId}
                title={active?.title}
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            : <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                {videos.length === 0 ? 'Loading…' : 'Video unavailable'}
              </div>
          }
        </div>
        {active && (
          <div className="px-6 py-4 bg-gray-900 shrink-0">
            <h1 className="text-white font-semibold text-lg">{active.title}</h1>
            {active.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {active.tags.map(t => (
                  <span key={t} className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
