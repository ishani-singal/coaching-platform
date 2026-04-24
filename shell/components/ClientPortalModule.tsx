'use client';
import { useState } from 'react';
import type { ModuleSectionSpec } from '@coaching/sdk';

type Props = {
  sections: ModuleSectionSpec[];
  enrollmentId: string;
  token: string;
};

export default function ClientPortalModule({ sections, enrollmentId, token }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');

  async function markComplete(sectionId: string, responseData?: Record<string, unknown>) {
    const r = await fetch(`/portal/${token}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, responseData }),
    }).then(r => r.json()) as { success: boolean; moduleComplete?: boolean; packageComplete?: boolean };

    if (r.success) {
      setCompleted(prev => new Set([...prev, sectionId]));
      if (r.packageComplete) setStatus('🎉 You have completed the program!');
      else if (r.moduleComplete) setStatus('✓ Module complete! Next module unlocked.');
    }
  }

  return (
    <div className="space-y-6">
      {status && <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">{status}</div>}

      {sections.map(section => (
        <div key={section.sectionId} className={`bg-white rounded-xl shadow p-6 ${completed.has(section.sectionId) ? 'opacity-60' : ''}`}>
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
                  src={`https://www.youtube.com/embed/${extractVideoId(section.body.url as string)}`}
                  className="w-full h-full rounded-lg"
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

function extractVideoId(url: string): string {
  const m = url?.match(/[?&]v=([A-Za-z0-9_-]+)/) ?? url?.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? '';
}
