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
 * POST /api/coaches/[slug]/account/migrate-session
 * Transfers an anonymous chat session to the now-authenticated user.
 * Called immediately after sign-up or log-in.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({})) as { consentGiven?: boolean };

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const cookieName = `chat-session-${slug}`;
  const anonToken  = req.cookies.get(cookieName)?.value;

  if (!anonToken) {
    // No anonymous session to migrate — that's fine
    return NextResponse.json({ migrated: false, reason: 'no_anonymous_session' });
  }

  const service = serviceClient();

  // Look up coach
  const { data: coach } = await service
    .from('user_profiles')
    .select('user_id')
    .eq('slug', slug)
    .single();

  if (!coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // Find the anonymous session
  const { data: anonSession } = await service
    .from('prospect_chat_sessions')
    .select('session_id, prospect_user_id')
    .eq('anonymous_token', anonToken)
    .eq('coach_id', coach.user_id)
    .maybeSingle();

  if (!anonSession) {
    return NextResponse.json({ migrated: false, reason: 'session_not_found' });
  }

  // If already linked to a different user, don't overwrite
  if (anonSession.prospect_user_id && anonSession.prospect_user_id !== user.id) {
    return NextResponse.json({ migrated: false, reason: 'session_owned_by_other' });
  }

  // Migrate: link to user, clear anonymous token
  const updatePayload: Record<string, unknown> = {
    prospect_user_id: user.id,
    anonymous_token:  null,
  };
  if (body.consentGiven) {
    updatePayload.consent_given_at = new Date().toISOString();
  }

  const { error } = await service
    .from('prospect_chat_sessions')
    .update(updatePayload)
    .eq('session_id', anonSession.session_id);

  if (error) {
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }

  // Audit
  await service.from('chat_audit_log').insert({
    actor_id:      user.id,
    action:        'session.migrate',
    resource_type: 'prospect_chat_session',
    resource_id:   anonSession.session_id,
    coach_id:      coach.user_id,
    metadata:      { from: 'anonymous', to: 'authenticated' },
  });

  // Clear the anonymous cookie by expiring it
  const res = NextResponse.json({ migrated: true, sessionId: anonSession.session_id });
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     `/coaches/${slug}`,
  });

  return res;
}
