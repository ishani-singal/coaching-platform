'use client';
import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import type { ModuleSectionSpec } from '@coaching/sdk';

type Props = {
  sections: ModuleSectionSpec[];
  enrollmentId?: string;
  token?: string;
  /** When true, completion actions update local state only — no network requests fired */
  previewMode?: boolean;
};

export default function ClientPortalModule({ sections, enrollmentId: _enrollmentId, token, previewMode }: Props) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');

  async function markComplete(sectionId: string, responseData?: Record<string, unknown>) {
    if (previewMode) {
      setCompleted(prev => new Set([...prev, sectionId]));
      return;
    }

    const r = await fetch(`/portal/${token}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, responseData }),
    }).then(r => r.json()) as { success: boolean; moduleComplete?: boolean; packageComplete?: boolean };

    if (r.success) {
      setCompleted(prev => new Set([...prev, sectionId]));
      if (r.packageComplete) {
        setStatus('🎉 You have completed the program!');
      } else if (r.moduleComplete) {
        setStatus('✓ Module complete! Next module unlocked.');
        setTimeout(() => router.refresh(), 1500);
      }
    }
  }

  return (
    <div className="space-y-6">
      {status && <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">{status}</div>}

      {sections.map((section, si) => (
        <div key={`${si}-${section.sectionId}`} className={`bg-white rounded-xl shadow p-6 ${completed.has(section.sectionId) ? 'opacity-60' : ''}`}>
          {section.contentType === 'text' && (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{(section.body.content as string) ?? ''}</p>
              <button onClick={() => markComplete(section.sectionId)} disabled={completed.has(section.sectionId)} className="mt-4 text-sm text-indigo-600 hover:underline disabled:opacity-40">
                Mark as read ✓
              </button>
            </div>
          )}

          {section.contentType === 'video' && (
            <div>
              <div className="aspect-video w-full mb-4">
                <iframe
                  src={section.body.embedUrl as string}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <button onClick={() => markComplete(section.sectionId)} disabled={completed.has(section.sectionId)} className="text-sm text-indigo-600 hover:underline disabled:opacity-40">
                Mark as watched ✓
              </button>
            </div>
          )}

          {section.contentType === 'pdf' && (
            <div>
              <a href={section.body.url as string} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">
                📄 Download PDF
              </a>
              <button onClick={() => markComplete(section.sectionId)} disabled={completed.has(section.sectionId)} className="ml-4 text-sm text-indigo-600 hover:underline disabled:opacity-40">
                Mark as read ✓
              </button>
            </div>
          )}

          {section.contentType === 'task' && (
            <TaskSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'check_in' && (
            <CheckInSection
              section={section}
              value={responses[section.sectionId] ?? ''}
              onChange={v => setResponses(r => ({ ...r, [section.sectionId]: v }))}
              onSubmit={() => markComplete(section.sectionId, { response: responses[section.sectionId] })}
              disabled={completed.has(section.sectionId)}
            />
          )}

          {section.contentType === 'quiz' && (
            <QuizSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'long_form_qa' && (
            <LongFormQASection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'single_choice' && (
            <SingleChoiceSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'multi_choice' && (
            <MultiChoiceSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'match_following' && (
            <MatchFollowingSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'rating' && (
            <RatingSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'image_embed' && (
            <ImageEmbedSection section={section} onComplete={() => markComplete(section.sectionId)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'file' && (
            <FileSection section={section} onComplete={() => markComplete(section.sectionId)} disabled={completed.has(section.sectionId)} />
          )}

          {section.contentType === 'assignment' && (
            <AssignmentSection section={section} onComplete={data => markComplete(section.sectionId, data)} disabled={completed.has(section.sectionId)} />
          )}
        </div>
      ))}
    </div>
  );
}

function TaskSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const items = (section.body.items as string[]) ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) { setChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; }); }

  return (
    <div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} disabled={disabled} className="h-4 w-4" />
            <span className={checked.has(i) ? 'line-through text-gray-400' : ''}>{item}</span>
          </li>
        ))}
      </ul>
      {checked.size === items.length && items.length > 0 && (
        <button onClick={() => onComplete({ checkedItems: items.length })} disabled={disabled} className="mt-4 text-sm text-indigo-600 hover:underline disabled:opacity-40">
          Complete task ✓
        </button>
      )}
    </div>
  );
}

function CheckInSection({ section, value, onChange, onSubmit, disabled }: { section: ModuleSectionSpec; value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean }) {
  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">{(section.body.prompt as string) ?? 'How are you feeling?'}</p>
      <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder="Your response…" />
      <button onClick={onSubmit} disabled={disabled || !value.trim()} className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40">
        Submit
      </button>
    </div>
  );
}

function QuizSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const questions = (section.body.questions as { question: string; options: string[]; correctIndex: number }[]) ?? [];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0);
    setSubmitted(true);
    onComplete({ score, total: questions.length });
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} className="mb-4">
          <p className="text-sm font-medium mb-2">{q.question}</p>
          <div className="space-y-1">
            {q.options.map((opt, j) => (
              <label key={j} className={`flex items-center gap-2 text-sm cursor-pointer ${submitted && j === q.correctIndex ? 'text-green-600 font-medium' : submitted && answers[i] === j && j !== q.correctIndex ? 'text-red-500' : ''}`}>
                <input type="radio" name={`q${i}`} value={j} checked={answers[i] === j} onChange={() => setAnswers(a => ({ ...a, [i]: j }))} disabled={submitted || disabled} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      {!submitted && (
        <button onClick={submit} disabled={Object.keys(answers).length < questions.length || disabled} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40">
          Submit Quiz
        </button>
      )}
      {submitted && <p className="text-sm text-green-700 font-medium mt-2">Quiz complete! ✓</p>}
    </div>
  );
}

function LongFormQASection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const questions = (section.body.questions as { question: string }[]) ?? [];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = questions.length > 0 && questions.every((_, i) => (answers[i] ?? '').trim().length > 0);

  function submit() {
    setSubmitted(true);
    onComplete({ answers: questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' })) });
  }

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <div key={i}>
          <p className="text-sm font-medium text-gray-800 mb-2">{q.question}</p>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={answers[i] ?? ''}
            onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
            disabled={submitted || disabled}
            placeholder="Your answer…"
          />
        </div>
      ))}
      {!submitted && (
        <button onClick={submit} disabled={!allAnswered || disabled} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40">
          Submit answers
        </button>
      )}
      {submitted && <p className="text-sm text-green-700 font-medium">Answers submitted ✓</p>}
    </div>
  );
}

function SingleChoiceSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const question = (section.body.question as string) ?? '';
  const options  = (section.body.options as string[]) ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function choose(i: number) {
    if (submitted || disabled) return;
    setSelected(i);
    setSubmitted(true);
    onComplete({ selectedIndex: i, selectedOption: options[i] });
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-3">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => choose(i)}
            disabled={submitted || disabled}
            className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors disabled:cursor-not-allowed
              ${selected === i ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'}`}
          >
            {opt}
          </button>
        ))}
      </div>
      {submitted && <p className="text-sm text-green-700 font-medium mt-3">Response recorded ✓</p>}
    </div>
  );
}

function MultiChoiceSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const question = (section.body.question as string) ?? '';
  const options  = (section.body.options as string[]) ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  function toggle(i: number) { setChecked(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; }); }

  function submit() {
    setSubmitted(true);
    onComplete({ selectedIndices: [...checked], selectedOptions: [...checked].map(i => options[i]) });
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-3">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <label key={i} className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked.has(i)}
              onChange={() => toggle(i)}
              disabled={submitted || disabled}
              className="h-4 w-4 rounded"
            />
            <span className={checked.has(i) ? 'text-indigo-700 font-medium' : 'text-gray-700'}>{opt}</span>
          </label>
        ))}
      </div>
      {!submitted && (
        <button onClick={submit} disabled={checked.size === 0 || disabled} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40">
          Submit
        </button>
      )}
      {submitted && <p className="text-sm text-green-700 font-medium mt-3">Response recorded ✓</p>}
    </div>
  );
}

function MatchFollowingSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const pairs = (section.body.pairs as { left: string; right: string }[]) ?? [];
  const rightOptions = pairs.map(p => p.right).sort(() => Math.random() - 0.5);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allSelected = pairs.length > 0 && pairs.every((_, i) => selections[i] !== undefined);

  function submit() {
    const correct = pairs.filter((p, i) => selections[i] === p.right).length;
    setSubmitted(true);
    onComplete({ selections, correct, total: pairs.length });
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-3">Match each item on the left with the correct answer:</p>
      <div className="space-y-3">
        {pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 w-1/2 shrink-0">{pair.left}</span>
            <select
              title={`Match for: ${pair.left}`}
              value={selections[i] ?? ''}
              onChange={e => setSelections(s => ({ ...s, [i]: e.target.value }))}
              disabled={submitted || disabled}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300
                ${submitted ? (selections[i] === pair.right ? 'border-green-400 bg-green-50 text-green-800' : 'border-red-400 bg-red-50 text-red-700') : 'border-gray-200'}`}
            >
              <option value="">— Select —</option>
              {rightOptions.map((opt, j) => <option key={j} value={opt}>{opt}</option>)}
            </select>
          </div>
        ))}
      </div>
      {!submitted && (
        <button onClick={submit} disabled={!allSelected || disabled} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40">
          Check answers
        </button>
      )}
      {submitted && (
        <p className="text-sm text-green-700 font-medium mt-3">
          {pairs.filter((p, i) => selections[i] === p.right).length}/{pairs.length} correct ✓
        </p>
      )}
    </div>
  );
}

function RatingSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  const question  = (section.body.question as string) ?? '';
  const maxRating = (section.body.maxRating as number) ?? 5;
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function choose(rating: number) {
    if (submitted || disabled) return;
    setSelected(rating);
    setSubmitted(true);
    onComplete({ rating, maxRating });
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-3">{question}</p>
      <div className="flex gap-2">
        {Array.from({ length: maxRating }, (_, i) => i + 1).map(rating => (
          <button
            key={rating}
            type="button"
            onClick={() => choose(rating)}
            disabled={submitted || disabled}
            className={`w-10 h-10 rounded-full border text-sm font-semibold transition-colors disabled:cursor-not-allowed
              ${selected !== null && rating <= selected
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'}`}
          >
            {rating}
          </button>
        ))}
      </div>
      {submitted && <p className="text-sm text-green-700 font-medium mt-3">Rating recorded ✓</p>}
    </div>
  );
}

function ImageEmbedSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: () => void; disabled: boolean }) {
  const imageUrl = (section.body.imageUrl as string) ?? '';
  const caption  = (section.body.caption as string) ?? '';

  return (
    <div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={caption || 'Module image'} className="w-full rounded-lg object-contain max-h-96 mb-3" />
      )}
      {caption && <p className="text-sm text-gray-500 italic mb-3">{caption}</p>}
      <button onClick={onComplete} disabled={disabled} className="text-sm text-indigo-600 hover:underline disabled:opacity-40">
        Mark as viewed ✓
      </button>
    </div>
  );
}

function AssignmentSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: (d: Record<string, unknown>) => void; disabled: boolean }) {
  type SubItem = { type: string; body: Record<string, unknown> };
  const title        = (section.body.title as string) ?? '';
  const instructions = (section.body.instructions as string) ?? '';
  const items        = (section.body.items as SubItem[]) ?? [];
  const [responses, setResponses] = useState<Record<number, Record<string, unknown>>>({});
  const [submitted, setSubmitted] = useState(false);

  function recordResponse(idx: number, data: Record<string, unknown>) {
    setResponses(r => ({ ...r, [idx]: data }));
  }

  function submit() {
    setSubmitted(true);
    onComplete({ title, responses });
  }

  // Inline sub-section renderer (reuses existing section components via a fake section spec)
  function renderItem(item: SubItem, idx: number) {
    const fakeSec = { sectionId: `sub-${idx}`, sectionOrder: idx, contentType: item.type as ModuleSectionSpec['contentType'], body: item.body };
    const done = !!responses[idx];
    return (
      <div key={idx} className={`bg-gray-50 border border-gray-100 rounded-xl p-4 ${done ? 'opacity-60' : ''}`}>
        {item.type === 'text' && (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{(item.body.content as string) ?? ''}</p>
            {!done && <button type="button" onClick={() => recordResponse(idx, {})} className="mt-2 text-sm text-indigo-600 hover:underline">Mark as read ✓</button>}
          </div>
        )}
        {item.type === 'video' && (
          <div>
            <div className="aspect-video w-full mb-3">
              <iframe src={item.body.embedUrl as string} className="w-full h-full rounded-lg" allow="autoplay; fullscreen" title="Video" />
            </div>
            {(item.body.caption as string) && <p className="text-xs text-gray-500 mb-2">{item.body.caption as string}</p>}
            {!done && <button type="button" onClick={() => recordResponse(idx, {})} className="text-sm text-indigo-600 hover:underline">Mark as watched ✓</button>}
          </div>
        )}
        {item.type === 'image_embed' && (
          <div>
            {(item.body.imageUrl as string) && <img src={item.body.imageUrl as string} alt={(item.body.caption as string) || ''} className="w-full rounded-lg object-contain max-h-72 mb-2" />}
            {(item.body.caption as string) && <p className="text-xs text-gray-500 italic mb-2">{item.body.caption as string}</p>}
            {!done && <button type="button" onClick={() => recordResponse(idx, {})} className="text-sm text-indigo-600 hover:underline">Mark as viewed ✓</button>}
          </div>
        )}
        {item.type === 'file' && (
          <div className="flex items-center gap-3">
            <a href={item.body.fileUrl as string} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">📎 {(item.body.fileName as string) || 'Download file'}</a>
            {!done && <button type="button" onClick={() => recordResponse(idx, {})} className="text-sm text-indigo-600 hover:underline">Mark as read ✓</button>}
          </div>
        )}
        {item.type === 'long_form_qa'    && <LongFormQASection    section={fakeSec} onComplete={d => recordResponse(idx, d)} disabled={done || disabled} />}
        {item.type === 'single_choice'   && <SingleChoiceSection  section={fakeSec} onComplete={d => recordResponse(idx, d)} disabled={done || disabled} />}
        {item.type === 'multi_choice'    && <MultiChoiceSection   section={fakeSec} onComplete={d => recordResponse(idx, d)} disabled={done || disabled} />}
        {item.type === 'match_following' && <MatchFollowingSection section={fakeSec} onComplete={d => recordResponse(idx, d)} disabled={done || disabled} />}
        {item.type === 'rating'          && <RatingSection         section={fakeSec} onComplete={d => recordResponse(idx, d)} disabled={done || disabled} />}
        {done && <p className="text-xs text-green-600 font-medium mt-1">✓ Done</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && <h3 className="text-base font-semibold text-gray-800">{title}</h3>}
      {instructions && <p className="text-sm text-gray-700 whitespace-pre-wrap">{instructions}</p>}
      {items.length > 0 && (
        <div className="divide-y divide-gray-200">
          {items.map((item, idx) => (
            <Fragment key={idx}>
              <div className="py-3">
                {renderItem(item, idx)}
              </div>
            </Fragment>
          ))}
        </div>
      )}
      {!submitted && (
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
        >
          Submit Assignment
        </button>
      )}
      {submitted && <p className="text-sm text-green-700 font-medium">Assignment submitted ✓</p>}
    </div>
  );
}

function FileSection({ section, onComplete, disabled }: { section: ModuleSectionSpec; onComplete: () => void; disabled: boolean }) {
  const fileUrl  = (section.body.fileUrl as string) ?? '';
  const fileName = (section.body.fileName as string) ?? 'Download file';

  return (
    <div className="flex items-center gap-4">
      <a href={fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm">
        📎 {fileName}
      </a>
      <button onClick={onComplete} disabled={disabled} className="text-sm text-indigo-600 hover:underline disabled:opacity-40">
        Mark as read ✓
      </button>
    </div>
  );
}

