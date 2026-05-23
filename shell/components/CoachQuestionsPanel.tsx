'use client';
import { useState, useEffect, useCallback } from 'react';

interface CoachQuestion {
  question_id:   string;
  question:      string;
  person_type:   'client' | 'trainee' | 'prospect' | null;
  coaching_type: string | null;
  answer:        string | null;
  answered_at:   string | null;
  created_at:    string;
}

export default function CoachQuestionsPanel() {
  const [questions, setQuestions]       = useState<CoachQuestion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [answerDraft, setAnswerDraft]   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]     = useState<Record<string, boolean>>({});
  const [showAnswered, setShowAnswered] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/coach-questions');
      const json = await res.json() as { success: boolean; data?: CoachQuestion[] };
      if (json.success && json.data) setQuestions(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAnswer(q: CoachQuestion) {
    const answer = answerDraft[q.question_id]?.trim();
    if (!answer) return;
    setSubmitting(prev => ({ ...prev, [q.question_id]: true }));
    try {
      const res = await fetch(`/api/coach-questions/${q.question_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      if (res.ok) {
        setQuestions(prev =>
          prev.map(item =>
            item.question_id === q.question_id
              ? { ...item, answer, answered_at: new Date().toISOString() }
              : item
          )
        );
        setAnswerDraft(prev => { const n = { ...prev }; delete n[q.question_id]; return n; });
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(prev => { const n = { ...prev }; delete n[q.question_id]; return n; });
    }
  }

  const unanswered = questions.filter(q => !q.answer);
  const answered   = questions.filter(q => !!q.answer);

  function personTypeLabel(type: CoachQuestion['person_type']) {
    if (type === 'trainee') return 'Trainee';
    if (type === 'client')  return 'Client';
    return 'Prospect';
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-5 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Questions from Conversations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Your answers improve AI chat responses</p>
          </div>
          {unanswered.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5 font-medium">
              {unanswered.length} new
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading && (
          <p className="text-xs text-gray-400 text-center mt-8">Loading…</p>
        )}

        {!loading && unanswered.length === 0 && answered.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            <p className="text-3xl mb-3">💬</p>
            <p className="font-medium text-gray-500">No questions yet</p>
            <p className="text-xs mt-1">Questions appear here as clients and trainees chat with your AI persona.</p>
          </div>
        )}

        {unanswered.map(q => (
          <div key={q.question_id} className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <div className="flex items-start gap-2 mb-2">
              <p className="text-sm font-medium text-gray-800 leading-snug flex-1">{q.question}</p>
            </div>
            <div className="flex gap-1.5 mb-3">
              {q.person_type && (
                <span className="text-xs bg-white border border-indigo-200 text-indigo-600 rounded-full px-2 py-0.5">
                  {personTypeLabel(q.person_type)}
                </span>
              )}
              {q.coaching_type && (
                <span className="text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5 capitalize">
                  {q.coaching_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <textarea
              className="w-full resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[68px] bg-white"
              placeholder="Share your experience or perspective…"
              value={answerDraft[q.question_id] ?? ''}
              onChange={e => setAnswerDraft(prev => ({ ...prev, [q.question_id]: e.target.value }))}
              disabled={submitting[q.question_id]}
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                disabled={submitting[q.question_id] || !answerDraft[q.question_id]?.trim()}
                onClick={() => handleAnswer(q)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {submitting[q.question_id] ? 'Saving…' : 'Save Answer'}
              </button>
            </div>
          </div>
        ))}

        {answered.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAnswered(s => !s)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2"
            >
              <span>{showAnswered ? '▾' : '▸'}</span>
              {answered.length} answered question{answered.length !== 1 ? 's' : ''}
            </button>
            {showAnswered && answered.map(q => (
              <div key={q.question_id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-2 opacity-70">
                <div className="flex gap-1.5 mb-1.5">
                  {q.person_type && (
                    <span className="text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5">
                      {personTypeLabel(q.person_type)}
                    </span>
                  )}
                  {q.coaching_type && (
                    <span className="text-xs bg-white border border-gray-200 text-gray-400 rounded-full px-2 py-0.5 capitalize">
                      {q.coaching_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700 leading-snug">{q.question}</p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{q.answer}</p>
                <p className="text-xs text-gray-300 mt-1">
                  {q.answered_at ? new Date(q.answered_at).toLocaleDateString() : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
