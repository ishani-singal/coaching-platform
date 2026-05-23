import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

/**
 * POST /api/coaches/[slug]/chat-unlock
 * Creates a Stripe checkout session for one-time chat unlock.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json() as { sessionId: string; successUrl?: string; cancelUrl?: string };

  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const cookieName = `chat-session-${slug}`;
  const anonToken  = req.cookies.get(cookieName)?.value;
  const sb         = await createClient();
  const service    = serviceClient();

  // Verify session ownership
  const { data: { user } } = await sb.auth.getUser();

  const { data: session } = await service
    .from('prospect_chat_sessions')
    .select('session_id, is_paid, prospect_user_id, anonymous_token, coach_id')
    .eq('session_id', body.sessionId)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.is_paid) {
    return NextResponse.json({ error: 'Chat already unlocked' }, { status: 400 });
  }

  const isOwner =
    (user && session.prospect_user_id === user.id) ||
    (anonToken && session.anonymous_token === anonToken);

  if (!isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Look up coach settings
  const { data: settings } = await service
    .from('coach_chat_settings')
    .select('paid_chat_price_usd, stripe_price_id')
    .eq('coach_id', session.coach_id)
    .maybeSingle();

  if (!settings?.paid_chat_price_usd || !settings?.stripe_price_id) {
    return NextResponse.json({ error: 'Paid chat not available for this coach' }, { status: 400 });
  }

  // Verify coach has an active Pro/Enterprise subscription with paid_chat_enabled
  const { data: platformSub } = await service
    .from('coach_platform_subscriptions')
    .select('paid_chat_enabled, status')
    .eq('coach_id', session.coach_id)
    .maybeSingle();

  if (!platformSub?.paid_chat_enabled || platformSub.status !== 'active') {
    return NextResponse.json({ error: 'Paid chat not available for this coach' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
  const successUrl = body.successUrl
    ?? `${baseUrl}/coaches/${slug}/chat-unlock?success=true&session_id=${body.sessionId}`;
  const cancelUrl  = body.cancelUrl
    ?? `${baseUrl}/coaches/${slug}/chat-unlock?cancelled=true`;

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode:        'payment',
    line_items:  [{ price: settings.stripe_price_id, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata: {
      type:         'chat_unlock',
      sessionId:    body.sessionId,
      coachSlug:    slug,
      coachId:      session.coach_id,
      prospectUser: user?.id ?? 'anonymous',
    },
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
