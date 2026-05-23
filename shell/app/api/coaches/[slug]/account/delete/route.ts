import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * DELETE /api/coaches/[slug]/account/delete
 * Permanently erases all chat sessions for this user+coach.
 * GDPR Art. 17 (right to erasure) / CCPA right to delete.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const service = serviceClient();

  const { data: coach } = await service
    .from('user_profiles')
    .select('user_id')
    .eq('slug', slug)
    .single();

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });

  // Audit before deletion (must come before the DELETE)
  const { data: sessions } = await service
    .from('prospect_chat_sessions')
    .select('session_id')
    .eq('coach_id', coach.user_id)
    .eq('prospect_user_id', user.id);

  const sessionIds = (sessions ?? []).map(s => s.session_id as string);

  await service.from('chat_audit_log').insert({
    actor_id:      user.id,
    action:        'account.delete',
    resource_type: 'prospect_chat_session',
    coach_id:      coach.user_id,
    metadata:      { deletedSessionCount: sessionIds.length },
  });

  // Hard-delete all sessions
  if (sessionIds.length > 0) {
    await service
      .from('prospect_chat_sessions')
      .delete()
      .in('session_id', sessionIds);
  }

  return NextResponse.json({ deleted: true, sessionCount: sessionIds.length });
}
