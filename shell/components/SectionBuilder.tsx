'use client';
import { useState } from 'react';

// -- Types ---------------------------------------------------------------------

export type SectionType =
  | 'text' | 'video' | 'long_form_qa' | 'single_choice' | 'multi_choice'
  | 'match_following' | 'rating' | 'image_embed' | 'file' | 'assignment';

export type CallAction = (a: string, p: Record<string, unknown>) => Promise<unknown>;

export interface SectionBuilderProps {
  onSave:       (type: SectionType, body: Record<string, unknown>) => Promise<void>;
  compact?:     boolean;
  editSection?: { sectionId: string; contentType: SectionType; body: Record<string, unknown> };
  callAction?:  CallAction;
}

// -- Constants -----------------------------------------------------------------

export const SECTION_LABELS: Record<SectionType, string> = {
  text:           'Text Block',
  video:          'Video',
  long_form_qa:   'Written Q&A',
  single_choice:  'Single Choice',
  multi_choice:   'Multiple Choice',
  match_following:'Match the Following',
  rating:         'Rating',
  image_embed:    'Image',
  file:           'File Upload',
  assignment:     'Assignment',
};

export const SECTION_ICONS: Record<SectionType, string> = {
  text:           'TXT',
  video:          'VID',
  long_form_qa:   'QA',
  single_choice:  'SC',
  multi_choice:   'MC',
  match_following:'MF',
  rating:         'RT',
  image_embed:    'IMG',
  file:           'FILE',
  assignment:     'ASMT',
};

// -- Helpers -------------------------------------------------------------------

export function isValidEmbedUrl(url: string) {
  return url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/');
}

export function toEmbedUrl(raw: string): string {
  const s = raw.trim();
  if (!s || isValidEmbedUrl(s)) return s;
  const ytMatch = s.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = s.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return s;
}

export function sectionLabel(type: SectionType, body: Record<string, unknown>): string {
  switch (type) {
    case 'text':            return String(body.content ?? '').slice(0, 50);
    case 'video':           return String(body.caption || body.embedUrl || '');
    case 'long_form_qa': {
      const qs = body.questions as { question: string }[] | undefined;
      return qs ? qs.length + ' question' + (qs.length > 1 ? 's' : '') : 'Q&A';
    }
    case 'single_choice':   return String(body.question ?? '');
    case 'multi_choice':    return String(body.question ?? '');
    case 'match_following': return ((body.pairs as unknown[])?.length ?? 0) + ' pairs';
    case 'rating':          return String(body.question ?? '');
    case 'image_embed':     return String(body.caption || body.imageUrl || '');
    case 'file':            return String(body.fileName ?? body.fileUrl ?? '');
    case 'assignment':      return String(body.title ?? body.instructions ?? '');
  }
}

// -- Shared UI primitives ------------------------------------------------------

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const smallInputCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors';
const btnGhost = 'text-indigo-600 hover:text-indigo-800 text-sm font-medium';
const btnDanger = 'text-red-400 hover:text-red-600 text-xs';
const btnSecondary = 'border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors';

function SaveBtn({ disabled, onClick, saving, label = 'Save' }: {
  disabled: boolean; onClick: () => void; saving: boolean; label?: string;
}) {
  return (
    <button type="button" disabled={disabled || saving} onClick={onClick} className={btnPrimary}>
      {saving ? 'Saving...' : label}
    </button>
  );
}

interface FormProps {
  onCommit:     (b: Record<string, unknown>) => void;
  saving:       boolean;
  initialBody?: Record<string, unknown>;
  callAction?:  CallAction;
}

// -- Section type forms --------------------------------------------------------

function TextForm({ onCommit, saving, initialBody }: FormProps) {
  const [content, setContent] = useState(initialBody?.content as string ?? '');
  return (
    <div className="space-y-3">
      <textarea className={inputCls + ' h-28'} placeholder="Description or text content..."
        value={content} onChange={e => setContent(e.target.value)} />
      <SaveBtn disabled={!content.trim() || saving} onClick={() => onCommit({ content })} saving={saving} />
    </div>
  );
}

