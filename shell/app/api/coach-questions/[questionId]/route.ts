import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { upsertQAAnswer } from '@coaching/tools';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { questionId } = await params;
  const { answer } = await req.json() as { answer: string };

  if (!answer?.trim()) {
    return NextResponse.json({ success: false, message: 'answer is required' }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from('coach_questions')
    .select('question_id, question')
    .eq('question_id', questionId)
    .eq('coach_id', user.id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from('coach_questions')
    .update({ answer: answer.trim(), answered_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .eq('coach_id', user.id);

  if (updateErr) {
    return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
  }

  // Embed Q&A into Pinecone and mark embedded_at (fire-and-forget)
  upsertQAAnswer(user.id, questionId, row.question, answer.trim())
    .then(() =>
      supabase
        .from('coach_questions')
        .update({ embedded_at: new Date().toISOString() })
        .eq('question_id', questionId)
    )
    .catch(() => {});

  return NextResponse.json({ success: true });
}
