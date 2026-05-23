'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '@/components/SessionProvider';
import { createClient } from '@/lib/supabase/client';

type LibraryItem = {
  itemId: string;
  itemType: string;
  title: string;
  url?: string;
  buyLink?: string;
  thumbnailUrl?: string;
  tags: string[];
  description?: string;
  metadata?: Record<string, unknown>;
  transcript?: string;
};

type Tab = 'videos' | 'books' | 'articles' | 'other';
type InputMode = 'upload' | 'url' | 'text';
type VideoMode = 'channel' | 'single';
type OtherItemType = 'pdf' | 'podcast' | 'note';

const TABS: { id: Tab; label: string }[] = [
  { id: 'videos',   label: 'Videos'   },
  { id: 'books',    label: 'Books'    },
  { id: 'articles', label: 'Articles' },
  { id: 'other',    label: 'Other'    },
];

function videoIdFromUrl(url: string): string | null {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

async function agentAction(action: string, params: Record<string, unknown>, userId: string) {
  const r = await fetch('/api/agents/coaching-coach-library/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, config: {}, action, params }),
  });
  return r.json();
}

/** Fire-and-forget — trigger persona rebuild after any Pinecone embedding on the library page. */
function triggerPersonaBuild(userId: string) {
  fetch('/api/agents/coaching-persona-chat/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, config: {}, action: 'build_persona', params: {} }),
  }).catch(() => {});
}

async function uploadFile(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('library-files').upload(path, file);
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from('library-files').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Storage upload succeeded but no public URL returned — check that the library-files bucket is set to Public in Supabase.');
  return data.publicUrl;
}

function ModeToggle({ modes, active, onChange }: {
  modes: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
      {modes.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${active === m.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-gray-400 text-sm py-6">{label}</p>;
}

function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:from-indigo-50 hover:to-indigo-100/60 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* subtle background pattern */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #c7d2fe 1px, transparent 0)', backgroundSize: '20px 20px' }}
      />
      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
        <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors duration-200 shadow-inner">
          <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-gray-400 group-hover:text-indigo-600 tracking-wide transition-colors duration-200">{label}</span>
      </div>
    </button>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onPlay,
  onTranscript,
  selectable,
  selected,
  onSelect,
}: {
  item: LibraryItem;
  onEdit: (item: LibraryItem) => void;
  onDelete: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
  onTranscript?: (item: LibraryItem) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const isYoutube = item.itemType === 'youtube';
  const isNote    = item.itemType === 'note';
  const isBook    = item.itemType === 'book' || item.itemType === 'pdf';
  const author    = typeof item.metadata?.author === 'string' ? item.metadata.author : undefined;
  const icon = item.itemType === 'book'    ? '📖'
    : item.itemType === 'article' ? '📄'
    : item.itemType === 'pdf'     ? '📖'
    : item.itemType === 'podcast' ? '🎙️'
    : item.itemType === 'note'    ? '📝'
    : '📁';

  const bgGradient = isYoutube                    ? 'from-red-950 to-red-700'
    : isBook                                       ? 'from-amber-950 to-amber-700'
    : item.itemType === 'article'                  ? 'from-blue-950 to-blue-700'
    : item.itemType === 'podcast'                  ? 'from-purple-950 to-purple-700'
    : item.itemType === 'note'                     ? 'from-yellow-800 to-amber-500'
    : 'from-gray-800 to-gray-600';

  const iconPath = isBook
    ? 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    : item.itemType === 'article'
    ? 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
    : item.itemType === 'podcast'
    ? 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z'
    : isNote
    ? 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z'
    : 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z';

  const wrapperCls = `w-full rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 group/card bg-white${selected ? ' ring-2 ring-indigo-500 ring-offset-1' : ''}`;

  const imageSection = (
    <div className="relative w-full aspect-video">
      {/* background */}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          className={`absolute inset-0 w-full h-full ${isBook ? 'object-contain bg-gray-100' : 'object-cover'}`}
          onError={e => {
            const img = e.target as HTMLImageElement;
            const src = img.src;
            if (src.includes('/mqdefault.jpg')) {
              img.src = src.replace('/mqdefault.jpg', '/hqdefault.jpg');
            } else if (src.includes('/hqdefault.jpg')) {
              img.src = src.replace('/hqdefault.jpg', '/sddefault.jpg');
            } else if (src.includes('/sddefault.jpg')) {
              img.src = src.replace('/sddefault.jpg', '/default.jpg');
            } else {
              img.style.display = 'none';
            }
          }}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
          <div className="w-11 h-11 rounded-full bg-black/25 group-hover/card:bg-black/40 flex items-center justify-center transition-colors duration-200 shadow-lg">
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={iconPath}/></svg>
          </div>
        </div>
      )}
      {/* YouTube play button */}
      {isYoutube && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-black/50 group-hover/card:bg-red-600 flex items-center justify-center transition-colors duration-200 shadow-lg">
            <svg className="w-5 h-5 text-white fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}
      {/* checkbox */}
      {selectable && (
        <div
          style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 20 }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onSelect?.(item.itemId); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors shadow ${
            selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-white/60 hover:border-indigo-400'
          }`}>
            {selected && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M2 6l3 3 5-5"/></svg>}
          </div>
        </div>
      )}
      {/* action buttons */}
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
        {!isYoutube && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
            className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors"
            title="Edit"
          ><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z"/></svg></button>
        )}
        {isYoutube && onTranscript && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onTranscript(item); }}
            className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors"
            title={item.transcript ? 'Edit transcript' : 'Add transcript'}
          ><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg></button>
        )}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}
          className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors"
          title="Delete"
        ><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
    </div>
  );

  const textSection = (
    <div className="px-3 py-2.5 bg-white">
      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
      {author && <p className="text-xs text-gray-500 mt-0.5">by {author}</p>}
      {item.itemType === 'podcast' && !author && <p className="text-xs text-indigo-500 font-medium mt-0.5">Podcast</p>}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.tags.slice(0, 3).map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{t}</span>
          ))}
        </div>
      )}
    </div>
  );

  if (isNote) return (
    <div className={wrapperCls}>
      <div className={`relative w-full aspect-video bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
        <div className="w-11 h-11 rounded-full bg-black/25 group-hover/card:bg-black/40 flex items-center justify-center transition-colors duration-200 shadow-lg">
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={iconPath}/></svg>
        </div>
        {selectable && (
          <div className="absolute top-2 left-2 z-20" onClick={e => { e.preventDefault(); e.stopPropagation(); onSelect?.(item.itemId); }}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer shadow ${selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/80 border-white/60'}`}>
              {selected && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M2 6l3 3 5-5"/></svg>}
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(item); }} className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors" title="Edit"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z"/></svg></button>
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(item); }} className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors" title="Delete"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      </div>
      {textSection}
    </div>
  );

  if (isYoutube) return (
    <div className={wrapperCls}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onPlay(item)}
        onKeyDown={e => e.key === 'Enter' && onPlay(item)}
        className="block w-full text-left cursor-pointer"
      >
        {imageSection}
      </div>
      {textSection}
    </div>
  );

  const clickUrl = isBook ? (item.buyLink || item.url) : item.url;
  if (clickUrl) return (
    <div className={wrapperCls}>
      <div
        className="cursor-pointer"
        onClick={() => window.open(clickUrl, '_blank', 'noopener,noreferrer')}
        role="link"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && window.open(clickUrl, '_blank', 'noopener,noreferrer')}
      >{imageSection}</div>
      {textSection}
    </div>
  );
  return (
    <div className={wrapperCls}>
      {imageSection}
      {textSection}
    </div>
  );
}

