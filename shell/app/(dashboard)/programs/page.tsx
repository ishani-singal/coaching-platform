'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/components/SessionProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab        = 'modules' | 'programs' | 'packages' | 'clients';
type PeriodType = 'week' | 'day' | 'month' | 'quarter' | 'custom';
type ProgramMode = 'flat' | 'timeline';
type SectionType = 'text' | 'video' | 'long_form_qa' | 'single_choice' | 'multi_choice'
                 | 'match_following' | 'rating' | 'assignment';
type BlockType   = 'text_block' | 'image_embed' | 'video_embed' | 'long_form_qa'
                 | 'single_choice' | 'multi_choice' | 'match_following' | 'rating'
                 | 'photo_upload' | 'video_upload' | 'image_question';

interface ModuleRecord {
  moduleId: string;
  title: string;
  category: string;
  isPublished: boolean;
  sourceProgramId?: string;
}

interface ProgramRecord {
  programId: string;
  title: string;
  isPublished: boolean;
  periods?: { periodId: string; label: string; periodType: PeriodType }[];
}

interface ProgramModuleInfo {
  moduleId: string;
  title: string;
  category: string;
  periodLabel?: string;
}

interface ClientProfile { clientId: string; name: string; email: string; }

interface SectionDraft {
  id: string;
  contentType: SectionType;
  body: Record<string, unknown>;
  label: string;
}

interface InlineModuleEntry {
  title: string;
  category: string;
  sections: SectionDraft[];
  showBuilder: boolean;
}

interface PeriodRow {
  label: string;
  periodType: PeriodType;
  selectedModuleIds: string[];
  inlineModules: InlineModuleEntry[];
}

interface BlockDraft { id: string; type: BlockType; [key: string]: unknown; }

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week', day: 'Day', month: 'Month', quarter: 'Quarter', custom: 'Period',
};

const CATEGORIES = ['mindset','nutrition','fitness','business','leadership','wellness','productivity'];

const SECTION_LABELS: Record<SectionType, string> = {
  text: 'Description', video: 'Video', long_form_qa: 'Written Q&A',
  single_choice: 'Single Choice', multi_choice: 'Multiple Choice',
  match_following: 'Match the Following', rating: 'Rating', assignment: 'Assignment',
};

const BLOCK_LABELS: Record<BlockType, string> = {
  text_block: 'Text Block', image_embed: 'Image', video_embed: 'Video',
  long_form_qa: 'Written Answer', single_choice: 'Single Choice',
  multi_choice: 'Multiple Choice', match_following: 'Match the Following',
  rating: 'Rating', photo_upload: 'Photo Upload Request',
  video_upload: 'Video Upload Request', image_question: 'Image + Question',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmbedUrl(url: string) {
  return url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/');
}

function sectionLabel(type: SectionType, body: Record<string, unknown>): string {
  switch (type) {
    case 'text':   return `Description: "${String(body.content ?? '').slice(0, 40)}"`;
    case 'video':  return `Video: ${body.caption || body.embedUrl}`;
    case 'long_form_qa': {
      const qs = body.questions as {question:string}[] | undefined;
      return qs ? `Q&A: ${qs.length} question${qs.length > 1 ? 's' : ''}` : 'Q&A';
    }
    case 'single_choice':   return `Single choice: "${body.question}"`;
    case 'multi_choice':    return `Multi choice: "${body.question}"`;
    case 'match_following': return `Match: ${(body.pairs as unknown[])?.length ?? 0} pairs`;
    case 'rating':          return `Rating: "${body.question}"`;
    case 'assignment':      return `Assignment: ${(body.items as unknown[])?.length ?? 0} item(s)`;
  }
}

function blockSummary(b: BlockDraft): string {
  switch (b.type) {
    case 'text_block':      return `Text: "${String(b.content ?? '').slice(0, 40)}"`;
    case 'image_embed':     return `Image: ${b.imageUrl}`;
    case 'video_embed':     return `Video: ${b.caption || b.embedUrl}`;
    case 'long_form_qa':    return `Written answer: "${b.question}"`;
    case 'single_choice':   return `Single choice: "${b.question}"`;
    case 'multi_choice':    return `Multiple choice: "${b.question}"`;
    case 'match_following': return `Match: ${(b.pairs as unknown[])?.length ?? 0} pairs`;
    case 'rating':          return `Rating: "${b.question}"`;
    case 'photo_upload':    return `Photo upload: "${b.prompt}"`;
    case 'video_upload':    return `Video upload: "${b.prompt}"`;
    case 'image_question':  return `Image question: "${b.question}"`;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  const { userId } = useSession();
  const [tab, setTab] = useState<Tab>('modules');
  const [modules, setModules]   = useState<ModuleRecord[]>([]);
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [clients, setClients]   = useState<ClientProfile[]>([]);
  const [loading, setLoading]   = useState(false);

  const callAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    });
    return res.json();
  }, [userId]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [modRes, progRes, clientRes] = await Promise.all([
        callAction('list_modules', {}),
        callAction('list_programs', {}),
        fetch('/api/agents/coaching-crm/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, config: {}, action: 'get_client_list', params: {} }),
        }).then(r => r.json()).catch(() => ({ data: { active: [] } })),
      ]);
      if (modRes.success)  setModules(modRes.data?.modules ?? []);
      if (progRes.success) setPrograms(progRes.data?.programs ?? []);
      setClients([
        ...(clientRes?.data?.active ?? []),
        ...(clientRes?.data?.prospect ?? []),
        ...(clientRes?.data?.completed ?? []),
      ]);
    } finally { setLoading(false); }
  }, [userId, callAction]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Program Builder</h1>
      {loading && <p className="text-sm text-gray-400 mb-4">Loading…</p>}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['modules','programs','packages','clients'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'modules'  && <ModulesTab  modules={modules}   callAction={callAction} onRefresh={loadAll} />}
      {tab === 'programs' && <ProgramsTab modules={modules} programs={programs} callAction={callAction} onRefresh={loadAll} />}
      {tab === 'packages' && <PackagesTab programs={programs} callAction={callAction} onRefresh={loadAll} />}
      {tab === 'clients'  && <ClientsTab  clients={clients}  modules={modules} callAction={callAction} />}
    </div>
  );
}