function VideoForm({ onCommit, saving, initialBody, callAction }: FormProps) {
  const [embedUrl, setEmbedUrl] = useState(initialBody?.embedUrl as string ?? '');
  const [caption, setCaption]   = useState(initialBody?.caption as string ?? '');
  const [warn, setWarn]         = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [ytVideos, setYtVideos]     = useState<{ videoId: string; title: string; thumbnailUrl: string }[] | null>(null);
  const [ytLoading, setYtLoading]   = useState(false);
  const [ytError, setYtError]       = useState('');

  function onChange(val: string) {
    const embed = toEmbedUrl(val);
    setEmbedUrl(embed);
    setWarn(embed && !isValidEmbedUrl(embed) ? 'Paste a YouTube or Vimeo URL' : '');
  }

  async function loadYtVideos() {
    if (!callAction) return;
    setYtLoading(true); setYtError(''); setShowPicker(true);
    try {
      const r = await callAction('list_my_youtube_videos', {}) as { success: boolean; message?: string; data?: { videos: { videoId: string; title: string; thumbnailUrl: string }[] } };
      if (!r.success) { setYtError(r.message ?? 'Failed to load videos'); return; }
      setYtVideos(r.data?.videos ?? []);
    } finally { setYtLoading(false); }
  }

  function pickVideo(videoId: string) {
    onChange(`https://www.youtube.com/embed/${videoId}`);
    setShowPicker(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex gap-2">
          <input className={inputCls + ' flex-1'} placeholder="YouTube or Vimeo URL"
            value={embedUrl} onChange={e => onChange(e.target.value)} />
          {callAction && (
            <button type="button" onClick={loadYtVideos}
              className={btnGhost + ' shrink-0 text-xs whitespace-nowrap'}>
              Pick from YouTube
            </button>
          )}
        </div>
        {warn && <p className="text-xs text-amber-600 mt-1">{warn}</p>}
      </div>
      {showPicker && (
        <div className="border border-gray-200 rounded-xl bg-white p-3 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Your YouTube videos</span>
            <button type="button" onClick={() => setShowPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">x Close</button>
          </div>
          {ytLoading && <p className="text-xs text-gray-400">Loading...</p>}
          {ytError && <p className="text-xs text-red-500">{ytError}</p>}
          {ytVideos && ytVideos.length === 0 && <p className="text-xs text-gray-400">No videos found. Connect a channel in Settings first.</p>}
          {ytVideos && ytVideos.map(v => (
            <button key={v.videoId} type="button" onClick={() => pickVideo(v.videoId)}
              className="flex items-center gap-3 w-full text-left hover:bg-indigo-50 rounded-lg p-2 transition-colors">
              <img src={v.thumbnailUrl} alt={v.title} className="w-20 h-12 object-cover rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-sm text-gray-700 line-clamp-2">{v.title}</span>
            </button>
          ))}
        </div>
      )}
      {embedUrl && !warn && (
        <div className="rounded-lg overflow-hidden border border-gray-200 aspect-video">
          <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" title="Video preview" />
        </div>
      )}
      <input className={inputCls} placeholder="Caption (optional)"
        value={caption} onChange={e => setCaption(e.target.value)} />
      <SaveBtn disabled={!embedUrl || !!warn || saving}
        onClick={() => onCommit({ embedUrl, caption: caption || undefined })} saving={saving} />
    </div>
  );
}

function ImageEmbedForm({ onCommit, saving, initialBody }: FormProps) {
  const [imageUrl, setImageUrl] = useState(initialBody?.imageUrl as string ?? '');
  const [caption, setCaption]   = useState(initialBody?.caption as string ?? '');
  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Image URL (publicly accessible, e.g. Imgur, Google Drive)"
        value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      {imageUrl && (
        <img src={imageUrl} alt="preview" className="max-h-48 rounded-lg border object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <input className={inputCls} placeholder="Caption (optional)"
        value={caption} onChange={e => setCaption(e.target.value)} />
      <SaveBtn disabled={!imageUrl.trim() || saving}
        onClick={() => onCommit({ imageUrl, caption: caption || undefined })} saving={saving} />
    </div>
  );
}

function LongFormQAForm({ onCommit, saving, initialBody }: FormProps) {
  const initQs = (initialBody?.questions as { question: string; hint?: string; minWords?: number }[])
    ?? [{ question: '', hint: '', minWords: 0 }];
  const [questions, setQuestions] = useState(initQs.map(q => ({
    question: q.question, hint: q.hint ?? '', minWords: q.minWords ? String(q.minWords) : '',
  })));

  function update(i: number, field: 'question'|'hint'|'minWords', val: string) {
    setQuestions(qs => qs.map((q, j) => j === i ? { ...q, [field]: val } : q));
  }
  function add()       { setQuestions(qs => [...qs, { question: '', hint: '', minWords: '' }]); }
  function remove(i: number) { if (questions.length > 1) setQuestions(qs => qs.filter((_, j) => j !== i)); }

  const canSave = questions.every(q => q.question.trim());
  function commit() {
    onCommit({
      questions: questions.map(q => ({
        question: q.question,
        hint:     q.hint || undefined,
        minWords: q.minWords ? parseInt(q.minWords) : undefined,
      })),
    });
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Question {i + 1}</span>
            {questions.length > 1 && (
              <button type="button" onClick={() => remove(i)} className={btnDanger}>Remove</button>
            )}
          </div>
          <textarea className={inputCls + ' h-16'} placeholder="Question prompt..."
            value={q.question} onChange={e => update(i, 'question', e.target.value)} />
          <input className={inputCls} placeholder="Hint or guidance (optional)"
            value={q.hint} onChange={e => update(i, 'hint', e.target.value)} />
          <input className={inputCls} type="number" placeholder="Minimum word count (optional)"
            value={q.minWords} onChange={e => update(i, 'minWords', e.target.value)} />
        </div>
      ))}
      <button type="button" onClick={add} className={btnGhost}>+ Add question</button>
      <SaveBtn disabled={!canSave || saving} onClick={commit} saving={saving} />
    </div>
  );
}