export default function LibraryPage() {
  const { userId } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('videos');
  const [showAddForm, setShowAddForm] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [modalVideo, setModalVideo] = useState<LibraryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  // Selection + transcription (podcasts only — video selection removed)
  const [selectedPodcastIds, setSelectedPodcastIds] = useState<Set<string>>(new Set());
  const [transcribing, setTranscribing]             = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState('');

  // Video transcript edit modal
  const [transcriptItem,   setTranscriptItem]   = useState<LibraryItem | null>(null);
  const [transcriptText,   setTranscriptText]   = useState('');
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const [transcriptLogs,   setTranscriptLogs]   = useState<string[]>([]);
  const transcriptLogRef = useRef<HTMLDivElement>(null);

  // Videos tab
  const [videoMode, setVideoMode] = useState<VideoMode>('channel');
  const [channelUrl, setChannelUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Books tab
  const [bookTitle, setBookTitle] = useState('');
  const [bookUrl, setBookUrl] = useState('');
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookDesc, setBookDesc] = useState('');
  const [bookBuyLink, setBookBuyLink] = useState('');
  const [bookThumbnail, setBookThumbnail] = useState('');
  const [bookThumbFile, setBookThumbFile] = useState<File | null>(null);
  const bookThumbRef = useRef<HTMLInputElement>(null);
  const bookFileRef = useRef<HTMLInputElement>(null);

  // Articles tab
  const [artTitle, setArtTitle] = useState('');
  const [artUrl, setArtUrl] = useState('');
  const [artFile, setArtFile] = useState<File | null>(null);
  const [artDesc, setArtDesc] = useState('');
  const artFileRef = useRef<HTMLInputElement>(null);

  // Other tab
  const [otherItemType, setOtherItemType] = useState<OtherItemType>('pdf');
  const [otherTitle, setOtherTitle] = useState('');
  const [otherUrl, setOtherUrl] = useState('');
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [otherText, setOtherText] = useState('');
  const otherFileRef = useRef<HTMLInputElement>(null);
  const [podcastThumbUrl, setPodcastThumbUrl] = useState('');
  const [fetchingThumb, setFetchingThumb] = useState(false);

  // Edit modal state
  const [editItem,          setEditItem]          = useState<LibraryItem | null>(null);
  const [editTitle,         setEditTitle]         = useState('');
  const [editDesc,          setEditDesc]          = useState('');
  const [editUrl,           setEditUrl]           = useState('');
  const [editBuyLink,       setEditBuyLink]       = useState('');       // books: file url / buy link
  const [editAuthor,        setEditAuthor]        = useState('');       // books: author
  const [editThumbnailUrl,  setEditThumbnailUrl]  = useState('');
  const [editTags,          setEditTags]          = useState('');       // comma-separated
  const [editFile,          setEditFile]          = useState<File | null>(null);
  const [editThumbFile,     setEditThumbFile]     = useState<File | null>(null);
  const [editSaving,        setEditSaving]        = useState(false);
  const editFileRef  = useRef<HTMLInputElement>(null);
  const editThumbRef = useRef<HTMLInputElement>(null);

  async function fetchPodcastThumbnail(url: string): Promise<string | null> {
    if (!url) return null;
    try {
      const r = await fetch(`/api/thumbnail?url=${encodeURIComponent(url)}`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.thumbnailUrl ?? null;
    } catch {
      return null;
    }
  }

  async function load() {
    const r = await agentAction('get_library', {}, userId) as { data: { items: LibraryItem[] } };
    const loaded: LibraryItem[] = r.data?.items ?? [];
    setItems(loaded);
    // Backfill thumbnails for podcasts that don't have one
    const missing = loaded.filter(i => i.itemType === 'podcast' && !i.thumbnailUrl && i.url);
    for (const item of missing) {
      const thumbUrl = await fetchPodcastThumbnail(item.url!);
      if (thumbUrl) {
        await agentAction('update_item', { itemId: item.itemId, thumbnailUrl: thumbUrl }, userId);
        setItems(prev => prev.map(i => i.itemId === item.itemId ? { ...i, thumbnailUrl: thumbUrl } : i));
      }
    }
  }

  useEffect(() => { if (userId) load(); }, [userId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const closeModal = useCallback(() => setModalVideo(null), []);
  const closeEdit  = useCallback(() => { setEditItem(null); setEditFile(null); setEditThumbFile(null); }, []);

  useEffect(() => {
    if (!modalVideo && !editItem && !showAddForm) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { closeModal(); closeEdit(); setShowAddForm(false); } }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalVideo, editItem, showAddForm, closeModal, closeEdit]);

  function openEdit(item: LibraryItem) {
    console.log('[Library] openEdit called:', item);
    try {
      setEditItem(item);
      setEditTitle(item.title);
      setEditDesc(item.description ?? '');
      setEditUrl(item.url ?? '');
      setEditBuyLink(item.buyLink ?? '');
      setEditAuthor(typeof item.metadata?.author === 'string' ? item.metadata.author : '');
      setEditThumbnailUrl(item.thumbnailUrl ?? '');
      setEditTags((item.tags ?? []).join(', '));
      setEditFile(null);
      setEditThumbFile(null);
      if (editFileRef.current)  editFileRef.current.value  = '';
      if (editThumbRef.current) editThumbRef.current.value = '';
      console.log('[Library] openEdit complete, modal should open');
    } catch (err) {
      console.error('[Library] openEdit threw an error:', err);
    }
  }

  async function handleDelete(item: LibraryItem) {
    if (!window.confirm(`Remove "${item.title}" from your library?`)) return;
    await agentAction('remove_item', { itemId: item.itemId }, userId);
    await load();
  }

  async function handleSave() {
    if (!editItem) return;
    console.log('[Library] handleSave called for:', editItem.itemId, editItem.itemType);
    setEditSaving(true);
    const isBook = editItem.itemType === 'book' || editItem.itemType === 'pdf';
    let uploadedUrl: string | undefined;
    if (editFile) {
      uploadedUrl = await uploadFile(editFile, userId);
    }
    let finalThumb = editThumbnailUrl || undefined;
    if (editThumbFile) {
      finalThumb = await uploadFile(editThumbFile, userId);
    }
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    const patch: Record<string, unknown> = {
      itemId:       editItem.itemId,
      title:        editTitle,
      description:  editDesc,
      tags,
    };
    if (isBook) {
      const finalUrl = uploadedUrl ?? (editUrl || undefined);
      if (finalUrl !== undefined) patch.url = finalUrl;
      patch.buyLink = editBuyLink || undefined;
      patch.metadata = { ...editItem.metadata, author: editAuthor };
    } else {
      const finalUrl = uploadedUrl ?? (editUrl || undefined);
      if (finalUrl !== undefined) patch.url = finalUrl;
    }
    if (finalThumb !== undefined) patch.thumbnailUrl = finalThumb;
    try {
      console.log('[Library] Sending update_item patch:', patch);
      const result = await agentAction('update_item', patch, userId);
      console.log('[Library] update_item response:', result);
      if (!result.success) {
        throw new Error(result.message ?? 'Agent returned failure');
      }
      await load();
      closeEdit();
    } catch (err) {
      console.error('[Library] Failed to save:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }

  function openTranscriptModal(item: LibraryItem) {
    setTranscriptItem(item);
    setTranscriptText(item.transcript ?? '');
    setTranscriptLogs([]);
  }

  async function handleSaveTranscript() {
    if (!transcriptItem || !transcriptText.trim()) return;
    setTranscriptSaving(true);
    setTranscriptLogs([]);
    const pushLog = (line: string) =>
      setTranscriptLogs(prev => {
        const next = [...prev, line];
        requestAnimationFrame(() => { if (transcriptLogRef.current) transcriptLogRef.current.scrollTop = transcriptLogRef.current.scrollHeight; });
        return next;
      });
    try {
      pushLog(`📝 Saving transcript (${transcriptText.trim().length.toLocaleString()} chars)…`);
      pushLog(`🔧 Chunking and embedding into vector store…`);
      await agentAction('save_and_index_transcript', { itemId: transcriptItem.itemId, transcript: transcriptText }, userId);
      pushLog(`✅ Transcript indexed successfully.`);
      triggerPersonaBuild(userId);
      await load();
      setTimeout(() => setTranscriptItem(null), 800);
    } catch (err) {
      console.error('[library] save_and_index_transcript failed:', err);
      pushLog(`❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTranscriptSaving(false);
      return;
    }
    setTranscriptSaving(false);
  }

  function togglePodcastSelection(id: string) {
    setSelectedPodcastIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleTranscribeSelected(ids: Set<string>, clearFn: () => void) {
    if (!ids.size || transcribing) return;
    console.log(`[library] transcribe clicked — ${ids.size} item(s) selected:`, [...ids]);
    setTranscribing(true);
    const arr = [...ids];
    let done = 0, failed = 0;
    for (const itemId of arr) {
      setTranscribeProgress(`Transcribing ${done + 1}/${arr.length}…`);
      console.log(`[library] transcribing item ${done + 1}/${arr.length}: ${itemId}`);
      try {
        const result = await agentAction('transcribe_item', { itemId }, userId);
        console.log(`[library] transcribe_item succeeded for ${itemId}:`, result);
        done++;
      } catch (err) {
        console.error(`[library] transcribe_item failed for ${itemId}:`, err);
        failed++;
      }
    }
    console.log(`[library] transcription batch complete — done: ${done}, failed: ${failed}`);
    setTranscribeProgress(`Done — ${done} indexed${failed ? `, ${failed} failed` : ''}.`);
    if (done > 0) triggerPersonaBuild(userId);
    clearFn();
    await load();
    setTranscribing(false);
    setTimeout(() => setTranscribeProgress(''), 6000);
  }

  async function syncYoutube(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true); setSyncStatus('');
    const r = await agentAction('sync_youtube', { channelUrl }, userId) as { data: { added: number; updated: number } };
    setSyncStatus(`Added: ${r.data?.added}, Updated: ${r.data?.updated}`);
    setSyncing(false);
    await load();
  }

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg('');
    await agentAction('add_video', { title: videoTitle, url: videoUrl }, userId);
    triggerPersonaBuild(userId);
    setVideoTitle(''); setVideoUrl('');
    setSubmitMsg('Video added.');
    setShowAddForm(false);
    setSubmitting(false);
    await load();
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg('');
    let thumbUrl = bookThumbnail || undefined;
    if (bookThumbFile) {
      thumbUrl = await uploadFile(bookThumbFile, userId);
      setBookThumbFile(null);
      if (bookThumbRef.current) bookThumbRef.current.value = '';
    }
    if (!bookFile) { setSubmitMsg('Please upload a PDF or Word file for the book.'); setSubmitting(false); return; }
    const fileUrl = await uploadFile(bookFile, userId);
    setBookFile(null);
    if (bookFileRef.current) bookFileRef.current.value = '';
    await agentAction('add_book', { title: bookTitle, author: '', url: fileUrl, buyLink: bookBuyLink || undefined, description: bookDesc, thumbnailUrl: thumbUrl, tags: [] }, userId);
    triggerPersonaBuild(userId);
    setBookTitle(''); setBookUrl(''); setBookDesc(''); setBookThumbnail(''); setBookBuyLink('');
    setSubmitMsg('Book added.');
    setShowAddForm(false);
    setSubmitting(false);
    await load();
  }

  async function addArticle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg('');
    let url = artUrl;
    if (artFile) {
      url = await uploadFile(artFile, userId);
      setArtFile(null);
      if (artFileRef.current) artFileRef.current.value = '';
    }
    await agentAction('add_article', { title: artTitle, url, description: artDesc, tags: [] }, userId);
    triggerPersonaBuild(userId);
    setArtTitle(''); setArtUrl(''); setArtDesc('');
    setSubmitMsg('Article added.');
    setShowAddForm(false);
    setSubmitting(false);
    await load();
  }

  async function addOther(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSubmitMsg('');
    if (otherItemType === 'note') {
      await agentAction('add_note', { title: otherTitle, body: otherText }, userId);
      triggerPersonaBuild(userId);
      setOtherTitle(''); setOtherText('');
      setSubmitMsg('Note added.');
      setShowAddForm(false);
    } else {
      let url = otherUrl;
      if (otherFile) {
        url = await uploadFile(otherFile, userId);
        setOtherFile(null);
        if (otherFileRef.current) otherFileRef.current.value = '';
      }
      const action = otherItemType === 'pdf' ? 'add_pdf' : 'add_podcast';
      const params = otherItemType === 'pdf'
        ? { title: otherTitle, fileUrl: url, description: otherText, tags: [] }
        : { title: otherTitle, url, description: otherText, tags: [], thumbnailUrl: podcastThumbUrl || undefined };
      await agentAction(action, params, userId);
      triggerPersonaBuild(userId);
      setOtherTitle(''); setOtherUrl(''); setOtherText(''); setPodcastThumbUrl('');
      setSubmitMsg(`${otherItemType === 'pdf' ? 'PDF' : 'Podcast'} added.`);
      setShowAddForm(false);
    }
    setSubmitting(false);
    await load();
  }

  const videoItems   = items.filter(i => i.itemType === 'youtube');
  const bookItems    = items.filter(i => i.itemType === 'book' || i.itemType === 'pdf');
  const articleItems = items.filter(i => i.itemType === 'article');
  const otherItems   = items.filter(i => i.itemType === 'podcast' || i.itemType === 'note');

  const tabCount: Record<Tab, number> = {
    videos:   videoItems.length,
    books:    bookItems.length,
    articles: articleItems.length,
    other:    otherItems.length,
  };

  const btnCls = (color: string) =>
    `px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 ${color}`;

  const TAB_ICONS: Record<Tab, React.ReactNode> = {
    videos: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    books: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    articles: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    other: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  };

  return (
    <div className="flex -mx-8 -my-8 h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <nav className="group/sidebar shrink-0 w-[52px] hover:w-48 transition-[width] duration-200 overflow-hidden bg-white border-r flex flex-col">
        <div className="flex-1 pt-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setSubmitMsg(''); setShowAddForm(false); }}
              className={`flex items-center gap-3 w-full px-3.5 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {TAB_ICONS[tab.id]}
              <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {submitMsg && <p className="text-sm text-green-700 mb-4">{submitMsg}</p>}

          {/* -- Videos -- */}
      {activeTab === 'videos' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <AddCard label="Add Video" onClick={() => setShowAddForm(true)} />
            {videoItems.map(i => (
              <ItemCard key={i.itemId} item={i} onEdit={openEdit} onDelete={handleDelete} onPlay={setModalVideo}
                onTranscript={openTranscriptModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* -- Books -- */}
      {activeTab === 'books' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <AddCard label="Add Book" onClick={() => setShowAddForm(true)} />
            {bookItems.map(i => <ItemCard key={i.itemId} item={i} onEdit={openEdit} onDelete={handleDelete} onPlay={setModalVideo} />)}
          </div>
        </div>
      )}

      {/* -- Articles -- */}
      {activeTab === 'articles' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <AddCard label="Add Article" onClick={() => setShowAddForm(true)} />
            {articleItems.map(i => <ItemCard key={i.itemId} item={i} onEdit={openEdit} onDelete={handleDelete} onPlay={setModalVideo} />)}
          </div>
        </div>
      )}

      {/* -- Other (PDF / Podcast / Note) -- */}
      {activeTab === 'other' && (
        <div>
          {otherItems.length > 0 && otherItemType === 'podcast' && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">
                {selectedPodcastIds.size > 0
                  ? `${selectedPodcastIds.size} selected`
                  : 'Click podcast cards to select for transcription'}
              </p>
              <div className="flex items-center gap-2">
                {transcribeProgress && <span className="text-xs text-indigo-600">{transcribeProgress}</span>}
                {selectedPodcastIds.size > 0 && (
                  <button
                    type="button"
                    disabled={transcribing}
                    onClick={() => handleTranscribeSelected(selectedPodcastIds, () => setSelectedPodcastIds(new Set()))}
                    className="px-3 py-1.5 rounded text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {transcribing ? 'Transcribing…' : `Transcribe Selected (${selectedPodcastIds.size})`}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <AddCard label="Add Resource" onClick={() => setShowAddForm(true)} />
            {otherItems.map(i => (
              <ItemCard key={i.itemId} item={i} onEdit={openEdit} onDelete={handleDelete} onPlay={setModalVideo}
                selectable={i.itemType === 'podcast'}
                selected={selectedPodcastIds.has(i.itemId)}
                onSelect={i.itemType === 'podcast' ? togglePodcastSelection : undefined}
              />
            ))}
          </div>
        </div>
      )}

        </div>{/* end scrollable content */}
      </div>{/* end main content column */}

      {/* -- Add Form Modal -- */}
      {mounted && showAddForm && createPortal(
        <div
          onClick={() => setShowAddForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9997, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '36rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="font-semibold text-base">
                {{ videos: 'Add Video', books: 'Add Book', articles: 'Add Article', other: 'Add Resource' }[activeTab]}
              </h2>
              <button type="button" onClick={() => setShowAddForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-1">
              {submitMsg && <p className="text-sm text-green-700 mb-4">{submitMsg}</p>}

              {/* Videos form */}
              {activeTab === 'videos' && (
                <div>
                  <ModeToggle
                    modes={[{ id: 'channel', label: '\uD83D\uDCFA Sync Channel' }, { id: 'single', label: '\u25B6\uFE0F Single Video' }]}
                    active={videoMode}
                    onChange={v => { setVideoMode(v as VideoMode); setSyncStatus(''); setSubmitMsg(''); }}
                  />
                  {videoMode === 'channel' && (
                    <>
                      <p className="text-xs text-gray-500 mb-3">Import all videos from a YouTube channel at once.</p>
                      <form onSubmit={syncYoutube} className="flex gap-2">
                        <input
                          className="flex-1 border rounded px-3 py-2 text-sm"
                          placeholder="https://youtube.com/@yourhandle"
                          value={channelUrl}
                          onChange={e => setChannelUrl(e.target.value)}
                          required
                        />
                        <button type="submit" disabled={syncing} className={btnCls('bg-red-600')}>
                          {syncing ? 'Syncing\u2026' : 'Sync'}
                        </button>
                      </form>
                      {syncStatus && <p className="text-sm text-green-700 mt-2">{syncStatus}</p>}
                    </>
                  )}
                  {videoMode === 'single' && (
                    <>
                      <p className="text-xs text-gray-500 mb-3">Add one video by pasting its YouTube URL.</p>
                      <form onSubmit={addVideo} className="space-y-2">
                        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Title" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} required />
                        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} required />
                        <button type="submit" disabled={submitting} className={btnCls('bg-red-600')}>
                          {submitting ? 'Adding\u2026' : 'Add Video'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}

              {/* Books form */}
              {activeTab === 'books' && (
                <form onSubmit={addBook} className="space-y-3">
                  <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Title" value={bookTitle} onChange={e => setBookTitle(e.target.value)} required />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500">Book file <span className="text-red-500">*</span></p>
                      <label className="flex flex-col gap-0.5 text-xs text-gray-400">
                        PDF or Word document (required)
                        <input ref={bookFileRef} type="file" accept=".pdf,.doc,.docx" required title="Upload book file" className="text-sm text-gray-600" onChange={e => setBookFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-500">Cover image</p>
                      <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Paste image URL (optional)" value={bookThumbnail} onChange={e => setBookThumbnail(e.target.value)} />
                      <label className="flex flex-col gap-0.5 text-xs text-gray-400">
                        or upload an image
                        <input ref={bookThumbRef} type="file" accept="image/*" title="Upload cover image" className="text-sm text-gray-600" onChange={e => setBookThumbFile(e.target.files?.[0] ?? null)} />
                      </label>
                      {(bookThumbnail || bookThumbFile) && (
                        <img
                          src={bookThumbFile ? URL.createObjectURL(bookThumbFile) : bookThumbnail}
                          alt="Cover preview"
                          className="w-20 aspect-video rounded object-cover border border-gray-200"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">Where to buy (optional)</p>
                    <input className="border rounded px-3 py-2 text-sm w-full" placeholder="e.g. Amazon or Bookshop link" value={bookBuyLink} onChange={e => setBookBuyLink(e.target.value)} />
                  </div>
                  <button type="submit" disabled={submitting} className={btnCls('bg-indigo-600')}>
                    {submitting ? 'Adding\u2026' : 'Add Book'}
                  </button>
                </form>
              )}

              {/* Articles form */}
              {activeTab === 'articles' && (
                <form onSubmit={addArticle} className="space-y-3">
                  <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Title" value={artTitle} onChange={e => setArtTitle(e.target.value)} required />
                  <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Description (optional)" value={artDesc} onChange={e => setArtDesc(e.target.value)} />
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">Article link or file</p>
                    <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Paste URL (optional)" value={artUrl} onChange={e => setArtUrl(e.target.value)} />
                    <label className="flex flex-col gap-0.5 text-xs text-gray-400">
                      or upload a file
                      <input ref={artFileRef} type="file" title="Upload article file" className="text-sm text-gray-600" onChange={e => setArtFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                  <button type="submit" disabled={submitting} className={btnCls('bg-indigo-600')}>
                    {submitting ? 'Adding\u2026' : 'Add Article'}
                  </button>
                </form>
              )}

              {/* Other form (PDF / Podcast / Note) */}
              {activeTab === 'other' && (
                <div>
                  <ModeToggle
                    modes={[
                      { id: 'pdf',     label: '\uD83D\uDCC4 PDF'     },
                      { id: 'podcast', label: '\uD83C\uDF99\uFE0F Podcast' },
                      { id: 'note',    label: '\uD83D\uDCDD Note'    },
                    ]}
                    active={otherItemType}
                    onChange={t => { setOtherItemType(t as OtherItemType); setOtherTitle(''); setOtherUrl(''); setOtherFile(null); setOtherText(''); setPodcastThumbUrl(''); }}
                  />
                  <form onSubmit={addOther} className="space-y-3">
                    <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Title" value={otherTitle} onChange={e => setOtherTitle(e.target.value)} required />
                    {otherItemType === 'note' ? (
                      <textarea
                        className="border rounded px-3 py-2 text-sm w-full h-28 resize-none"
                        placeholder="Type your note here\u2026"
                        value={otherText}
                        onChange={e => setOtherText(e.target.value)}
                        required
                      />
                    ) : (
                      <>
                        <input className="border rounded px-3 py-2 text-sm w-full" placeholder="Description (optional)" value={otherText} onChange={e => setOtherText(e.target.value)} />
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-gray-500">{otherItemType === 'pdf' ? 'PDF' : 'Podcast'} link or file</p>
                          <input
                            className="border rounded px-3 py-2 text-sm w-full"
                            placeholder="Paste URL (optional)"
                            value={otherUrl}
                            onChange={e => { setOtherUrl(e.target.value); setPodcastThumbUrl(''); }}
                            onBlur={async e => {
                              if (otherItemType !== 'podcast' || !e.target.value) return;
                              setFetchingThumb(true);
                              const thumb = await fetchPodcastThumbnail(e.target.value);
                              setPodcastThumbUrl(thumb ?? '');
                              setFetchingThumb(false);
                            }}
                          />
                          {otherItemType === 'podcast' && (
                            fetchingThumb
                              ? <p className="text-xs text-gray-400">Fetching cover\u2026</p>
                              : podcastThumbUrl
                                ? <img src={podcastThumbUrl} alt="Podcast cover" className="w-16 aspect-square rounded object-cover border border-gray-200" />
                                : null
                          )}
                          <label className="flex flex-col gap-0.5 text-xs text-gray-400">
                            or upload a file
                            <input ref={otherFileRef} type="file" title={`Upload ${otherItemType} file`} className="text-sm text-gray-600" onChange={e => setOtherFile(e.target.files?.[0] ?? null)} />
                          </label>
                        </div>
                      </>
                    )}
                    <button type="submit" disabled={submitting} className={btnCls('bg-indigo-600')}>
                      {submitting ? 'Adding\u2026' : `Add ${otherItemType === 'pdf' ? 'PDF' : otherItemType === 'podcast' ? 'Podcast' : 'Note'}`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* -- Edit Modal -- */}
      {/* -- Transcript Edit Modal (YouTube videos) -- */}
      {mounted && transcriptItem && createPortal(
        <div
          onClick={() => !transcriptSaving && setTranscriptItem(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '40rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="font-semibold text-base">{transcriptItem.transcript ? 'Edit Transcript' : 'Add Transcript'}</h2>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{transcriptItem.title}</p>
              </div>
              <button type="button" disabled={transcriptSaving} onClick={() => setTranscriptItem(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Transcript</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none h-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste or type the transcript here…"
                value={transcriptText}
                onChange={e => setTranscriptText(e.target.value)}
                disabled={transcriptSaving}
              />
              <p className="text-xs text-gray-400 mt-1.5">The transcript will be saved and immediately indexed for RAG search.</p>
            </div>

            {/* Progress log */}
            {transcriptLogs.length > 0 && (
              <div
                ref={transcriptLogRef}
                className="mx-6 mb-4 bg-gray-950 rounded-lg px-3 py-2.5 max-h-28 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
              >
                {transcriptLogs.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith('✅') ? 'text-green-400'
                      : line.startsWith('❌') ? 'text-red-400'
                      : line.startsWith('🔧') ? 'text-yellow-300'
                      : 'text-gray-400'
                    }
                  >{line}</div>
                ))}
                {transcriptSaving && <div className="text-gray-500 animate-pulse">▌</div>}
              </div>
            )}
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button type="button" disabled={transcriptSaving} onClick={() => setTranscriptItem(null)} className="px-4 py-2 rounded text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={transcriptSaving || !transcriptText.trim()} onClick={handleSaveTranscript} className="px-4 py-2 rounded text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {transcriptSaving ? 'Saving & indexing…' : 'Save & Index'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && editItem && createPortal(
        <div
          onClick={closeEdit}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '32rem', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="font-semibold text-base">
                Edit {editItem.itemType === 'youtube' ? 'Video' : editItem.itemType === 'pdf' ? 'PDF' : editItem.itemType.charAt(0).toUpperCase() + editItem.itemType.slice(1)}
              </h2>
              <button type="button" onClick={closeEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Title — all types */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder="Title"
                  title="Title"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              {/* Description / body — not for youtube */}
              {editItem.itemType !== 'youtube' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {editItem.itemType === 'note' ? 'Body' : 'Description'}
                  </label>
                  <textarea
                    className="border rounded px-3 py-2 text-sm w-full resize-none h-24"
                    placeholder="Enter text…"
                    title="Description"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                  />
                </div>
              )}

              {/* URL / file — for everything except note */}
              {editItem.itemType !== 'note' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {editItem.itemType === 'youtube' ? 'Video URL' : editItem.itemType === 'book' ? 'Book file or link' : editItem.itemType === 'article' ? 'Article link or file' : `${editItem.itemType === 'pdf' ? 'PDF' : 'Podcast'} link or file`}
                  </label>
                  <input
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="Paste URL"
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                  />
                  {editItem.itemType !== 'youtube' && (
                    <label className="flex flex-col gap-0.5 text-xs text-gray-400 mt-1.5">
                      or upload a file
                      <input
                        ref={editFileRef}
                        type="file"
                        title="Upload file"
                        className="text-sm text-gray-600"
                        onChange={e => setEditFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Author — book/pdf only */}
              {(editItem.itemType === 'book' || editItem.itemType === 'pdf') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Author</label>
                  <input
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="Author name"
                    value={editAuthor}
                    onChange={e => setEditAuthor(e.target.value)}
                  />
                </div>
              )}

              {/* Where to buy — book/pdf only */}
              {(editItem.itemType === 'book' || editItem.itemType === 'pdf') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Where to buy</label>
                  <input
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="e.g. Amazon or Bookshop link"
                    value={editBuyLink}
                    onChange={e => setEditBuyLink(e.target.value)}
                  />
                </div>
              )}

              {/* Cover image — book/pdf only */}
              {(editItem.itemType === 'book' || editItem.itemType === 'pdf') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cover image</label>
                  <input
                    className="border rounded px-3 py-2 text-sm w-full"
                    placeholder="Paste image URL"
                    value={editThumbnailUrl}
                    onChange={e => setEditThumbnailUrl(e.target.value)}
                  />
                  <label className="flex flex-col gap-0.5 text-xs text-gray-400 mt-1.5">
                    or upload an image
                    <input
                      ref={editThumbRef}
                      type="file"
                      accept="image/*"
                      title="Upload cover image"
                      className="text-sm text-gray-600"
                      onChange={e => setEditThumbFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {(editThumbnailUrl || editThumbFile) && (
                    <img
                      src={editThumbFile ? URL.createObjectURL(editThumbFile) : editThumbnailUrl}
                      alt="Cover preview"
                      className="h-20 rounded object-cover border border-gray-200 mt-2"
                    />
                  )}
                </div>
              )}

              {/* Categories / tags — all types, labelled as "Categories" for videos */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {editItem.itemType === 'youtube' ? 'Categories' : 'Tags'}
                  <span className="font-normal text-gray-400 ml-1">(comma-separated)</span>
                </label>
                <input
                  className="border rounded px-3 py-2 text-sm w-full"
                  placeholder={editItem.itemType === 'youtube' ? 'e.g. fitness, mindset, nutrition' : 'e.g. beginner, health'}
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 rounded text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSave}
                className="px-4 py-2 rounded text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Video lightbox */}
      {modalVideo && createPortal(
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '90vw', maxWidth: '960px' }}>
            <button
              type="button"
              onClick={closeModal}
              style={{ position: 'absolute', top: '-2rem', right: 0, color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              ? Close
            </button>
            <iframe
              key={modalVideo.itemId}
              title={modalVideo.title}
              src={`https://www.youtube.com/embed/${videoIdFromUrl(modalVideo.url ?? '')}?autoplay=1`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              style={{ display: 'block', width: '90vw', maxWidth: '960px', height: 'calc(90vw * 9 / 16)', maxHeight: 'calc(960px * 9 / 16)', border: 'none', borderRadius: '8px' }}
            />
            <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 500, marginTop: '0.75rem' }}>{modalVideo.title}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