// ── Shared: SaveBtn ───────────────────────────────────────────────────────────

function SaveBtn({ disabled, onClick, saving, label = 'Save Section' }: {
  disabled: boolean; onClick: () => void; saving: boolean; label?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50">
      {saving ? 'Saving…' : label}
    </button>
  );
}

// ── Section Builder ───────────────────────────────────────────────────────────

function SectionBuilder({ onSave, compact = false }: {
  onSave: (type: SectionType, body: Record<string, unknown>) => Promise<void>;
  compact?: boolean;
}) {
  const [active, setActive] = useState<SectionType | null>(null);
  const [saving, setSaving] = useState(false);

  async function commit(type: SectionType, body: Record<string, unknown>) {
    setSaving(true);
    try { await onSave(type, body); setActive(null); }
    finally { setSaving(false); }
  }

  if (!active) {
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-2'}`}>
        {(Object.keys(SECTION_LABELS) as SectionType[]).map(t => (
          <button key={t} type="button" onClick={() => setActive(t)}
            className="border bg-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-gray-700">
            + {SECTION_LABELS[t]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-indigo-200 rounded-lg bg-white p-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-indigo-700">{SECTION_LABELS[active]}</span>
        <button type="button" onClick={() => setActive(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
      </div>
      {active === 'text'            && <TextForm           onCommit={b => commit('text', b)} saving={saving} />}
      {active === 'video'           && <VideoForm          onCommit={b => commit('video', b)} saving={saving} />}
      {active === 'long_form_qa'    && <LongFormQAForm     onCommit={b => commit('long_form_qa', b)} saving={saving} />}
      {active === 'single_choice'   && <ChoiceForm multi={false} onCommit={b => commit('single_choice', b)} saving={saving} />}
      {active === 'multi_choice'    && <ChoiceForm multi={true}  onCommit={b => commit('multi_choice', b)} saving={saving} />}
      {active === 'match_following' && <MatchForm          onCommit={b => commit('match_following', b)} saving={saving} />}
      {active === 'rating'          && <RatingForm         onCommit={b => commit('rating', b)} saving={saving} />}
      {active === 'assignment'      && <AssignmentForm     onCommit={b => commit('assignment', b)} saving={saving} />}
    </div>
  );
}

// ── Section type forms ────────────────────────────────────────────────────────

function TextForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [content, setContent] = useState('');
  return (
    <div className="space-y-2">
      <textarea className="w-full border rounded px-3 py-2 text-sm h-28" placeholder="Description or text content…" value={content} onChange={e => setContent(e.target.value)} />
      <SaveBtn disabled={!content.trim() || saving} onClick={() => onCommit({ content })} saving={saving} />
    </div>
  );
}

function VideoForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [embedUrl, setEmbedUrl] = useState('');
  const [caption, setCaption]   = useState('');
  const [warn, setWarn]         = useState('');
  function onChange(val: string) {
    setEmbedUrl(val);
    setWarn(val && !isValidEmbedUrl(val) ? 'Use an embed URL: youtube.com/embed/… or player.vimeo.com/video/…' : '');
  }
  return (
    <div className="space-y-2">
      <div>
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="YouTube or Vimeo embed URL" value={embedUrl} onChange={e => onChange(e.target.value)} />
        {warn && <p className="text-xs text-amber-600 mt-1">{warn}</p>}
      </div>
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
      <SaveBtn disabled={!embedUrl || !!warn || saving} onClick={() => onCommit({ embedUrl, caption: caption || undefined })} saving={saving} />
    </div>
  );
}

function LongFormQAForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [questions, setQuestions] = useState([{ question: '', hint: '', minWords: '' }]);

  function update(i: number, field: 'question' | 'hint' | 'minWords', val: string) {
    setQuestions(qs => qs.map((q, j) => j === i ? { ...q, [field]: val } : q));
  }
  function add()       { setQuestions(qs => [...qs, { question: '', hint: '', minWords: '' }]); }
  function remove(i: number) { if (questions.length > 1) setQuestions(qs => qs.filter((_, j) => j !== i)); }

  const canSave = questions.every(q => q.question.trim());
  function commit() {
    onCommit({
      questions: questions.map(q => ({
        question: q.question,
        hint:     q.hint     || undefined,
        minWords: q.minWords ? parseInt(q.minWords) : undefined,
      })),
    });
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Question {i + 1}</span>
            {questions.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            )}
          </div>
          <textarea className="w-full border rounded px-3 py-2 text-sm h-16" placeholder="Question prompt…" value={q.question} onChange={e => update(i, 'question', e.target.value)} />
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Hint or guidance (optional)" value={q.hint} onChange={e => update(i, 'hint', e.target.value)} />
          <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="Minimum word count (optional)" value={q.minWords} onChange={e => update(i, 'minWords', e.target.value)} />
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-indigo-600 hover:underline">+ Add another question</button>
      <SaveBtn disabled={!canSave || saving} onClick={commit} saving={saving} />
    </div>
  );
}

function ChoiceForm({ multi, onCommit, saving }: { multi: boolean; onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions]   = useState(['', '']);
  const [correct, setCorrect]   = useState<number[]>([]);

  function setOption(i: number, val: string) { setOptions(p => p.map((o, j) => j === i ? val : o)); }
  function addOption()      { setOptions(p => [...p, '']); }
  function removeOption(i: number) {
    setOptions(p => p.filter((_, j) => j !== i));
    setCorrect(p => p.filter(c => c !== i).map(c => c > i ? c - 1 : c));
  }
  function toggleCorrect(i: number) {
    setCorrect(multi ? (p => p.includes(i) ? p.filter(c => c !== i) : [...p, i]) : [i]);
  }

  const filled = options.filter(o => o.trim());
  const canSave = question.trim() && filled.length >= 2 && correct.length > 0;

  return (
    <div className="space-y-3">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Question…" value={question} onChange={e => setQuestion(e.target.value)} />
      <p className="text-xs text-gray-500">{multi ? 'Check all correct answers.' : 'Select the one correct answer.'}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type={multi ? 'checkbox' : 'radio'} name="correct" checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="shrink-0" />
            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder={`Option ${i + 1}`} value={opt} onChange={e => setOption(i, e.target.value)} />
            {options.length > 2 && <button type="button" onClick={() => removeOption(i)} className="text-xs text-red-400 hover:text-red-600">✕</button>}
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="text-xs text-indigo-600 hover:underline">+ Add option</button>
      <SaveBtn disabled={!canSave || saving}
        onClick={() => onCommit({ question, options: filled, [multi ? 'correctIndices' : 'correctIndex']: multi ? correct : correct[0] })}
        saving={saving} />
    </div>
  );
}

function MatchForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [instruction, setInstruction] = useState('');
  const [pairs, setPairs] = useState([{ left: '', right: '' }, { left: '', right: '' }]);
  function setPair(i: number, side: 'left' | 'right', val: string) {
    setPairs(p => p.map((x, j) => j === i ? { ...x, [side]: val } : x));
  }
  const valid = pairs.filter(p => p.left.trim() && p.right.trim());
  return (
    <div className="space-y-3">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Instruction (optional)" value={instruction} onChange={e => setInstruction(e.target.value)} />
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Left item" value={p.left} onChange={e => setPair(i, 'left', e.target.value)} />
            <span className="text-gray-400">↔</span>
            <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Right item" value={p.right} onChange={e => setPair(i, 'right', e.target.value)} />
            {pairs.length > 2 && <button type="button" onClick={() => setPairs(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-600">✕</button>}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPairs(p => [...p, { left: '', right: '' }])} className="text-xs text-indigo-600 hover:underline">+ Add pair</button>
      <SaveBtn disabled={valid.length < 2 || saving} onClick={() => onCommit({ instruction: instruction || undefined, pairs: valid })} saving={saving} />
    </div>
  );
}

function RatingForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [question, setQuestion] = useState('');
  const [scale, setScale]       = useState<5 | 10>(5);
  const [low, setLow]           = useState('');
  const [high, setHigh]         = useState('');
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Rating question…" value={question} onChange={e => setQuestion(e.target.value)} />
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Scale:</span>
        {([5, 10] as const).map(s => (
          <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="radio" checked={scale === s} onChange={() => setScale(s)} /> 1–{s}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 text-sm flex-1" placeholder={`Low label`} value={low} onChange={e => setLow(e.target.value)} />
        <input className="border rounded px-2 py-1 text-sm flex-1" placeholder={`High label`} value={high} onChange={e => setHigh(e.target.value)} />
      </div>
      <SaveBtn disabled={!question.trim() || saving}
        onClick={() => onCommit({ question, scale, lowLabel: low || undefined, highLabel: high || undefined })}
        saving={saving} />
    </div>
  );
}

// ── Assignment Builder ────────────────────────────────────────────────────────

function AssignmentForm({ onCommit, saving }: { onCommit: (b: Record<string, unknown>) => void; saving: boolean }) {
  const [title, setTitle]           = useState('');
  const [instructions, setInstr]    = useState('');
  const [blocks, setBlocks]         = useState<BlockDraft[]>([]);
  const [addingType, setAddingType] = useState<BlockType | null>(null);

  function addBlock(type: BlockType, data: Record<string, unknown>) {
    setBlocks(p => [...p, { id: Date.now().toString(), type, ...data }]);
    setAddingType(null);
  }
  function removeBlock(id: string) { setBlocks(p => p.filter(b => b.id !== id)); }

  function commit() {
    const items = blocks.map(({ id, ...rest }) => rest);
    onCommit({ title: title || undefined, instructions: instructions || undefined, items });
  }

  return (
    <div className="space-y-4">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Assignment title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="w-full border rounded px-3 py-2 text-sm h-16" placeholder="Overall instructions (optional)" value={instructions} onChange={e => setInstr(e.target.value)} />

      {/* Block list */}
      {blocks.length > 0 && (
        <div className="space-y-1">
          {blocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between bg-gray-50 border rounded px-3 py-2 text-sm">
              <span className="text-gray-600"><span className="text-gray-400 mr-2">{i + 1}.</span>{blockSummary(b)}</span>
              <button type="button" onClick={() => removeBlock(b.id)} className="text-xs text-red-400 hover:text-red-600 ml-3">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add a block */}
      {addingType ? (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700">{BLOCK_LABELS[addingType]}</span>
            <button type="button" onClick={() => setAddingType(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
          </div>
          <BlockForm type={addingType} onAdd={(data) => addBlock(addingType, data)} />
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2">Add a block:</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map(t => (
              <button key={t} type="button" onClick={() => setAddingType(t)}
                className="border bg-white text-xs px-2.5 py-1.5 rounded hover:bg-indigo-50 hover:border-indigo-300 text-gray-700">
                + {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      <SaveBtn disabled={!blocks.length || saving} onClick={commit} saving={saving} label="Save Assignment" />
    </div>
  );
}

// ── Block forms (used inside AssignmentForm) ──────────────────────────────────

function BlockForm({ type, onAdd }: { type: BlockType; onAdd: (data: Record<string, unknown>) => void }) {
  switch (type) {
    case 'text_block':      return <BlockTextForm onAdd={onAdd} />;
    case 'image_embed':     return <BlockImageForm onAdd={onAdd} />;
    case 'video_embed':     return <BlockVideoForm onAdd={onAdd} />;
    case 'long_form_qa':    return <BlockLongFormQA onAdd={onAdd} />;
    case 'single_choice':   return <BlockChoice multi={false} onAdd={onAdd} />;
    case 'multi_choice':    return <BlockChoice multi={true}  onAdd={onAdd} />;
    case 'match_following': return <BlockMatch onAdd={onAdd} />;
    case 'rating':          return <BlockRating onAdd={onAdd} />;
    case 'photo_upload':    return <BlockUpload mediaType="photo" onAdd={onAdd} />;
    case 'video_upload':    return <BlockUpload mediaType="video" onAdd={onAdd} />;
    case 'image_question':  return <BlockImageQuestion onAdd={onAdd} />;
  }
}

function AddBtn({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">Add Block</button>;
}

function BlockTextForm({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [content, setContent] = useState('');
  return (
    <div className="space-y-2">
      <textarea className="w-full border rounded px-3 py-2 text-sm h-20" placeholder="Text content…" value={content} onChange={e => setContent(e.target.value)} />
      <AddBtn disabled={!content.trim()} onClick={() => onAdd({ content })} />
    </div>
  );
}

function BlockImageForm({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption]   = useState('');
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Image URL (publicly accessible, e.g. Imgur, Google Drive)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
      <AddBtn disabled={!imageUrl.trim()} onClick={() => onAdd({ imageUrl, caption: caption || undefined })} />
    </div>
  );
}

function BlockVideoForm({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [embedUrl, setEmbedUrl] = useState('');
  const [caption, setCaption]   = useState('');
  const [warn, setWarn]         = useState('');
  function onChange(val: string) {
    setEmbedUrl(val);
    setWarn(val && !isValidEmbedUrl(val) ? 'Use an embed URL: youtube.com/embed/… or player.vimeo.com/video/…' : '');
  }
  return (
    <div className="space-y-2">
      <div>
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="YouTube or Vimeo embed URL" value={embedUrl} onChange={e => onChange(e.target.value)} />
        {warn && <p className="text-xs text-amber-600 mt-1">{warn}</p>}
      </div>
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
      <AddBtn disabled={!embedUrl || !!warn} onClick={() => onAdd({ embedUrl, caption: caption || undefined })} />
    </div>
  );
}

function BlockLongFormQA({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [question, setQ] = useState('');
  const [hint, setHint]  = useState('');
  const [min, setMin]    = useState('');
  return (
    <div className="space-y-2">
      <textarea className="w-full border rounded px-3 py-2 text-sm h-16" placeholder="Question prompt…" value={question} onChange={e => setQ(e.target.value)} />
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Hint (optional)" value={hint} onChange={e => setHint(e.target.value)} />
      <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="Min word count (optional)" value={min} onChange={e => setMin(e.target.value)} />
      <AddBtn disabled={!question.trim()} onClick={() => onAdd({ question, hint: hint || undefined, minWords: min ? parseInt(min) : undefined })} />
    </div>
  );
}

function BlockChoice({ multi, onAdd }: { multi: boolean; onAdd: (d: Record<string, unknown>) => void }) {
  const [question, setQ]  = useState('');
  const [options, setOpts] = useState(['', '']);
  const [correct, setC]    = useState<number[]>([]);
  function setOpt(i: number, v: string) { setOpts(p => p.map((o, j) => j === i ? v : o)); }
  function toggle(i: number) { setC(multi ? (p => p.includes(i) ? p.filter(c => c !== i) : [...p, i]) : [i]); }
  const filled = options.filter(o => o.trim());
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Question…" value={question} onChange={e => setQ(e.target.value)} />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type={multi ? 'checkbox' : 'radio'} name={`bc-${multi}`} checked={correct.includes(i)} onChange={() => toggle(i)} className="shrink-0" />
          <input className="border rounded px-2 py-1 text-sm flex-1" placeholder={`Option ${i + 1}`} value={opt} onChange={e => setOpt(i, e.target.value)} />
          {options.length > 2 && <button type="button" onClick={() => setOpts(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400">✕</button>}
        </div>
      ))}
      <button type="button" onClick={() => setOpts(p => [...p, ''])} className="text-xs text-indigo-600 hover:underline">+ Option</button>
      <AddBtn disabled={!question.trim() || filled.length < 2 || !correct.length}
        onClick={() => onAdd({ question, options: filled, [multi ? 'correctIndices' : 'correctIndex']: multi ? correct : correct[0] })} />
    </div>
  );
}

function BlockMatch({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [instr, setInstr] = useState('');
  const [pairs, setPairs] = useState([{ left: '', right: '' }, { left: '', right: '' }]);
  function set(i: number, side: 'left'|'right', v: string) { setPairs(p => p.map((x, j) => j === i ? { ...x, [side]: v } : x)); }
  const valid = pairs.filter(p => p.left.trim() && p.right.trim());
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Instruction (optional)" value={instr} onChange={e => setInstr(e.target.value)} />
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Left" value={p.left} onChange={e => set(i, 'left', e.target.value)} />
          <span className="text-gray-400">↔</span>
          <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Right" value={p.right} onChange={e => set(i, 'right', e.target.value)} />
          {pairs.length > 2 && <button type="button" onClick={() => setPairs(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400">✕</button>}
        </div>
      ))}
      <button type="button" onClick={() => setPairs(p => [...p, { left: '', right: '' }])} className="text-xs text-indigo-600 hover:underline">+ Pair</button>
      <AddBtn disabled={valid.length < 2} onClick={() => onAdd({ instruction: instr || undefined, pairs: valid })} />
    </div>
  );
}

function BlockRating({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [q, setQ]       = useState('');
  const [scale, setS]   = useState<5|10>(5);
  const [low, setLow]   = useState('');
  const [high, setHigh] = useState('');
  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Rating question…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex items-center gap-3">
        {([5, 10] as const).map(s => (
          <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="radio" checked={scale === s} onChange={() => setS(s)} /> 1–{s}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Low label" value={low} onChange={e => setLow(e.target.value)} />
        <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="High label" value={high} onChange={e => setHigh(e.target.value)} />
      </div>
      <AddBtn disabled={!q.trim()} onClick={() => onAdd({ question: q, scale, lowLabel: low || undefined, highLabel: high || undefined })} />
    </div>
  );
}

function BlockUpload({ mediaType, onAdd }: { mediaType: 'photo' | 'video'; onAdd: (d: Record<string, unknown>) => void }) {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">The assignment taker will be prompted to upload a {mediaType}.</p>
      <textarea className="w-full border rounded px-3 py-2 text-sm h-16" placeholder={`Describe what ${mediaType} to upload…`} value={prompt} onChange={e => setPrompt(e.target.value)} />
      <AddBtn disabled={!prompt.trim()} onClick={() => onAdd({ prompt })} />
    </div>
  );
}

function BlockImageQuestion({ onAdd }: { onAdd: (d: Record<string, unknown>) => void }) {
  const [imageUrl, setImageUrl]   = useState('');
  const [question, setQ]          = useState('');
  const [answerType, setAnsType]  = useState<'long_form' | 'single_choice' | 'multi_choice'>('long_form');
  const [options, setOptions]     = useState(['', '']);
  const [correct, setCorrect]     = useState<number[]>([]);

  function setOpt(i: number, v: string) { setOptions(p => p.map((o, j) => j === i ? v : o)); }
  function toggleC(i: number) {
    const multi = answerType === 'multi_choice';
    setCorrect(multi ? (p => p.includes(i) ? p.filter(c => c !== i) : [...p, i]) : [i]);
  }
  const filled = options.filter(o => o.trim());
  const choiceOk = answerType === 'long_form' || (filled.length >= 2 && correct.length > 0);
  const canAdd = imageUrl.trim() && question.trim() && choiceOk;

  function commit() {
    const base: Record<string, unknown> = { imageUrl, question, answerType };
    if (answerType !== 'long_form') {
      base.options = filled;
      if (answerType === 'single_choice') base.correctIndex = correct[0];
      else base.correctIndices = correct;
    }
    onAdd(base);
  }

  return (
    <div className="space-y-2">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Image URL (publicly accessible)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      {imageUrl && <img src={imageUrl} alt="preview" className="max-h-32 rounded border object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Question about the image…" value={question} onChange={e => setQ(e.target.value)} />
      <select className="w-full border rounded px-3 py-2 text-sm" value={answerType} onChange={e => setAnsType(e.target.value as typeof answerType)}>
        <option value="long_form">Written answer</option>
        <option value="single_choice">Single choice</option>
        <option value="multi_choice">Multiple choice</option>
      </select>
      {answerType !== 'long_form' && (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type={answerType === 'single_choice' ? 'radio' : 'checkbox'} name="iq-correct" checked={correct.includes(i)} onChange={() => toggleC(i)} className="shrink-0" />
              <input className="border rounded px-2 py-1 text-sm flex-1" placeholder={`Option ${i + 1}`} value={opt} onChange={e => setOpt(i, e.target.value)} />
              {options.length > 2 && <button type="button" onClick={() => setOptions(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400">✕</button>}
            </div>
          ))}
          <button type="button" onClick={() => setOptions(p => [...p, ''])} className="text-xs text-indigo-600 hover:underline">+ Option</button>
        </div>
      )}
      <AddBtn disabled={!canAdd} onClick={commit} />
    </div>
  );
}

// ── Modules Tab ────────────────────────────────────────────────────────────────

function ModulesTab({ modules, callAction, onRefresh }: {
  modules: ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult]     = useState<string | null>(null);
  const [active, setActive]     = useState<{ moduleId: string; title: string; saved: string[] } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const r = await callAction('create_module', { title, category }) as { success: boolean; message: string; data?: { moduleId: string } };
    if (r.success && r.data) {
      setResult('✓ Module created — add content below');
      setActive({ moduleId: r.data.moduleId, title, saved: [] });
      setTitle(''); setCategory(''); onRefresh();
    } else {
      setResult('✗ ' + r.message);
    }
  }

  async function persistSection(type: SectionType, body: Record<string, unknown>) {
    if (!active) return;
    await callAction('add_section', { moduleId: active.moduleId, contentType: type, body, visibleTo: ['client'] });
    setActive(m => m ? { ...m, saved: [...m.saved, sectionLabel(type, body)] } : null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Create Module</h2>
        <form onSubmit={handleCreate} className="space-y-3 max-w-sm">
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
          <select className="w-full border rounded px-3 py-2 text-sm" value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="">Select category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Create</button>
          {result && <p className="text-sm text-green-700">{result}</p>}
        </form>
      </div>

      {active && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Add Content to "{active.title}"</h2>
            <button onClick={() => setActive(null)} className="text-sm text-gray-400 hover:text-gray-600">Done</button>
          </div>
          {active.saved.length > 0 && (
            <ul className="mb-3 space-y-1">{active.saved.map((l, i) => <li key={i} className="text-xs text-green-700">✓ {l}</li>)}</ul>
          )}
          <SectionBuilder onSave={persistSection} />
        </div>
      )}

      {modules.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Your Modules ({modules.length})</h2>
          <div className="space-y-2">
            {modules.map(m => (
              <div key={m.moduleId} className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{m.title}</span>
                  <span className="ml-2 text-gray-400">{m.category}</span>
                  {m.sourceProgramId && <span className="ml-2 text-xs text-indigo-400">inline</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isPublished ? 'published' : 'draft'}
                  </span>
                  <button onClick={() => setActive({ moduleId: m.moduleId, title: m.title, saved: [] })}
                    className="text-xs text-indigo-600 hover:underline">Add content</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Programs Tab ───────────────────────────────────────────────────────────────

function ProgramsTab({ modules, programs, callAction, onRefresh }: {
  modules: ModuleRecord[];
  programs: ProgramRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<ProgramMode>('flat');
  const [expandedModules, setExpanded]   = useState<Record<string, ProgramModuleInfo[]>>({});
  const [loadingProgram, setLoadingProg] = useState<string | null>(null);

  async function toggleProgram(programId: string) {
    if (expandedModules[programId]) {
      setExpanded(p => { const n = { ...p }; delete n[programId]; return n; });
      return;
    }
    setLoadingProg(programId);
    const r = await callAction('get_program_detail', { programId }) as {
      success: boolean;
      data?: {
        modules?: { moduleId: string; title: string; category: string }[];
        periods?: { label: string; modules?: { moduleId: string; title: string; category: string }[] }[];
      };
    };
    if (r.success && r.data) {
      const flat: ProgramModuleInfo[] = (r.data.modules ?? []).map(m => ({ ...m }));
      const fromPeriods: ProgramModuleInfo[] = (r.data.periods ?? []).flatMap(p =>
        (p.modules ?? []).map(m => ({ ...m, periodLabel: p.label }))
      );
      setExpanded(prev => ({ ...prev, [programId]: [...flat, ...fromPeriods] }));
    }
    setLoadingProg(null);
  }

  async function removeModule(programId: string, moduleId: string) {
    await callAction('remove_module_from_program', { programId, moduleId });
    setExpanded(prev => ({
      ...prev,
      [programId]: (prev[programId] ?? []).filter(m => m.moduleId !== moduleId),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="font-semibold">Build Program</h2>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setMode('flat')} className={`px-3 py-1 rounded text-sm ${mode === 'flat' ? 'bg-white shadow text-indigo-700 font-medium' : 'text-gray-500'}`}>Flat</button>
            <button onClick={() => setMode('timeline')} className={`px-3 py-1 rounded text-sm ${mode === 'timeline' ? 'bg-white shadow text-indigo-700 font-medium' : 'text-gray-500'}`}>Timeline</button>
          </div>
        </div>
        {mode === 'flat'     && <FlatProgramForm     modules={modules} callAction={callAction} onRefresh={onRefresh} />}
        {mode === 'timeline' && <TimelineProgramForm modules={modules} callAction={callAction} onRefresh={onRefresh} />}
      </div>

      {programs.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Your Programs ({programs.length})</h2>
          <div className="space-y-2">
            {programs.map(pg => (
              <div key={pg.programId} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <button type="button" onClick={() => toggleProgram(pg.programId)} className="flex items-center gap-2 text-left hover:text-indigo-700">
                    <span className="text-gray-400 text-xs">{expandedModules[pg.programId] ? '▼' : '▶'}</span>
                    <span className="font-medium">{pg.title}</span>
                    {pg.periods && pg.periods.length > 0 && <span className="text-xs text-indigo-500">{pg.periods.length} periods</span>}
                    {loadingProgram === pg.programId && <span className="text-xs text-gray-400">Loading…</span>}
                  </button>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pg.isPublished ? 'published' : 'draft'}
                  </span>
                </div>

                {expandedModules[pg.programId] && (
                  <div className="border-t bg-gray-50 px-4 py-3 space-y-1">
                    {expandedModules[pg.programId].length === 0 && (
                      <p className="text-xs text-gray-400">No modules assigned.</p>
                    )}
                    {expandedModules[pg.programId].map(m => (
                      <div key={m.moduleId} className="flex items-center justify-between text-sm py-1">
                        <div>
                          <span>{m.title}</span>
                          <span className="ml-2 text-xs text-gray-400">{m.category}</span>
                          {m.periodLabel && <span className="ml-2 text-xs text-indigo-400">{m.periodLabel}</span>}
                        </div>
                        <button type="button"
                          onClick={() => removeModule(pg.programId, m.moduleId)}
                          className="text-xs text-red-400 hover:text-red-600 ml-4">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FlatProgramForm({ modules, callAction, onRefresh }: {
  modules: ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const [title, setTitle]           = useState('');
  const [selectedIds, setSelected]  = useState<string[]>([]);
  const [result, setResult]         = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) { setResult('✗ Select at least one module'); return; }
    const r = await callAction('build_program', { title, moduleIds: selectedIds }) as { success: boolean; message: string };
    setResult(r.success ? '✓ ' + r.message : '✗ ' + r.message);
    if (r.success) { setTitle(''); setSelected([]); onRefresh(); }
  }

  return (
    <form onSubmit={handle} className="space-y-4 max-w-md">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Program title" value={title} onChange={e => setTitle(e.target.value)} required />
      <div>
        <p className="text-xs text-gray-500 mb-2">Select modules:</p>
        {modules.length === 0 && <p className="text-xs text-gray-400">No modules yet — create some in the Modules tab.</p>}
        <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
          {modules.map(m => (
            <label key={m.moduleId} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
              <input type="checkbox" checked={selectedIds.includes(m.moduleId)} onChange={() => setSelected(p => p.includes(m.moduleId) ? p.filter(x => x !== m.moduleId) : [...p, m.moduleId])} />
              <span>{m.title}</span>
              <span className="text-gray-400 text-xs">{m.category}</span>
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Build Program</button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}

function TimelineProgramForm({ modules, callAction, onRefresh }: {
  modules: ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periods, setPeriods]       = useState<PeriodRow[]>([]);
  const [result, setResult]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  function addPeriod() {
    const num = periods.length + 1;
    setPeriods(p => [...p, { label: `${PERIOD_LABELS[periodType]} ${num}`, periodType, selectedModuleIds: [], inlineModules: [] }]);
  }

  function addInlineModule(pi: number) {
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: [...r.inlineModules, { title: '', category: '', sections: [], showBuilder: false }],
    }));
  }

  function updateInlineField(pi: number, mi: number, field: 'title' | 'category', val: string) {
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: r.inlineModules.map((m, j) => j !== mi ? m : { ...m, [field]: val }),
    }));
  }

  function toggleInlineBuilder(pi: number, mi: number) {
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: r.inlineModules.map((m, j) => j !== mi ? m : { ...m, showBuilder: !m.showBuilder }),
    }));
  }

  function addDraftSection(pi: number, mi: number, type: SectionType, body: Record<string, unknown>) {
    const draft: SectionDraft = { id: `${pi}-${mi}-${Date.now()}`, contentType: type, body, label: sectionLabel(type, body) };
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: r.inlineModules.map((m, j) => j !== mi ? m : { ...m, sections: [...m.sections, draft], showBuilder: false }),
    }));
  }

  function removeDraftSection(pi: number, mi: number, id: string) {
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: r.inlineModules.map((m, j) => j !== mi ? m : { ...m, sections: m.sections.filter(s => s.id !== id) }),
    }));
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!periods.length) { setResult('✗ Add at least one period'); return; }
    setSaving(true); setResult(null);
    try {
      const r = await callAction('build_program_with_periods', {
        title, description: description || undefined,
        periods: periods.map(p => ({ label: p.label, periodType: p.periodType, moduleIds: p.selectedModuleIds })),
      }) as { success: boolean; message: string; data?: { programId: string; periods?: { periodId: string }[] } };
      if (!r.success) { setResult('✗ ' + r.message); return; }

      const builtPeriods = r.data?.periods ?? [];
      for (let pi = 0; pi < periods.length; pi++) {
        const period = periods[pi];
        const serverPeriod = builtPeriods[pi];
        if (!serverPeriod) continue;
        const offset = period.selectedModuleIds.length;
        for (let mi = 0; mi < period.inlineModules.length; mi++) {
          const im = period.inlineModules[mi];
          if (!im.title || !im.category) continue;
          const modRes = await callAction('create_inline_module', {
            programId: r.data!.programId, periodId: serverPeriod.periodId,
            title: im.title, category: im.category, displayOrder: offset + mi,
          }) as { success: boolean; data?: { moduleId: string } };
          if (modRes.success && modRes.data?.moduleId) {
            for (const s of im.sections) {
              await callAction('add_section', { moduleId: modRes.data.moduleId, contentType: s.contentType, body: s.body, visibleTo: ['client'] });
            }
          }
        }
      }
      setResult('✓ Program created');
      setTitle(''); setDesc(''); setPeriods([]);
      onRefresh();
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handle} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2 text-sm" placeholder="Program title" value={title} onChange={e => setTitle(e.target.value)} required />
        <select className="border rounded px-3 py-2 text-sm" value={periodType} onChange={e => setPeriodType(e.target.value as PeriodType)}>
          {(Object.keys(PERIOD_LABELS) as PeriodType[]).map(pt => <option key={pt} value={pt}>{PERIOD_LABELS[pt]}s</option>)}
        </select>
      </div>
      <textarea className="w-full border rounded px-3 py-2 text-sm h-16" placeholder="Description (optional)" value={description} onChange={e => setDesc(e.target.value)} />

      <div className="space-y-4">
        {periods.map((period, pi) => (
          <div key={pi} className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center gap-3">
              <input className="border rounded px-2 py-1 text-sm font-medium flex-1" value={period.label}
                onChange={e => setPeriods(p => p.map((r, i) => i === pi ? { ...r, label: e.target.value } : r))} />
              <button type="button" onClick={() => setPeriods(p => p.filter((_, i) => i !== pi))} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Assign existing modules:</p>
              <div className="flex flex-wrap gap-2">
                {modules.map(m => (
                  <label key={m.moduleId} className="flex items-center gap-1 text-xs border bg-white rounded px-2 py-1 cursor-pointer hover:bg-indigo-50">
                    <input type="checkbox" checked={period.selectedModuleIds.includes(m.moduleId)}
                      onChange={() => setPeriods(p => p.map((r, i) => {
                        if (i !== pi) return r;
                        const ids = r.selectedModuleIds.includes(m.moduleId) ? r.selectedModuleIds.filter(x => x !== m.moduleId) : [...r.selectedModuleIds, m.moduleId];
                        return { ...r, selectedModuleIds: ids };
                      }))} />
                    {m.title}
                  </label>
                ))}
              </div>
            </div>

            {period.inlineModules.map((im, mi) => (
              <div key={mi} className="border border-indigo-100 bg-white rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-indigo-600 shrink-0">New module</span>
                  <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Title" value={im.title} onChange={e => updateInlineField(pi, mi, 'title', e.target.value)} />
                  <select className="border rounded px-2 py-1 text-xs" value={im.category} onChange={e => updateInlineField(pi, mi, 'category', e.target.value)}>
                    <option value="">Category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {im.sections.length > 0 && (
                  <ul className="space-y-1">
                    {im.sections.map(s => (
                      <li key={s.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                        <span>✓ {s.label}</span>
                        <button type="button" onClick={() => removeDraftSection(pi, mi, s.id)} className="text-red-300 hover:text-red-500 ml-2">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
                {!im.showBuilder ? (
                  <button type="button" onClick={() => toggleInlineBuilder(pi, mi)} className="text-xs text-indigo-600 hover:underline">+ Add content to this module</button>
                ) : (
                  <div>
                    <SectionBuilder compact onSave={async (type, body) => { addDraftSection(pi, mi, type, body); }} />
                    <button type="button" onClick={() => toggleInlineBuilder(pi, mi)} className="text-xs text-gray-400 hover:text-gray-600 mt-2">↑ Collapse</button>
                  </div>
                )}
              </div>
            ))}

            <button type="button" onClick={() => addInlineModule(pi)} className="text-xs text-indigo-600 hover:underline">+ Create module here</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addPeriod} className="border border-dashed border-indigo-300 text-indigo-600 px-4 py-2 rounded text-sm w-full hover:bg-indigo-50">
        + Add {PERIOD_LABELS[periodType]}
      </button>
      <button type="submit" disabled={saving || !title || !periods.length} className="bg-indigo-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Timeline Program'}
      </button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}

// ── Packages Tab ───────────────────────────────────────────────────────────────

function PackagesTab({ programs, callAction, onRefresh }: {
  programs: ProgramRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
}) {
  const [title, setTitle]          = useState('');
  const [selectedIds, setSelected] = useState<string[]>([]);
  const [snapshotId, setSnapshot]  = useState('');
  const [pricing, setPricing]      = useState<'free'|'one_time'|'subscription'>('free');
  const [price, setPrice]          = useState('');
  const [result, setResult]        = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) { setResult('✗ Select at least one program'); return; }
    const r = await callAction('assemble_package', {
      personaSnapshotId: snapshotId, title, programIds: selectedIds,
      pricingModel: pricing, priceUsd: price ? parseFloat(price) : undefined,
    }) as { success: boolean; message: string };
    setResult(r.success ? '✓ ' + r.message : '✗ ' + r.message);
    if (r.success) { setTitle(''); setSelected([]); setSnapshot(''); setPrice(''); onRefresh(); }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold mb-4">Assemble Package</h2>
      <form onSubmit={handle} className="space-y-4 max-w-md">
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Package title" value={title} onChange={e => setTitle(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Persona snapshot ID" value={snapshotId} onChange={e => setSnapshot(e.target.value)} required />
        <div>
          <p className="text-xs text-gray-500 mb-2">Select programs:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
            {programs.length === 0 && <p className="text-xs text-gray-400">No programs yet.</p>}
            {programs.map(pg => (
              <label key={pg.programId} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <input type="checkbox" checked={selectedIds.includes(pg.programId)} onChange={() => setSelected(p => p.includes(pg.programId) ? p.filter(x => x !== pg.programId) : [...p, pg.programId])} />
                <span>{pg.title}</span>
              </label>
            ))}
          </div>
        </div>
        <select className="w-full border rounded px-3 py-2 text-sm" value={pricing} onChange={e => setPricing(e.target.value as typeof pricing)}>
          <option value="free">Free</option>
          <option value="one_time">One-time payment</option>
          <option value="subscription">Subscription</option>
        </select>
        {pricing !== 'free' && <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="Price (USD)" value={price} onChange={e => setPrice(e.target.value)} />}
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Assemble Package</button>
        {result && <p className="text-sm text-green-700">{result}</p>}
      </form>
    </div>
  );
}

// ── Clients Tab ────────────────────────────────────────────────────────────────

function ClientsTab({ clients, modules, callAction }: {
  clients: ClientProfile[];
  modules: ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [clientId, setClientId]   = useState('');
  const [moduleId, setModuleId]   = useState('');
  const [notes, setNotes]         = useState('');
  const [observations, setObs]    = useState('');
  const [customFields, setCustom] = useState<{ key: string; value: string }[]>([]);
  const [status, setStatus]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  async function loadData() {
    if (!clientId || !moduleId) return;
    setLoading(true); setStatus(null);
    const r = await callAction('load_client_module_data', { moduleId, clientId }) as {
      success: boolean;
      data?: { data?: { notes?: string; observations?: string; customFields?: Record<string, string> } };
    };
    if (r.success && r.data?.data) {
      setNotes(r.data.data.notes ?? '');
      setObs(r.data.data.observations ?? '');
      setCustom(Object.entries(r.data.data.customFields ?? {}).map(([key, value]) => ({ key, value: String(value) })));
    } else { setNotes(''); setObs(''); setCustom([]); }
    setLoading(false);
  }

  async function saveData() {
    if (!clientId || !moduleId) return;
    setLoading(true);
    const cf = Object.fromEntries(customFields.filter(f => f.key).map(f => [f.key, f.value]));
    const r = await callAction('save_client_module_data', { moduleId, clientId, data: { notes, observations, customFields: cf } }) as { success: boolean; message: string };
    setStatus(r.success ? '✓ Saved' : '✗ ' + r.message);
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Per-Module Client Notes</h2>
        <p className="text-xs text-gray-500">This data is private to you and is not visible to the module creator or any other coach.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Client</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.name} — {c.email}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Module</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={moduleId} onChange={e => setModuleId(e.target.value)}>
            <option value="">Select module…</option>
            {modules.map(m => <option key={m.moduleId} value={m.moduleId}>{m.title}</option>)}
          </select>
        </div>
      </div>
      <button onClick={loadData} disabled={!clientId || !moduleId || loading}
        className="border px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50">Load</button>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notes</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm h-24" placeholder="Coaching notes…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Observations</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm h-24" placeholder="Progress observations…" value={observations} onChange={e => setObs(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500">Custom fields</label>
            <button type="button" onClick={() => setCustom(p => [...p, { key: '', value: '' }])} className="text-xs text-indigo-600 hover:underline">+ Add field</button>
          </div>
          {customFields.map((f, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className="border rounded px-2 py-1 text-xs w-32" placeholder="Field name" value={f.key} onChange={e => setCustom(p => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
              <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="Value" value={f.value} onChange={e => setCustom(p => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
              <button type="button" onClick={() => setCustom(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={saveData} disabled={!clientId || !moduleId || loading}
        className="bg-indigo-600 text-white px-5 py-2 rounded text-sm disabled:opacity-50">
        {loading ? 'Saving…' : 'Save'}
      </button>
      {status && <p className="text-sm text-green-700">{status}</p>}
    </div>
  );
}
