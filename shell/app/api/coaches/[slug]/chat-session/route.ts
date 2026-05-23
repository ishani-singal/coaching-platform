import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

// Service-role client for session writes (bypasses RLS for anonymous sessions)
function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function hashIp(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? 'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * POST /api/coaches/[slug]/chat-session
 * Create or retrieve a prospect chat session.
 * Returns session state including spend counters and free limits.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = await createClient();
  const service = serviceClient();

  // Look up the coach
  const { data: coach } = await service
    .from('user_profiles')
    .select('user_id')
    .eq('slug', slug)
    .single();

  if (!coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // Get free limits for this coach
  const { data: settings } = await service
    .from('coach_chat_settings')
    .select('free_message_limit, free_cost_limit_cents, paid_chat_price_usd, paid_chat_enabled:paid_chat_price_usd')
    .eq('coach_id', coach.user_id)
    .maybeSingle();

  const limits = {
    freeMessageLimit:   settings?.free_message_limit    ?? 10,
    freeCostLimitCents: settings?.free_cost_limit_cents ?? 50,
    paidChatPriceUsd:   settings?.paid_chat_price_usd   ?? null,
  };

  // Check if coach has paid chat enabled via platform subscription
  const { data: platformSub } = await service
    .from('coach_platform_subscriptions')
    .select('paid_chat_enabled')
    .eq('coach_id', coach.user_id)
    .maybeSingle();

  const paidChatEnabled = !!(platformSub?.paid_chat_enabled && settings?.paid_chat_price_usd);

  // Check authenticated user first
  const { data: { user } } = await sb.auth.getUser();

  if (user) {
    // Authenticated — find or create session by user + coach
    const { data: existing } = await service
      .from('prospect_chat_sessions')
      .select('session_id, message_count, estimated_cost_cents, is_paid, chat_rag_enabled, consent_given_at')
      .eq('coach_id', coach.user_id)
      .eq('prospect_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        sessionId:            existing.session_id,
        messageCount:         existing.message_count,
        estimatedCostCents:   existing.estimated_cost_cents,
        isPaid:               existing.is_paid,
        chatRagEnabled:       existing.chat_rag_enabled,
        isAuthenticated:      true,
        paidChatEnabled,
        limits,
      });
    }

    // Create new authenticated session
    const { data: created, error } = await service
      .from('prospect_chat_sessions')
      .insert({
        coach_id:         coach.user_id,
        prospect_user_id: user.id,
        consent_given_at: new Date().toISOString(),
      })
      .select('session_id')
      .single();

    if (error || !created) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Audit log
    await service.from('chat_audit_log').insert({
      actor_id:      user.id,
      action:        'session.create',
      resource_type: 'prospect_chat_session',
      resource_id:   created.session_id,
      coach_id:      coach.user_id,
      ip_hash:       hashIp(req),
    });

    return NextResponse.json({
      sessionId:          created.session_id,
      messageCount:       0,
      estimatedCostCents: 0,
      isPaid:             false,
      chatRagEnabled:     false,
      isAuthenticated:    true,
      paidChatEnabled,
      limits,
    });
  }

  // Anonymous — use httpOnly cookie token
  const body = await req.json().catch(() => ({})) as { consentGiven?: boolean };
  const cookieName = `chat-session-${slug}`;
  const existingToken = req.cookies.get(cookieName)?.value;

  if (existingToken) {
    // Validate token format (must be UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(existingToken)) {
      // Invalid token — clear it and create fresh
      const res = NextResponse.json({ error: 'Invalid session token' }, { status: 400 });
      res.cookies.delete(cookieName);
      return res;
    }

    const { data: existing } = await service
      .from('prospect_chat_sessions')
      .select('session_id, message_count, estimated_cost_cents, is_paid, chat_rag_enabled, consent_given_at')
      .eq('anonymous_token', existingToken)
      .eq('coach_id', coach.user_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        sessionId:          existing.session_id,
        messageCount:       existing.message_count,
        estimatedCostCents: existing.estimated_cost_cents,
        isPaid:             existing.is_paid,
        chatRagEnabled:     existing.chat_rag_enabled,
        isAuthenticated:    false,
        paidChatEnabled,
        limits,
      });
    }
    // Token exists in cookie but session not in DB — fall through to create
  }

  // Create new anonymous session
  const token = randomUUID(); // server-generated, not client-supplied
  const { data: created, error } = await service
    .from('prospect_chat_sessions')
    .insert({
      coach_id:         coach.user_id,
      anonymous_token:  token,
      consent_given_at: body.consentGiven ? new Date().toISOString() : null,
    })
    .select('session_id')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  await service.from('chat_audit_log').insert({
    actor_id:      null,
    action:        'session.create',
    resource_type: 'prospect_chat_session',
    resource_id:   created.session_id,
    coach_id:      coach.user_id,
    ip_hash:       hashIp(req),
    metadata:      { anonymous: true },
  });

  const res = NextResponse.json({
    sessionId:          created.session_id,
    messageCount:       0,
    estimatedCostCents: 0,
    isPaid:             false,
    chatRagEnabled:     false,
    isAuthenticated:    false,
    paidChatEnabled,
    limits,
  });

  // Set httpOnly cookie — 30 days expiry for anonymous sessions
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     `/coaches/${slug}`,
  });

  return res;
}

/**
 * GET /api/coaches/[slug]/chat-session?sessionId=...
 * Returns current spend state (for spend indicator updates).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const cookieName = `chat-session-${slug}`;
  const anonToken  = req.cookies.get(cookieName)?.value;
  const sb         = await createClient();
  const service    = serviceClient();

  const { data: { user } } = await sb.auth.getUser();

  // Verify ownership — must be either the authenticated user's session or match the cookie token
  const { data: session } = await service
    .from('prospect_chat_sessions')
    .select('session_id, message_count, estimated_cost_cents, is_paid, prospect_user_id, anonymous_token')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const isOwner =
    (user && session.prospect_user_id === user.id) ||
    (anonToken && session.anonymous_token === anonToken);

  if (!isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return NextResponse.json({
    messageCount:       session.message_count,
    estimatedCostCents: session.estimated_cost_cents,
    isPaid:             session.is_paid,
  });
}
