import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const answered = req.nextUrl.searchParams.get('answered');

  let query = supabase
    .from('coach_questions')
    .select('question_id, question, person_type, coaching_type, answer, answered_at, created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false });

  if (answered === 'false') query = query.is('answer', null);
  if (answered === 'true')  query = query.not('answer', 'is', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