function ChoiceForm({ multi, onCommit, saving, initialBody }: FormProps & { multi: boolean }) {
  const [question, setQuestion] = useState(initialBody?.question as string ?? '');
  const initOpts = (initialBody?.options as string[]) ?? ['', ''];
  const [options, setOptions]   = useState(initOpts.length ? initOpts : ['', '']);
  const initCorrect = multi
    ? (initialBody?.correctIndices as number[] ?? [])
    : (initialBody?.correctIndex !== undefined ? [initialBody.correctIndex as number] : []);
  const [correct, setCorrect]   = useState<number[]>(initCorrect);
  const initHasCorrect = multi ? initCorrect.length > 0 : initialBody?.correctIndex !== undefined;
  const [hasCorrect, setHasCorrect] = useState(!!initHasCorrect);

  function setOption(i: number, val: string) { setOptions(p => p.map((o, j) => j === i ? val : o)); }
  function addOption()       { setOptions(p => [...p, '']); }
  function removeOption(i: number) {
    setOptions(p => p.filter((_, j) => j !== i));
    setCorrect(p => p.filter(c => c !== i).map(c => c > i ? c - 1 : c));
  }
  function toggleCorrect(i: number) {
    setCorrect(multi ? (p => p.includes(i) ? p.filter(c => c !== i) : [...p, i]) : [i]);
  }

  const filled = options.filter(o => o.trim());
  const canSave = question.trim() && filled.length >= 2 && (!hasCorrect || correct.length > 0);

  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Question..."
        value={question} onChange={e => setQuestion(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input type="checkbox" checked={hasCorrect} onChange={() => { setHasCorrect(h => !h); setCorrect([]); }} />
        This question has a correct answer
      </label>
      {hasCorrect && (
        <p className="text-xs text-gray-500">{multi ? 'Check all correct answers.' : 'Select the one correct answer.'}</p>
      )}
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ' +
            (hasCorrect && correct.includes(i) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200')}>
            {hasCorrect && (
              <input type={multi ? 'checkbox' : 'radio'} name="correct"
                checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="shrink-0" />
            )}
            <input className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
              placeholder={'Option ' + (i + 1)} value={opt} onChange={e => setOption(i, e.target.value)} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className={btnDanger}>x</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className={btnGhost}>+ Add option</button>
      <SaveBtn disabled={!canSave || saving}
        onClick={() => onCommit({
          question,
          options: filled,
          ...(hasCorrect ? { [multi ? 'correctIndices' : 'correctIndex']: multi ? correct : correct[0] } : {}),
        })} saving={saving} />
    </div>
  );
}

function MatchForm({ onCommit, saving, initialBody }: FormProps) {
  const initPairs = (initialBody?.pairs as { left: string; right: string }[]) ?? [{ left: '', right: '' }, { left: '', right: '' }];
  const [instruction, setInstruction] = useState(initialBody?.instruction as string ?? '');
  const [pairs, setPairs]             = useState(initPairs);

  function setPair(i: number, side: 'left'|'right', val: string) {
    setPairs(p => p.map((x, j) => j === i ? { ...x, [side]: val } : x));
  }
  const valid = pairs.filter(p => p.left.trim() && p.right.trim());

  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Instruction (optional)"
        value={instruction} onChange={e => setInstruction(e.target.value)} />
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={smallInputCls + ' flex-1'} placeholder="Left item"
              value={p.left} onChange={e => setPair(i, 'left', e.target.value)} />
            <span className="text-gray-400 text-sm">↔</span>
            <input className={smallInputCls + ' flex-1'} placeholder="Right item"
              value={p.right} onChange={e => setPair(i, 'right', e.target.value)} />
            {pairs.length > 2 && (
              <button type="button" onClick={() => setPairs(p => p.filter((_, j) => j !== i))} className={btnDanger}>x</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPairs(p => [...p, { left: '', right: '' }])} className={btnGhost}>+ Add pair</button>
      <SaveBtn disabled={valid.length < 2 || saving}
        onClick={() => onCommit({ instruction: instruction || undefined, pairs: valid })} saving={saving} />
    </div>
  );
}

function RatingForm({ onCommit, saving, initialBody }: FormProps) {
  const [question, setQuestion] = useState(initialBody?.question as string ?? '');
  const [scale, setScale]       = useState<5|10>((initialBody?.scale as 5|10) ?? 5);
  const [low, setLow]           = useState(initialBody?.lowLabel as string ?? '');
  const [high, setHigh]         = useState(initialBody?.highLabel as string ?? '');
  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Rating question..."
        value={question} onChange={e => setQuestion(e.target.value)} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Scale:</span>
        {([5, 10] as const).map(s => (
          <button key={s} type="button" onClick={() => setScale(s)}
            className={'px-3 py-1 rounded-full text-xs font-medium border transition-colors ' +
              (scale === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300')}>
            1-{s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={smallInputCls + ' flex-1'} placeholder="Low label (e.g. Strongly disagree)"
          value={low} onChange={e => setLow(e.target.value)} />
        <input className={smallInputCls + ' flex-1'} placeholder="High label (e.g. Strongly agree)"
          value={high} onChange={e => setHigh(e.target.value)} />
      </div>
      <SaveBtn disabled={!question.trim() || saving}
        onClick={() => onCommit({ question, scale, lowLabel: low || undefined, highLabel: high || undefined })}
        saving={saving} />
    </div>
  );
}

function AssignmentForm({ onCommit, saving, initialBody }: FormProps) {
  type SubItem = { type: SectionType; body: Record<string, unknown> };
  const [title,        setTitle]        = useState(initialBody?.title as string ?? '');
  const [instructions, setInstructions] = useState(initialBody?.instructions as string ?? '');
  const [items,        setItems]        = useState<SubItem[]>((initialBody?.items as SubItem[]) ?? []);
  const [addingType,   setAddingType]   = useState<SectionType | null>(null);

  const subTypes = (Object.keys(SECTION_LABELS) as SectionType[]).filter(t => t !== 'assignment');

  function addItem(type: SectionType, body: Record<string, unknown>) {
    setItems(prev => [...prev, { type, body }]);
    setAddingType(null);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subProps = (t: SectionType) => ({ onCommit: (b: Record<string, unknown>) => addItem(t, b), saving: false, initialBody: undefined });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input
          className={inputCls}
          placeholder="Assignment title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
        <textarea
          className={inputCls + ' h-28'}
          placeholder="Describe what the client needs to do…"
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
        />
      </div>
      {/* Sub-items list */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">Content Items</label>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
              <span className="text-xs font-mono text-gray-400 shrink-0">{SECTION_ICONS[item.type]}</span>
              <span className="text-sm text-gray-700 flex-1 truncate">
                {sectionLabel(item.type, item.body) || SECTION_LABELS[item.type]}
              </span>
              <button type="button" onClick={() => removeItem(i)} className={btnDanger}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sub-content builder */}
      {addingType === null ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Add Content</label>
          <div className="flex flex-wrap gap-2">
            {subTypes.map(t => (
              <button key={t} type="button" onClick={() => setAddingType(t)}
                className="flex items-center gap-1.5 border border-gray-200 bg-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-gray-700 transition-colors">
                <span className="text-xs font-mono text-gray-400">{SECTION_ICONS[t]}</span>
                {SECTION_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-indigo-200 rounded-xl bg-indigo-50/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-700">{SECTION_LABELS[addingType]}</span>
            <button type="button" onClick={() => setAddingType(null)} className="text-xs text-gray-400 hover:text-gray-600">x Cancel</button>
          </div>
          {addingType === 'text'            && <TextForm           {...subProps('text')} />}
          {addingType === 'video'           && <VideoForm          {...subProps('video')} />}
          {addingType === 'long_form_qa'    && <LongFormQAForm     {...subProps('long_form_qa')} />}
          {addingType === 'single_choice'   && <ChoiceForm multi={false} {...subProps('single_choice')} />}
          {addingType === 'multi_choice'    && <ChoiceForm multi={true}  {...subProps('multi_choice')} />}
          {addingType === 'match_following' && <MatchForm          {...subProps('match_following')} />}
          {addingType === 'rating'          && <RatingForm         {...subProps('rating')} />}
          {addingType === 'image_embed'     && <ImageEmbedForm     {...subProps('image_embed')} />}
          {addingType === 'file'            && <FileUploadForm     {...subProps('file')} />}
        </div>
      )}

      <SaveBtn
        disabled={!title.trim() || !instructions.trim() || saving}
        onClick={() => onCommit({
          title: title.trim(),
          instructions: instructions.trim(),
          items,
        })}
        saving={saving}
      />
    </div>
  );
}

function FileUploadForm({ onCommit, saving, initialBody }: FormProps) {
  const [file, setFile]                 = useState<File | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadedUrl, setUploadedUrl]   = useState(initialBody?.fileUrl as string ?? '');
  const [uploadedName, setUploadedName] = useState(initialBody?.fileName as string ?? '');
  const [error, setError]               = useState('');

  async function upload() {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await r.json() as { url?: string; error?: string };
      if (!r.ok || !data.url) { setError(data.error ?? 'Upload failed'); return; }
      setUploadedUrl(data.url);
      setUploadedName(file.name);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      {uploadedUrl ? (
        <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-green-800">{uploadedName}</p>
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline">Preview</a>
          </div>
          <button type="button" onClick={() => { setUploadedUrl(''); setUploadedName(''); setFile(null); }}
            className={btnGhost + ' text-xs'}>Change</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="file"
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border file:border-gray-200 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-indigo-50"
            title="Choose file to upload"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file && (
            <button type="button" onClick={upload} disabled={uploading} className={btnSecondary + ' text-sm'}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
      <SaveBtn disabled={!uploadedUrl || saving}
        onClick={() => onCommit({ fileUrl: uploadedUrl, fileName: uploadedName })} saving={saving} />
    </div>
  );
}

// -- SectionBuilder (default export) ------------------------------------------

export default function SectionBuilder({ onSave, compact = false, editSection, callAction }: SectionBuilderProps) {
  const [active, setActive] = useState<SectionType | null>(editSection?.contentType ?? null);
  const [saving, setSaving] = useState(false);

  async function commit(type: SectionType, body: Record<string, unknown>) {
    setSaving(true);
    try { await onSave(type, body); if (!editSection) setActive(null); }
    finally { setSaving(false); }
  }

  if (!active) {
    return (
      <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2 mt-2'}>
        {(Object.keys(SECTION_LABELS) as SectionType[]).map(t => (
          <button key={t} type="button" onClick={() => setActive(t)}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-gray-700 transition-colors">
            <span className="text-xs font-mono text-gray-400">{SECTION_ICONS[t]}</span>
            {SECTION_LABELS[t]}
          </button>
        ))}
      </div>
    );
  }

  const commonProps = {
    onCommit:    (b: Record<string, unknown>) => commit(active, b),
    saving,
    initialBody: editSection?.contentType === active ? editSection.body : undefined,
    callAction,
  };

  return (
    <div className="border border-indigo-200 rounded-xl bg-white p-5 mt-2 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-700">
          {SECTION_LABELS[active]}
        </span>
        {!editSection && (
          <button type="button" onClick={() => setActive(null)}
            className="text-xs text-gray-400 hover:text-gray-600">
            x Cancel
          </button>
        )}
      </div>
      {active === 'text'            && <TextForm           {...commonProps} />}
      {active === 'video'           && <VideoForm          {...commonProps} />}
      {active === 'long_form_qa'    && <LongFormQAForm     {...commonProps} />}
      {active === 'single_choice'   && <ChoiceForm  multi={false} {...commonProps} />}
      {active === 'multi_choice'    && <ChoiceForm  multi={true}  {...commonProps} />}
      {active === 'match_following' && <MatchForm          {...commonProps} />}
      {active === 'rating'          && <RatingForm         {...commonProps} />}
      {active === 'image_embed'     && <ImageEmbedForm     {...commonProps} />}
      {active === 'file'            && <FileUploadForm     {...commonProps} />}
      {active === 'assignment'      && <AssignmentForm     {...commonProps} />}
    </div>
  );
}
