'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/components/SessionProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab         = 'modules' | 'programs' | 'packages' | 'clients';
type PeriodType  = 'week' | 'day' | 'month' | 'quarter' | 'custom';
type ProgramMode = 'flat' | 'timeline';
type SectionType = 'text' | 'video' | 'long_form_qa' | 'single_choice' | 'multi_choice'
                 | 'match_following' | 'rating' | 'assignment';
type BlockType   = 'text_block' | 'image_embed' | 'video_embed' | 'long_form_qa'
                 | 'single_choice' | 'multi_choice' | 'match_following' | 'rating'
                 | 'photo_upload' | 'video_upload' | 'image_question';

interface ModuleRecord {
  moduleId:        string;
  title:           string;
  category:        string;
  isPublished:     boolean;
  sourceProgramId?: string;
}

interface SectionRecord {
  sectionId:    string;
  sectionOrder: number;
  contentType:  SectionType;
  body:         Record<string, unknown>;
  visibleTo:    string[];
}

interface ProgramRecord {
  programId:   string;
  title:       string;
  isPublished: boolean;
  periods?: { periodId: string; label: string; periodType: PeriodType }[];
}

interface ProgramModuleInfo {
  moduleId:     string;
  title:        string;
  category:     string;
  periodLabel?: string;
}

interface ClientProfile { clientId: string; name: string; email: string; }

interface SectionDraft {
  id:          string;
  contentType: SectionType;
  body:        Record<string, unknown>;
  label:       string;
}

interface InlineModuleEntry {
  title:       string;
  category:    string;
  sections:    SectionDraft[];
  showBuilder: boolean;
}

interface PeriodRow {
  label:             string;
  periodType:        PeriodType;
  selectedModuleIds: string[];
  inlineModules:     InlineModuleEntry[];
}

interface BlockDraft { id: string; type: BlockType; [key: string]: unknown; }

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week', day: 'Day', month: 'Month', quarter: 'Quarter', custom: 'Period',
};

const CATEGORIES = ['mindset','nutrition','fitness','business','leadership','wellness','productivity'];

const SECTION_LABELS: Record<SectionType, string> = {
  text:           'Description',
  video:          'Video',
  long_form_qa:   'Written Q&A',
  single_choice:  'Single Choice',
  multi_choice:   'Multiple Choice',
  match_following:'Match the Following',
  rating:         'Rating',
  assignment:     'Assignment',
};

const SECTION_ICONS: Record<SectionType, string> = {
  text:           'TXT',
  video:          'VID',
  long_form_qa:   'QA',
  single_choice:  'SC',
  multi_choice:   'MC',
  match_following:'MF',
  rating:         'RT',
  assignment:     'AS',
};

const BLOCK_LABELS: Record<BlockType, string> = {
  text_block:     'Text Block',
  image_embed:    'Image',
  video_embed:    'Video',
  long_form_qa:   'Written Answer',
  single_choice:  'Single Choice',
  multi_choice:   'Multiple Choice',
  match_following:'Match the Following',
  rating:         'Rating',
  photo_upload:   'Photo Upload Request',
  video_upload:   'Video Upload Request',
  image_question: 'Image + Question',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  mindset:      { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300' },
  nutrition:    { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-300'  },
  fitness:      { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
  business:     { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300'   },
  leadership:   { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300' },
  wellness:     { bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300'   },
  productivity: { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300' },
};

function catColor(category: string) {
  return CATEGORY_COLORS[category] ?? { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmbedUrl(url: string) {
  return url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/');
}

function sectionLabel(type: SectionType, body: Record<string, unknown>): string {
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
    case 'assignment':      return ((body.items as unknown[])?.length ?? 0) + ' item(s)';
  }
}

function blockSummary(b: BlockDraft): string {
  switch (b.type) {
    case 'text_block':      return String(b.content ?? '').slice(0, 40);
    case 'image_embed':     return String(b.imageUrl ?? '');
    case 'video_embed':     return String(b.caption || b.embedUrl || '');
    case 'long_form_qa':    return String(b.question ?? '');
    case 'single_choice':   return String(b.question ?? '');
    case 'multi_choice':    return String(b.question ?? '');
    case 'match_following': return ((b.pairs as unknown[])?.length ?? 0) + ' pairs';
    case 'rating':          return String(b.question ?? '');
    case 'photo_upload':    return String(b.prompt ?? '');
    case 'video_upload':    return String(b.prompt ?? '');
    case 'image_question':  return String(b.question ?? '');
  }
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const smallInputCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors';
const btnSecondary = 'border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const btnGhost = 'text-indigo-600 hover:text-indigo-800 text-sm font-medium';
const btnDanger = 'text-red-400 hover:text-red-600 text-xs';
const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-sm';

function SaveBtn({ disabled, onClick, saving, label = 'Save' }: {
  disabled: boolean; onClick: () => void; saving: boolean; label?: string;
}) {
  return (
    <button type="button" disabled={disabled || saving} onClick={onClick} className={btnPrimary}>
      {saving ? 'Saving...' : label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  const { userId } = useSession();
  const [tab, setTab]           = useState<Tab>('modules');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Program Builder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create modules, build programs, assemble packages, and track per-client notes.
        </p>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      )}
      <div className="flex border-b border-gray-200 gap-1">
        {(['modules','programs','packages','clients'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
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

// ── Section Builder ───────────────────────────────────────────────────────────

interface SectionBuilderProps {
  onSave:       (type: SectionType, body: Record<string, unknown>, visibleTo: string[]) => Promise<void>;
  compact?:     boolean;
  editSection?: { sectionId: string; contentType: SectionType; body: Record<string, unknown>; visibleTo: string[] };
}

function SectionBuilder({ onSave, compact = false, editSection }: SectionBuilderProps) {
  const [active, setActive] = useState<SectionType | null>(editSection?.contentType ?? null);
  const [saving, setSaving] = useState(false);

  async function commit(type: SectionType, body: Record<string, unknown>, visibleTo: string[]) {
    setSaving(true);
    try { await onSave(type, body, visibleTo); if (!editSection) setActive(null); }
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
    onCommit: (b: Record<string, unknown>, v: string[]) => commit(active, b, v),
    saving,
    initialBody:    editSection?.contentType === active ? editSection.body    : undefined,
    initialVisible: editSection?.contentType === active ? editSection.visibleTo : undefined,
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
      {active === 'assignment'      && <AssignmentForm     onCommit={commonProps.onCommit} saving={commonProps.saving} initialBody={commonProps.initialBody} />}
    </div>
  );
}

// ── Visibility selector ───────────────────────────────────────────────────────

function VisibilitySelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const opts = [
    { key: 'client',   label: 'Client' },
    { key: 'trainee',  label: 'Trainee' },
    { key: 'delivery', label: 'Delivery' },
  ];
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 shrink-0">Visible to:</span>
      {opts.map(o => (
        <label key={o.key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox"
            checked={value.includes(o.key)}
            onChange={() => onChange(value.includes(o.key) ? value.filter(v => v !== o.key) : [...value, o.key])} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

// ── Section type forms ────────────────────────────────────────────────────────

interface FormProps {
  onCommit:        (b: Record<string, unknown>, visibleTo: string[]) => void;
  saving:          boolean;
  initialBody?:    Record<string, unknown>;
  initialVisible?: string[];
}

function TextForm({ onCommit, saving, initialBody, initialVisible }: FormProps) {
  const [content, setContent] = useState(initialBody?.content as string ?? '');
  const [visible, setVisible] = useState<string[]>(initialVisible ?? ['client']);
  return (
    <div className="space-y-3">
      <textarea className={inputCls + ' h-28'} placeholder="Description or text content..."
        value={content} onChange={e => setContent(e.target.value)} />
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!content.trim() || saving} onClick={() => onCommit({ content }, visible)} saving={saving} />
    </div>
  );
}

function VideoForm({ onCommit, saving, initialBody, initialVisible }: FormProps) {
  const [embedUrl, setEmbedUrl] = useState(initialBody?.embedUrl as string ?? '');
  const [caption, setCaption]   = useState(initialBody?.caption as string ?? '');
  const [warn, setWarn]         = useState('');
  const [visible, setVisible]   = useState<string[]>(initialVisible ?? ['client']);
  function onChange(val: string) {
    setEmbedUrl(val);
    setWarn(val && !isValidEmbedUrl(val) ? 'Use an embed URL: youtube.com/embed/... or player.vimeo.com/video/...' : '');
  }
  return (
    <div className="space-y-3">
      <div>
        <input className={inputCls} placeholder="YouTube or Vimeo embed URL"
          value={embedUrl} onChange={e => onChange(e.target.value)} />
        {warn && <p className="text-xs text-amber-600 mt-1">{warn}</p>}
      </div>
      {embedUrl && !warn && (
        <div className="rounded-lg overflow-hidden border border-gray-200 aspect-video">
          <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" />
        </div>
      )}
      <input className={inputCls} placeholder="Caption (optional)"
        value={caption} onChange={e => setCaption(e.target.value)} />
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!embedUrl || !!warn || saving}
        onClick={() => onCommit({ embedUrl, caption: caption || undefined }, visible)} saving={saving} />
    </div>
  );
}

function LongFormQAForm({ onCommit, saving, initialBody, initialVisible }: FormProps) {
  const initQs = (initialBody?.questions as { question: string; hint?: string; minWords?: number }[])
    ?? [{ question: '', hint: '', minWords: 0 }];
  const [questions, setQuestions] = useState(initQs.map(q => ({
    question: q.question, hint: q.hint ?? '', minWords: q.minWords ? String(q.minWords) : '',
  })));
  const [visible, setVisible] = useState<string[]>(initialVisible ?? ['client']);

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
    }, visible);
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
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!canSave || saving} onClick={commit} saving={saving} />
    </div>
  );
}

function ChoiceForm({ multi, onCommit, saving, initialBody, initialVisible }: FormProps & { multi: boolean }) {
  const [question, setQuestion] = useState(initialBody?.question as string ?? '');
  const initOpts = (initialBody?.options as string[]) ?? ['', ''];
  const [options, setOptions]   = useState(initOpts.length ? initOpts : ['', '']);
  const initCorrect = multi
    ? (initialBody?.correctIndices as number[] ?? [])
    : (initialBody?.correctIndex !== undefined ? [initialBody.correctIndex as number] : []);
  const [correct, setCorrect]   = useState<number[]>(initCorrect);
  const [visible, setVisible]   = useState<string[]>(initialVisible ?? ['client']);

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
  const canSave = question.trim() && filled.length >= 2 && correct.length > 0;

  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Question..."
        value={question} onChange={e => setQuestion(e.target.value)} />
      <p className="text-xs text-gray-500">{multi ? 'Check all correct answers.' : 'Select the one correct answer.'}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ' +
            (correct.includes(i) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200')}>
            <input type={multi ? 'checkbox' : 'radio'} name="correct"
              checked={correct.includes(i)} onChange={() => toggleCorrect(i)} className="shrink-0" />
            <input className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
              placeholder={'Option ' + (i + 1)} value={opt} onChange={e => setOption(i, e.target.value)} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} className={btnDanger}>x</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className={btnGhost}>+ Add option</button>
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!canSave || saving}
        onClick={() => onCommit({
          question,
          options: filled,
          [multi ? 'correctIndices' : 'correctIndex']: multi ? correct : correct[0],
        }, visible)} saving={saving} />
    </div>
  );
}

function MatchForm({ onCommit, saving, initialBody, initialVisible }: FormProps) {
  const initPairs = (initialBody?.pairs as { left: string; right: string }[]) ?? [{ left: '', right: '' }, { left: '', right: '' }];
  const [instruction, setInstruction] = useState(initialBody?.instruction as string ?? '');
  const [pairs, setPairs]             = useState(initPairs);
  const [visible, setVisible]         = useState<string[]>(initialVisible ?? ['client']);

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
            <span className="text-gray-400 text-sm">x</span>
            <input className={smallInputCls + ' flex-1'} placeholder="Right item"
              value={p.right} onChange={e => setPair(i, 'right', e.target.value)} />
            {pairs.length > 2 && (
              <button type="button" onClick={() => setPairs(p => p.filter((_, j) => j !== i))} className={btnDanger}>x</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setPairs(p => [...p, { left: '', right: '' }])} className={btnGhost}>+ Add pair</button>
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={valid.length < 2 || saving}
        onClick={() => onCommit({ instruction: instruction || undefined, pairs: valid }, visible)} saving={saving} />
    </div>
  );
}

function RatingForm({ onCommit, saving, initialBody, initialVisible }: FormProps) {
  const [question, setQuestion] = useState(initialBody?.question as string ?? '');
  const [scale, setScale]       = useState<5|10>((initialBody?.scale as 5|10) ?? 5);
  const [low, setLow]           = useState(initialBody?.lowLabel as string ?? '');
  const [high, setHigh]         = useState(initialBody?.highLabel as string ?? '');
  const [visible, setVisible]   = useState<string[]>(initialVisible ?? ['client']);
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
      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!question.trim() || saving}
        onClick={() => onCommit({ question, scale, lowLabel: low || undefined, highLabel: high || undefined }, visible)}
        saving={saving} />
    </div>
  );
}

// ── Assignment Builder ────────────────────────────────────────────────────────

function AssignmentForm({ onCommit, saving, initialBody }: {
  onCommit:     (b: Record<string, unknown>, visibleTo: string[]) => void;
  saving:       boolean;
  initialBody?: Record<string, unknown>;
}) {
  const initItems = (initialBody?.items as Record<string, unknown>[] | undefined) ?? [];
  const [title, setTitle]           = useState(initialBody?.title as string ?? '');
  const [instructions, setInstr]    = useState(initialBody?.instructions as string ?? '');
  const [blocks, setBlocks]         = useState<BlockDraft[]>(
    initItems.map((item, i) => ({ id: String(i), type: item.type as BlockType, ...item }))
  );
  const [addingType, setAddingType] = useState<BlockType | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [visible, setVisible]       = useState<string[]>(['client']);

  function addBlock(type: BlockType, data: Record<string, unknown>) {
    setBlocks(p => [...p, { id: Date.now().toString(), type, ...data }]);
    setAddingType(null);
  }
  function updateBlock(idx: number, type: BlockType, data: Record<string, unknown>) {
    setBlocks(p => p.map((b, i) => i === idx ? { id: b.id, type, ...data } : b));
    setEditingIdx(null);
  }
  function removeBlock(id: string) { setBlocks(p => p.filter(b => b.id !== id)); }

  function commit() {
    const items = blocks.map(({ id: _id, ...rest }) => rest);
    onCommit({ title: title || undefined, instructions: instructions || undefined, items }, visible);
  }

  return (
    <div className="space-y-4">
      <input className={inputCls} placeholder="Assignment title (optional)"
        value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className={inputCls + ' h-16'} placeholder="Overall instructions (optional)"
        value={instructions} onChange={e => setInstr(e.target.value)} />

      {blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={b.id}>
              {editingIdx === i ? (
                <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-700">
                      {BLOCK_LABELS[b.type]}
                    </span>
                    <button type="button" onClick={() => setEditingIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">x Cancel</button>
                  </div>
                  <BlockForm type={b.type} onAdd={data => updateBlock(i, b.type, data)} initialData={b} label="Update Block" />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">{i + 1}.</span>
                    <span className="text-xs font-medium text-gray-500">{BLOCK_LABELS[b.type]}</span>
                    <span className="text-gray-400 truncate max-w-xs">{blockSummary(b)}</span>
                  </span>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <button type="button" onClick={() => setEditingIdx(i)} className="text-xs text-indigo-500 hover:text-indigo-700">Edit</button>
                    <button type="button" onClick={() => removeBlock(b.id)} className={btnDanger}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addingType ? (
        <div className="border border-indigo-200 rounded-xl p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-700">{BLOCK_LABELS[addingType]}</span>
            <button type="button" onClick={() => setAddingType(null)} className="text-xs text-gray-400 hover:text-gray-600">x Cancel</button>
          </div>
          <BlockForm type={addingType} onAdd={data => addBlock(addingType, data)} />
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Add a block:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map(t => (
              <button key={t} type="button" onClick={() => setAddingType(t)}
                className="flex flex-col items-center gap-1 border border-gray-200 bg-white rounded-xl px-2 py-3 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-center">
                <span className="text-xs font-mono text-gray-400">{t.slice(0,4)}</span>
                <span className="text-xs text-gray-600 leading-tight">{BLOCK_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <VisibilitySelector value={visible} onChange={setVisible} />
      <SaveBtn disabled={!blocks.length || saving} onClick={commit} saving={saving} label="Save Assignment" />
    </div>
  );
}

// ── Block forms ───────────────────────────────────────────────────────────────

function BlockForm({ type, onAdd, initialData, label = 'Add Block' }: {
  type:        BlockType;
  onAdd:       (data: Record<string, unknown>) => void;
  initialData?: BlockDraft;
  label?:      string;
}) {
  switch (type) {
    case 'text_block':      return <BlockTextForm     onAdd={onAdd} init={initialData} label={label} />;
    case 'image_embed':     return <BlockImageForm    onAdd={onAdd} init={initialData} label={label} />;
    case 'video_embed':     return <BlockVideoForm    onAdd={onAdd} init={initialData} label={label} />;
    case 'long_form_qa':    return <BlockLongFormQA   onAdd={onAdd} init={initialData} label={label} />;
    case 'single_choice':   return <BlockChoice multi={false} onAdd={onAdd} init={initialData} label={label} />;
    case 'multi_choice':    return <BlockChoice multi={true}  onAdd={onAdd} init={initialData} label={label} />;
    case 'match_following': return <BlockMatch        onAdd={onAdd} init={initialData} label={label} />;
    case 'rating':          return <BlockRating       onAdd={onAdd} init={initialData} label={label} />;
    case 'photo_upload':    return <BlockUpload mediaType="photo" onAdd={onAdd} init={initialData} label={label} />;
    case 'video_upload':    return <BlockUpload mediaType="video" onAdd={onAdd} init={initialData} label={label} />;
    case 'image_question':  return <BlockImageQuestion onAdd={onAdd} init={initialData} label={label} />;
  }
}

interface BlockFormProps { onAdd: (d: Record<string, unknown>) => void; init?: BlockDraft; label?: string; }

function AddBtn({ disabled, onClick, label = 'Add Block' }: { disabled: boolean; onClick: () => void; label?: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={btnPrimary}>{label}</button>;
}

function BlockTextForm({ onAdd, init, label }: BlockFormProps) {
  const [content, setContent] = useState(init?.content as string ?? '');
  return (
    <div className="space-y-2">
      <textarea className={inputCls + ' h-20'} placeholder="Text content..."
        value={content} onChange={e => setContent(e.target.value)} />
      <AddBtn disabled={!content.trim()} onClick={() => onAdd({ content })} label={label} />
    </div>
  );
}

function BlockImageForm({ onAdd, init, label }: BlockFormProps) {
  const [imageUrl, setImageUrl] = useState(init?.imageUrl as string ?? '');
  const [caption, setCaption]   = useState(init?.caption as string ?? '');
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Image URL (publicly accessible, e.g. Imgur, Google Drive)"
        value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      {imageUrl && (
        <img src={imageUrl} alt="preview" className="max-h-32 rounded-lg border object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <input className={inputCls} placeholder="Caption (optional)"
        value={caption} onChange={e => setCaption(e.target.value)} />
      <AddBtn disabled={!imageUrl.trim()} onClick={() => onAdd({ imageUrl, caption: caption || undefined })} label={label} />
    </div>
  );
}

function BlockVideoForm({ onAdd, init, label }: BlockFormProps) {
  const [embedUrl, setEmbedUrl] = useState(init?.embedUrl as string ?? '');
  const [caption, setCaption]   = useState(init?.caption as string ?? '');
  const [warn, setWarn]         = useState('');
  function onChange(val: string) {
    setEmbedUrl(val);
    setWarn(val && !isValidEmbedUrl(val) ? 'Use an embed URL: youtube.com/embed/... or player.vimeo.com/video/...' : '');
  }
  return (
    <div className="space-y-2">
      <div>
        <input className={inputCls} placeholder="YouTube or Vimeo embed URL"
          value={embedUrl} onChange={e => onChange(e.target.value)} />
        {warn && <p className="text-xs text-amber-600 mt-1">{warn}</p>}
      </div>
      <input className={inputCls} placeholder="Caption (optional)"
        value={caption} onChange={e => setCaption(e.target.value)} />
      <AddBtn disabled={!embedUrl || !!warn} onClick={() => onAdd({ embedUrl, caption: caption || undefined })} label={label} />
    </div>
  );
}

function BlockLongFormQA({ onAdd, init, label }: BlockFormProps) {
  const [question, setQ] = useState(init?.question as string ?? '');
  const [hint, setHint]  = useState(init?.hint as string ?? '');
  const [min, setMin]    = useState(init?.minWords !== undefined ? String(init.minWords) : '');
  return (
    <div className="space-y-2">
      <textarea className={inputCls + ' h-16'} placeholder="Question prompt..."
        value={question} onChange={e => setQ(e.target.value)} />
      <input className={inputCls} placeholder="Hint (optional)"
        value={hint} onChange={e => setHint(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Min word count (optional)"
        value={min} onChange={e => setMin(e.target.value)} />
      <AddBtn disabled={!question.trim()}
        onClick={() => onAdd({ question, hint: hint || undefined, minWords: min ? parseInt(min) : undefined })} label={label} />
    </div>
  );
}

function BlockChoice({ multi, onAdd, init, label }: BlockFormProps & { multi: boolean }) {
  const [question, setQ]   = useState(init?.question as string ?? '');
  const [options, setOpts] = useState<string[]>((init?.options as string[] | undefined) ?? ['', '']);
  const initCorr = multi
    ? (init?.correctIndices as number[] ?? [])
    : (init?.correctIndex !== undefined ? [init.correctIndex as number] : []);
  const [correct, setC] = useState<number[]>(initCorr);
  function setOpt(i: number, v: string) { setOpts(p => p.map((o, j) => j === i ? v : o)); }
  function toggle(i: number) { setC(multi ? (p => p.includes(i) ? p.filter(c => c !== i) : [...p, i]) : [i]); }
  const filled = options.filter(o => o.trim());
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Question..." value={question} onChange={e => setQ(e.target.value)} />
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ' +
            (correct.includes(i) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200')}>
            <input type={multi ? 'checkbox' : 'radio'} name={'bc-' + multi}
              checked={correct.includes(i)} onChange={() => toggle(i)} className="shrink-0" />
            <input className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
              placeholder={'Option ' + (i + 1)} value={opt} onChange={e => setOpt(i, e.target.value)} />
            {options.length > 2 && (
              <button type="button" onClick={() => setOpts(p => p.filter((_, j) => j !== i))} className={btnDanger}>x</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setOpts(p => [...p, ''])} className={btnGhost}>+ Option</button>
      <AddBtn disabled={!question.trim() || filled.length < 2 || !correct.length}
        onClick={() => onAdd({ question, options: filled, [multi ? 'correctIndices' : 'correctIndex']: multi ? correct : correct[0] })} label={label} />
    </div>
  );
}

function BlockMatch({ onAdd, init, label }: BlockFormProps) {
  const [instr, setInstr] = useState(init?.instruction as string ?? '');
  const initPairs = (init?.pairs as { left: string; right: string }[]) ?? [{ left: '', right: '' }, { left: '', right: '' }];
  const [pairs, setPairs] = useState(initPairs);
  function set(i: number, side: 'left'|'right', v: string) { setPairs(p => p.map((x, j) => j === i ? { ...x, [side]: v } : x)); }
  const valid = pairs.filter(p => p.left.trim() && p.right.trim());
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Instruction (optional)" value={instr} onChange={e => setInstr(e.target.value)} />
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={smallInputCls + ' flex-1'} placeholder="Left" value={p.left} onChange={e => set(i, 'left', e.target.value)} />
          <span className="text-gray-400">x</span>
          <input className={smallInputCls + ' flex-1'} placeholder="Right" value={p.right} onChange={e => set(i, 'right', e.target.value)} />
          {pairs.length > 2 && <button type="button" onClick={() => setPairs(p => p.filter((_, j) => j !== i))} className={btnDanger}>x</button>}
        </div>
      ))}
      <button type="button" onClick={() => setPairs(p => [...p, { left: '', right: '' }])} className={btnGhost}>+ Pair</button>
      <AddBtn disabled={valid.length < 2} onClick={() => onAdd({ instruction: instr || undefined, pairs: valid })} label={label} />
    </div>
  );
}

function BlockRating({ onAdd, init, label }: BlockFormProps) {
  const [q, setQ]     = useState(init?.question as string ?? '');
  const [scale, setS] = useState<5|10>((init?.scale as 5|10) ?? 5);
  const [low, setLow] = useState(init?.lowLabel as string ?? '');
  const [high, setHigh] = useState(init?.highLabel as string ?? '');
  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Rating question..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex items-center gap-2">
        {([5, 10] as const).map(s => (
          <button key={s} type="button" onClick={() => setS(s)}
            className={'px-3 py-1 rounded-full text-xs font-medium border transition-colors ' +
              (scale === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300')}>
            1-{s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={smallInputCls + ' flex-1'} placeholder="Low label" value={low} onChange={e => setLow(e.target.value)} />
        <input className={smallInputCls + ' flex-1'} placeholder="High label" value={high} onChange={e => setHigh(e.target.value)} />
      </div>
      <AddBtn disabled={!q.trim()} onClick={() => onAdd({ question: q, scale, lowLabel: low || undefined, highLabel: high || undefined })} label={label} />
    </div>
  );
}

function BlockUpload({ mediaType, onAdd, init, label }: BlockFormProps & { mediaType: 'photo' | 'video' }) {
  const [prompt, setPrompt] = useState(init?.prompt as string ?? '');
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">The assignment taker will be prompted to upload a {mediaType}.</p>
      <textarea className={inputCls + ' h-16'} placeholder={'Describe what ' + mediaType + ' to upload...'}
        value={prompt} onChange={e => setPrompt(e.target.value)} />
      <AddBtn disabled={!prompt.trim()} onClick={() => onAdd({ prompt })} label={label} />
    </div>
  );
}

function BlockImageQuestion({ onAdd, init, label }: BlockFormProps) {
  const [imageUrl, setImageUrl]  = useState(init?.imageUrl as string ?? '');
  const [question, setQ]         = useState(init?.question as string ?? '');
  const [answerType, setAnsType] = useState<'long_form'|'single_choice'|'multi_choice'>(
    (init?.answerType as 'long_form'|'single_choice'|'multi_choice') ?? 'long_form'
  );
  const [options, setOptions]    = useState<string[]>((init?.options as string[] | undefined) ?? ['', '']);
  const initCorr = answerType === 'single_choice'
    ? (init?.correctIndex !== undefined ? [init.correctIndex as number] : [])
    : (init?.correctIndices as number[] ?? []);
  const [correct, setCorrect]    = useState<number[]>(initCorr);

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
      <input className={inputCls} placeholder="Image URL (publicly accessible)"
        value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      {imageUrl && (
        <img src={imageUrl} alt="preview" className="max-h-32 rounded-lg border object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <input className={inputCls} placeholder="Question about the image..."
        value={question} onChange={e => setQ(e.target.value)} />
      <select className={inputCls} value={answerType} onChange={e => setAnsType(e.target.value as typeof answerType)}>
        <option value="long_form">Written answer</option>
        <option value="single_choice">Single choice</option>
        <option value="multi_choice">Multiple choice</option>
      </select>
      {answerType !== 'long_form' && (
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <div key={i} className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ' +
              (correct.includes(i) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-indigo-200')}>
              <input type={answerType === 'single_choice' ? 'radio' : 'checkbox'}
                name="iq-correct" checked={correct.includes(i)} onChange={() => toggleC(i)} className="shrink-0" />
              <input className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                placeholder={'Option ' + (i + 1)} value={opt} onChange={e => setOpt(i, e.target.value)} />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions(p => p.filter((_, j) => j !== i))} className={btnDanger}>x</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setOptions(p => [...p, ''])} className={btnGhost}>+ Option</button>
        </div>
      )}
      <AddBtn disabled={!canAdd} onClick={commit} label={label} />
    </div>
  );
}

// ── Modules Tab ────────────────────────────────────────────────────────────────

function ModulesTab({ modules, callAction, onRefresh }: {
  modules:    ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh:  () => void;
}) {
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult]     = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [sectionsMap, setSectionsMap]   = useState<Record<string, SectionRecord[]>>({});
  const [expandedMap, setExpandedMap]   = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap]     = useState<Record<string, boolean>>({});

  const [activeNew, setActiveNew]     = useState<{ moduleId: string; title: string } | null>(null);
  const [newSections, setNewSections] = useState<string[]>([]);

  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editTitle, setEditTitle]         = useState('');
  const [editCategory, setEditCategory]   = useState('');
  const [savingEdit, setSavingEdit]       = useState(false);

  const [editingSection, setEditingSection] = useState<{ moduleId: string; section: SectionRecord } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const r = await callAction('create_module', { title, category }) as {
      success: boolean; message: string; data?: { moduleId: string };
    };
    setCreating(false);
    if (r.success && r.data) {
      setResult('Module created - add content below');
      setActiveNew({ moduleId: r.data.moduleId, title });
      setNewSections([]);
      setTitle(''); setCategory('');
      onRefresh();
    } else {
      setResult('Error: ' + r.message);
    }
  }

  async function loadSections(moduleId: string) {
    if (loadingMap[moduleId]) return;
    setLoadingMap(p => ({ ...p, [moduleId]: true }));
    const r = await callAction('get_module_detail', { moduleId }) as {
      success: boolean; data?: { sections: SectionRecord[] };
    };
    setLoadingMap(p => ({ ...p, [moduleId]: false }));
    if (r.success && r.data) {
      setSectionsMap(p => ({ ...p, [moduleId]: r.data!.sections }));
    }
  }

  async function toggleExpand(moduleId: string) {
    const nowOpen = !expandedMap[moduleId];
    setExpandedMap(p => ({ ...p, [moduleId]: nowOpen }));
    if (nowOpen && !sectionsMap[moduleId]) {
      await loadSections(moduleId);
    }
  }

  async function persistNewSection(type: SectionType, body: Record<string, unknown>, visibleTo: string[]) {
    if (!activeNew) return;
    const existing = sectionsMap[activeNew.moduleId] ?? [];
    const r = await callAction('add_section', {
      moduleId:    activeNew.moduleId,
      order:       existing.length,
      contentType: type,
      body,
      visibleTo,
    }) as { success: boolean; data?: SectionRecord };
    if (r.success && r.data) {
      const label = SECTION_LABELS[type] + ': ' + sectionLabel(type, body);
      setNewSections(p => [...p, label]);
      setSectionsMap(prev => ({
        ...prev,
        [activeNew.moduleId]: [...(prev[activeNew.moduleId] ?? []), r.data!],
      }));
    }
  }

  async function addSectionToExisting(moduleId: string, type: SectionType, body: Record<string, unknown>, visibleTo: string[]) {
    const existing = sectionsMap[moduleId] ?? [];
    const r = await callAction('add_section', {
      moduleId,
      order:       existing.length,
      contentType: type,
      body,
      visibleTo,
    }) as { success: boolean; data?: SectionRecord };
    if (r.success && r.data) {
      setSectionsMap(prev => ({
        ...prev,
        [moduleId]: [...(prev[moduleId] ?? []), r.data!],
      }));
    }
  }

  async function handleDeleteSection(moduleId: string, sectionId: string) {
    await callAction('delete_section', { sectionId });
    setSectionsMap(prev => ({
      ...prev,
      [moduleId]: (prev[moduleId] ?? []).filter(s => s.sectionId !== sectionId),
    }));
  }

  async function handleUpdateSection(moduleId: string, section: SectionRecord, type: SectionType, body: Record<string, unknown>, visibleTo: string[]) {
    await callAction('update_section', { sectionId: section.sectionId, contentType: type, body, visibleTo });
    setSectionsMap(prev => ({
      ...prev,
      [moduleId]: (prev[moduleId] ?? []).map(s =>
        s.sectionId === section.sectionId ? { ...s, contentType: type, body, visibleTo } : s
      ),
    }));
    setEditingSection(null);
  }

  async function handleSaveModuleEdit(moduleId: string) {
    setSavingEdit(true);
    await callAction('update_module', { moduleId, title: editTitle, category: editCategory });
    setSavingEdit(false);
    setEditingModule(null);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className={cardCls + ' p-6'}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Module</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-48">
            <label className="text-xs font-medium text-gray-500">Title</label>
            <input className={inputCls} placeholder="e.g. Morning Mindset Reset"
              value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1 w-44">
            <label className="text-xs font-medium text-gray-500">Category</label>
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)} required>
              <option value="">Select...</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating ? 'Creating...' : 'Create Module'}
          </button>
        </form>
        {result && (
          <p className={'text-sm mt-3 ' + (result.startsWith('Error') ? 'text-red-600' : 'text-green-700')}>{result}</p>
        )}
      </div>

      {activeNew && (
        <div className="border-2 border-indigo-200 rounded-2xl p-6 bg-indigo-50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-800">Add content to &quot;{activeNew.title}&quot;</h3>
              <p className="text-xs text-indigo-500 mt-0.5">Sections you add here will be saved immediately.</p>
            </div>
            <button onClick={() => setActiveNew(null)} className="text-sm text-indigo-400 hover:text-indigo-700">Done</button>
          </div>
          {newSections.length > 0 && (
            <ul className="space-y-1.5">
              {newSections.map((l, i) => (
                <li key={i} className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">+ {l}</li>
              ))}
            </ul>
          )}
          <SectionBuilder onSave={persistNewSection} />
        </div>
      )}

      {modules.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Your Modules ({modules.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {modules.map(m => {
              const col = catColor(m.category);
              const isExpanded = expandedMap[m.moduleId] ?? false;
              const sections   = sectionsMap[m.moduleId];
              const isLoading  = loadingMap[m.moduleId];
              const isEditingMeta = editingModule === m.moduleId;
              const isEditingSec  = editingSection?.moduleId === m.moduleId;

              return (
                <div key={m.moduleId} className={cardCls + ' overflow-hidden flex flex-col'}>
                  <div className={col.bg + ' px-4 py-3 flex items-center justify-between'}>
                    <span className={'text-xs font-semibold uppercase tracking-wider ' + col.text}>
                      {m.category}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.sourceProgramId && (
                        <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">inline</span>
                      )}
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                        (m.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {m.isPublished ? 'published' : 'draft'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1 gap-3">
                    {isEditingMeta ? (
                      <div className="space-y-2">
                        <input className={inputCls} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                        <select className={inputCls} value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button type="button" disabled={savingEdit} onClick={() => handleSaveModuleEdit(m.moduleId)}
                            className={btnPrimary}>{savingEdit ? 'Saving...' : 'Save'}</button>
                          <button type="button" onClick={() => setEditingModule(null)} className={btnSecondary}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 leading-snug">{m.title}</h3>
                        <button type="button" onClick={() => {
                          setEditingModule(m.moduleId);
                          setEditTitle(m.title);
                          setEditCategory(m.category);
                        }} className="text-gray-400 hover:text-indigo-600 text-sm shrink-0" title="Edit">edit</button>
                      </div>
                    )}

                    <button type="button" onClick={() => toggleExpand(m.moduleId)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 self-start">
                      <span>{isExpanded ? 'v' : '>'}</span>
                      {isLoading ? 'Loading...' : isExpanded ? 'Hide sections' : 'Show sections'}
                    </button>

                    {isExpanded && (
                      <div className="space-y-2">
                        {sections && sections.length > 0 ? sections.map(sec => (
                          <div key={sec.sectionId}>
                            {isEditingSec && editingSection?.section.sectionId === sec.sectionId ? (
                              <div className="rounded-xl border border-indigo-200 bg-white p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-indigo-700">
                                    Editing {SECTION_LABELS[sec.contentType]}
                                  </span>
                                  <button type="button" onClick={() => setEditingSection(null)} className="text-xs text-gray-400 hover:text-gray-600">x Cancel</button>
                                </div>
                                <SectionBuilder
                                  editSection={editingSection.section}
                                  onSave={async (type, body, visibleTo) =>
                                    handleUpdateSection(m.moduleId, sec, type, body, visibleTo)
                                  }
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="min-w-0">
                                    <span className="text-xs font-medium text-gray-600">{SECTION_LABELS[sec.contentType]}</span>
                                    <p className="text-xs text-gray-400 truncate">{sectionLabel(sec.contentType, sec.body)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                  <button type="button"
                                    onClick={() => setEditingSection({ moduleId: m.moduleId, section: sec })}
                                    className="text-xs text-indigo-500 hover:text-indigo-700">Edit</button>
                                  <button type="button"
                                    onClick={() => handleDeleteSection(m.moduleId, sec.sectionId)}
                                    className={btnDanger}>Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )) : (
                          sections && <p className="text-xs text-gray-400">No sections yet.</p>
                        )}
                        {!isEditingSec && (
                          <SectionBuilder
                            compact
                            onSave={async (type, body, visibleTo) =>
                              addSectionToExisting(m.moduleId, type, body, visibleTo)
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Programs Tab ───────────────────────────────────────────────────────────────

function ProgramsTab({ modules, programs, callAction, onRefresh }: {
  modules:    ModuleRecord[];
  programs:   ProgramRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh:  () => void;
}) {
  const [mode, setMode]             = useState<ProgramMode>('flat');
  const [expandedModules, setExpanded] = useState<Record<string, ProgramModuleInfo[]>>({});
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
      <div className={cardCls + ' p-6'}>
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Build Program</h2>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['flat','timeline'] as ProgramMode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ' +
                  (mode === m ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700')}>
                {m === 'flat' ? 'Flat' : 'Timeline'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'flat'     && <FlatProgramForm     modules={modules} callAction={callAction} onRefresh={onRefresh} />}
        {mode === 'timeline' && <TimelineProgramForm modules={modules} callAction={callAction} onRefresh={onRefresh} />}
      </div>

      {programs.length > 0 && (
        <div className={cardCls + ' p-6'}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Programs ({programs.length})</h2>
          <div className="space-y-3">
            {programs.map(pg => (
              <div key={pg.programId} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <button type="button" onClick={() => toggleProgram(pg.programId)}
                    className="flex items-center gap-2.5 text-left hover:text-indigo-700 flex-1 min-w-0">
                    <span className="text-gray-400 text-xs">{expandedModules[pg.programId] ? 'v' : '>'}</span>
                    <span className="font-medium text-gray-900 truncate">{pg.title}</span>
                    {pg.periods && pg.periods.length > 0 && (
                      <span className="shrink-0 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        {pg.periods.length} periods
                      </span>
                    )}
                    {loadingProgram === pg.programId && (
                      <span className="text-xs text-gray-400 shrink-0">Loading...</span>
                    )}
                  </button>
                  <span className={'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ' +
                    (pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {pg.isPublished ? 'published' : 'draft'}
                  </span>
                </div>

                {expandedModules[pg.programId] && (
                  <div className="border-t bg-gray-50 px-4 py-3 space-y-1.5">
                    {expandedModules[pg.programId].length === 0 ? (
                      <p className="text-xs text-gray-400">No modules assigned.</p>
                    ) : expandedModules[pg.programId].map(m => {
                      const col = catColor(m.category);
                      return (
                        <div key={m.moduleId} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + col.bg + ' ' + col.text}>{m.category}</span>
                            <span className="font-medium text-gray-800 truncate">{m.title}</span>
                            {m.periodLabel && (
                              <span className="text-xs text-indigo-500 border-l border-gray-200 pl-2.5 shrink-0">{m.periodLabel}</span>
                            )}
                          </div>
                          <button type="button" onClick={() => removeModule(pg.programId, m.moduleId)}
                            className={btnDanger + ' ml-4 shrink-0'}>
                            Remove
                          </button>
                        </div>
                      );
                    })}
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
  modules:    ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh:  () => void;
}) {
  const [title, setTitle]          = useState('');
  const [selectedIds, setSelected] = useState<string[]>([]);
  const [result, setResult]        = useState<string | null>(null);
  const [saving, setSaving]        = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) { setResult('Select at least one module'); return; }
    setSaving(true);
    const r = await callAction('build_program', { title, moduleIds: selectedIds }) as { success: boolean; message: string };
    setSaving(false);
    setResult(r.message);
    if (r.success) { setTitle(''); setSelected([]); onRefresh(); }
  }

  return (
    <form onSubmit={handle} className="space-y-4 max-w-lg">
      <input className={inputCls} placeholder="Program title" value={title} onChange={e => setTitle(e.target.value)} required />
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Select modules:</p>
        {modules.length === 0
          ? <p className="text-xs text-gray-400">No modules yet - create some in the Modules tab.</p>
          : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50">
              {modules.map(m => {
                const col = catColor(m.category);
                return (
                  <label key={m.moduleId} className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition-colors">
                    <input type="checkbox" checked={selectedIds.includes(m.moduleId)}
                      onChange={() => setSelected(p => p.includes(m.moduleId) ? p.filter(x => x !== m.moduleId) : [...p, m.moduleId])} />
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + col.bg + ' ' + col.text}>{m.category}</span>
                    <span>{m.title}</span>
                  </label>
                );
              })}
            </div>
          )}
      </div>
      <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Building...' : 'Build Program'}</button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}

function TimelineProgramForm({ modules, callAction, onRefresh }: {
  modules:    ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh:  () => void;
}) {
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periods, setPeriods]       = useState<PeriodRow[]>([]);
  const [result, setResult]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  function addPeriod() {
    const num = periods.length + 1;
    setPeriods(p => [...p, { label: PERIOD_LABELS[periodType] + ' ' + num, periodType, selectedModuleIds: [], inlineModules: [] }]);
  }

  function addInlineModule(pi: number) {
    setPeriods(p => p.map((r, i) => i !== pi ? r : {
      ...r, inlineModules: [...r.inlineModules, { title: '', category: '', sections: [], showBuilder: false }],
    }));
  }

  function updateInlineField(pi: number, mi: number, field: 'title'|'category', val: string) {
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
    const draft: SectionDraft = { id: pi + '-' + mi + '-' + Date.now(), contentType: type, body, label: SECTION_LABELS[type] + ': ' + sectionLabel(type, body) };
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
    if (!periods.length) { setResult('Add at least one period'); return; }
    setSaving(true); setResult(null);
    try {
      const r = await callAction('build_program_with_periods', {
        title, description: description || undefined,
        periods: periods.map(p => ({ label: p.label, periodType: p.periodType, moduleIds: p.selectedModuleIds })),
      }) as { success: boolean; message: string; data?: { programId: string; periods?: { periodId: string }[] } };
      if (!r.success) { setResult('Error: ' + r.message); return; }

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
              await callAction('add_section', {
                moduleId:    modRes.data.moduleId,
                order:       im.sections.indexOf(s),
                contentType: s.contentType,
                body:        s.body,
                visibleTo:   ['client'],
              });
            }
          }
        }
      }
      setResult('Program created');
      setTitle(''); setDesc(''); setPeriods([]);
      onRefresh();
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handle} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Program title" value={title} onChange={e => setTitle(e.target.value)} required />
        <select className={inputCls} value={periodType} onChange={e => setPeriodType(e.target.value as PeriodType)}>
          {(Object.keys(PERIOD_LABELS) as PeriodType[]).map(pt => (
            <option key={pt} value={pt}>{PERIOD_LABELS[pt]}s</option>
          ))}
        </select>
      </div>
      <textarea className={inputCls + ' h-16'} placeholder="Description (optional)"
        value={description} onChange={e => setDesc(e.target.value)} />

      <div className="space-y-4">
        {periods.map((period, pi) => (
          <div key={pi} className="border border-indigo-200 rounded-xl bg-white overflow-hidden">
            <div className="bg-indigo-50 px-4 py-2.5 flex items-center justify-between">
              <input className="bg-transparent text-sm font-semibold text-indigo-800 outline-none placeholder-indigo-400 flex-1 mr-3"
                value={period.label}
                onChange={e => setPeriods(p => p.map((r, i) => i === pi ? { ...r, label: e.target.value } : r))} />
              <button type="button" onClick={() => setPeriods(p => p.filter((_, i) => i !== pi))}
                className="text-xs text-red-400 hover:text-red-600">Remove</button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Assign existing modules:</p>
                <div className="flex flex-wrap gap-2">
                  {modules.length === 0
                    ? <p className="text-xs text-gray-400">No modules yet.</p>
                    : modules.map(m => {
                      const col = catColor(m.category);
                      const checked = period.selectedModuleIds.includes(m.moduleId);
                      return (
                        <label key={m.moduleId}
                          className={'flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ' +
                            (checked ? col.bg + ' ' + col.border + ' ' + col.text + ' font-medium' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50')}>
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={() => setPeriods(p => p.map((r, i) => {
                              if (i !== pi) return r;
                              const ids = r.selectedModuleIds.includes(m.moduleId)
                                ? r.selectedModuleIds.filter(x => x !== m.moduleId)
                                : [...r.selectedModuleIds, m.moduleId];
                              return { ...r, selectedModuleIds: ids };
                            }))} />
                          {checked ? '+ ' : ''}{m.title}
                        </label>
                      );
                    })}
                </div>
              </div>

              {period.inlineModules.map((im, mi) => (
                <div key={mi} className="border border-indigo-100 bg-indigo-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600 shrink-0">New module</span>
                    <input className={smallInputCls + ' flex-1'} placeholder="Title"
                      value={im.title} onChange={e => updateInlineField(pi, mi, 'title', e.target.value)} />
                    <select className={smallInputCls} value={im.category}
                      onChange={e => updateInlineField(pi, mi, 'category', e.target.value)}>
                      <option value="">Category...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {im.sections.length > 0 && (
                    <ul className="space-y-1">
                      {im.sections.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-xs text-gray-600 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
                          <span>{s.label}</span>
                          <button type="button" onClick={() => removeDraftSection(pi, mi, s.id)} className={btnDanger}>x</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!im.showBuilder ? (
                    <button type="button" onClick={() => toggleInlineBuilder(pi, mi)} className={btnGhost + ' text-xs'}>
                      + Add content to this module
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <SectionBuilder compact onSave={async (type, body) => addDraftSection(pi, mi, type, body)} />
                      <button type="button" onClick={() => toggleInlineBuilder(pi, mi)} className="text-xs text-gray-400 hover:text-gray-600">Collapse</button>
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={() => addInlineModule(pi)} className={btnGhost + ' text-xs'}>
                + Create module here
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addPeriod}
        className="border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors">
        + Add {PERIOD_LABELS[periodType]}
      </button>
      <button type="submit" disabled={saving || !title || !periods.length} className={btnPrimary}>
        {saving ? 'Creating...' : 'Create Timeline Program'}
      </button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}

// ── Packages Tab ───────────────────────────────────────────────────────────────

function PackagesTab({ programs, callAction, onRefresh }: {
  programs:   ProgramRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
  onRefresh:  () => void;
}) {
  const [title, setTitle]          = useState('');
  const [selectedIds, setSelected] = useState<string[]>([]);
  const [snapshotId, setSnapshot]  = useState('');
  const [pricing, setPricing]      = useState<'free'|'one_time'|'subscription'>('free');
  const [price, setPrice]          = useState('');
  const [result, setResult]        = useState<string | null>(null);
  const [saving, setSaving]        = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) { setResult('Select at least one program'); return; }
    setSaving(true);
    const r = await callAction('assemble_package', {
      personaSnapshotId: snapshotId, title, programIds: selectedIds,
      pricingModel: pricing, priceUsd: price ? parseFloat(price) : undefined,
    }) as { success: boolean; message: string };
    setSaving(false);
    setResult(r.message);
    if (r.success) { setTitle(''); setSelected([]); setSnapshot(''); setPrice(''); onRefresh(); }
  }

  return (
    <div className={cardCls + ' p-6'}>
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Assemble Package</h2>
      <form onSubmit={handle} className="space-y-4 max-w-lg">
        <input className={inputCls} placeholder="Package title" value={title} onChange={e => setTitle(e.target.value)} required />
        <input className={inputCls} placeholder="Persona snapshot ID" value={snapshotId} onChange={e => setSnapshot(e.target.value)} required />
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Select programs:</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50">
            {programs.length === 0
              ? <p className="text-xs text-gray-400">No programs yet.</p>
              : programs.map(pg => (
                <label key={pg.programId} className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition-colors">
                  <input type="checkbox" checked={selectedIds.includes(pg.programId)}
                    onChange={() => setSelected(p => p.includes(pg.programId) ? p.filter(x => x !== pg.programId) : [...p, pg.programId])} />
                  <span>{pg.title}</span>
                </label>
              ))}
          </div>
        </div>
        <select className={inputCls} value={pricing} onChange={e => setPricing(e.target.value as typeof pricing)}>
          <option value="free">Free</option>
          <option value="one_time">One-time payment</option>
          <option value="subscription">Subscription</option>
        </select>
        {pricing !== 'free' && (
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="Price (USD)"
            value={price} onChange={e => setPrice(e.target.value)} />
        )}
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Assembling...' : 'Assemble Package'}
        </button>
        {result && <p className="text-sm text-green-700">{result}</p>}
      </form>
    </div>
  );
}

// ── Clients Tab ────────────────────────────────────────────────────────────────

function ClientsTab({ clients, modules, callAction }: {
  clients:    ClientProfile[];
  modules:    ModuleRecord[];
  callAction: (a: string, p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [clientId, setClientId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [notes, setNotes]       = useState('');
  const [observations, setObs]  = useState('');
  const [customFields, setCustom] = useState<{ key: string; value: string }[]>([]);
  const [status, setStatus]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

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
    const r = await callAction('save_client_module_data', {
      moduleId, clientId, data: { notes, observations, customFields: cf },
    }) as { success: boolean; message: string };
    setStatus(r.success ? 'Saved' : 'Error: ' + r.message);
    setLoading(false);
  }

  return (
    <div className={cardCls + ' p-6 max-w-2xl space-y-6'}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Per-Module Client Notes</h2>
        <p className="text-xs text-gray-500 mt-1">
          This data is private to you and is not visible to the client.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Client</label>
          <select className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.name} - {c.email}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Module</label>
          <select className={inputCls} value={moduleId} onChange={e => setModuleId(e.target.value)}>
            <option value="">Select module...</option>
            {modules.map(m => <option key={m.moduleId} value={m.moduleId}>{m.title}</option>)}
          </select>
        </div>
      </div>

      <button onClick={loadData} disabled={!clientId || !moduleId || loading}
        className={btnSecondary + ' disabled:opacity-50'}>
        {loading ? 'Loading...' : 'Load Notes'}
      </button>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Notes</label>
          <textarea className={inputCls + ' h-24'} placeholder="Coaching notes..."
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Observations</label>
          <textarea className={inputCls + ' h-24'} placeholder="Progress observations..."
            value={observations} onChange={e => setObs(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500">Custom fields</label>
            <button type="button" onClick={() => setCustom(p => [...p, { key: '', value: '' }])}
              className={btnGhost + ' text-xs'}>+ Add field</button>
          </div>
          {customFields.map((f, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={smallInputCls + ' w-32'} placeholder="Field name"
                value={f.key} onChange={e => setCustom(p => p.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
              <input className={smallInputCls + ' flex-1'} placeholder="Value"
                value={f.value} onChange={e => setCustom(p => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
              <button type="button" onClick={() => setCustom(p => p.filter((_, j) => j !== i))} className={btnDanger + ' self-center'}>x</button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={saveData} disabled={!clientId || !moduleId || loading}
        className={btnPrimary + ' disabled:opacity-50'}>
        {loading ? 'Saving...' : 'Save Notes'}
      </button>
      {status && (
        <p className={'text-sm ' + (status.startsWith('Error') ? 'text-red-600' : 'text-green-700')}>{status}</p>
      )}
    </div>
  );
}
