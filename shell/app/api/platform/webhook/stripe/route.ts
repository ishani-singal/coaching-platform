import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Stripe sends raw body so we must disable body parsing
export const dynamic = 'force-dynamic';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * POST /api/platform/webhook/stripe
 * Handles:
 *   - chat_unlock one-time payments (checkout.session.completed)
 *   - coach platform subscription changes (customer.subscription.*)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_PLATFORM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[platform-webhook] STRIPE_PLATFORM_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[platform-webhook] Signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const sb = service();

  // ── Chat unlock: one-time payment completed ──────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};

    if (metadata.type === 'chat_unlock') {
      await handleChatUnlock(sb, session, metadata);
    } else if (metadata.type === 'coach_platform_subscription') {
      // Subscription checkout completed — the subscription.updated event will do the real work
      console.log(`[platform-webhook] Coach subscription checkout completed for coach ${metadata.coachId}`);
    }
  }

  // ── Coach platform subscription created or updated ───────────────────────
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub  = event.data.object as Stripe.Subscription;
    await handleSubscriptionUpdate(sb, sub);
  }

  // ── Coach platform subscription cancelled / deleted ───────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await handleSubscriptionCancelled(sb, sub);
  }

  return NextResponse.json({ received: true });
}

// ────────────────────────────────────────────────────────────────────────────

async function handleChatUnlock(
  sb: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
) {
  const { sessionId, coachId, coachSlug, prospectUser } = metadata;
  if (!sessionId || !coachId) {
    console.error('[platform-webhook] chat_unlock missing sessionId or coachId', metadata);
    return;
  }

  const paymentIntentId = session.payment_intent as string | null;
  const amountTotal     = session.amount_total ?? 0; // cents

  // Record in payment_records
  const { data: paymentRecord } = await sb
    .from('payment_records')
    .insert({
      user_id:             prospectUser !== 'anonymous' ? prospectUser : null,
      provider:            'stripe',
      external_id:         paymentIntentId ?? session.id,
      currency:            session.currency ?? 'usd',
      amount_smallest_unit: amountTotal,
      description:         `Chat unlock — ${coachSlug}`,
      status:              'succeeded',
      metadata: {
        type:            'chat_unlock',
        coachSlug,
        coachId,
        sessionId,
        checkoutSession: session.id,
      },
      client_id: null, // prospects aren't in client_profiles
    })
    .select('id')
    .single();

  // Mark the chat session as paid
  await sb
    .from('prospect_chat_sessions')
    .update({
      is_paid:            true,
      payment_record_id:  paymentRecord?.id ?? null,
    })
    .eq('session_id', sessionId);

  // Revenue events: platform cut
  const { data: platformSub } = await sb
    .from('coach_platform_subscriptions')
    .select('platform_cut_percent')
    .eq('coach_id', coachId)
    .maybeSingle();

  const cutPct    = platformSub?.platform_cut_percent ?? 20;
  const cutAmount = (amountTotal / 100) * (cutPct / 100); // USD
  const coachAmount = (amountTotal / 100) - cutAmount;

  if (paymentRecord) {
    await sb.from('revenue_events').insert([
      {
        coach_id:   coachId,
        client_id:  null,
        role:       'delivering_coach',
        amount_usd: coachAmount,
        ancestor_depth: 0,
      },
      {
        coach_id:   coachId,
        client_id:  null,
        role:       'platform',
        amount_usd: cutAmount,
        ancestor_depth: 0,
      },
    ]);
  }

  // Audit log
  await sb.from('chat_audit_log').insert({
    actor_id:      prospectUser !== 'anonymous' ? prospectUser : null,
    action:        'payment.unlock',
    resource_type: 'prospect_chat_session',
    resource_id:   sessionId,
    coach_id:      coachId,
    metadata: {
      amountCents: amountTotal,
      provider:    'stripe',
    },
  });

  console.log(`[platform-webhook] Chat unlocked — sessionId=${sessionId} coach=${coachSlug} amount=${amountTotal}¢`);
}

async function handleSubscriptionUpdate(
  sb: ReturnType<typeof createServiceClient>,
  sub: Stripe.Subscription,
) {
  const customerId = sub.customer as string;

  // Find coach by stripe_customer_id
  const { data: existing } = await sb
    .from('coach_platform_subscriptions')
    .select('coach_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  // Determine plan tier from price metadata
  const price    = sub.items.data[0]?.price;
  const tier     = price?.metadata?.plan_tier ?? inferTierFromPriceId(price?.id ?? '');
  const isActive = sub.status === 'active' || sub.status === 'trialing';

  const upsertData = {
    stripe_subscription_id: sub.id,
    stripe_customer_id:     customerId,
    plan_tier:              tier,
    status:                 sub.status,
    paid_chat_enabled:      isActive && tier !== 'starter',
    current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
  };

  if (existing) {
    await sb
      .from('coach_platform_subscriptions')
      .update(upsertData)
      .eq('coach_id', existing.coach_id);
  } else {
    // Try to find coach by Stripe customer metadata
    const stripe   = getStripe();
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const coachId  = customer.metadata?.coachId;
    if (coachId) {
      await sb.from('coach_platform_subscriptions').upsert(
        { ...upsertData, coach_id: coachId },
        { onConflict: 'coach_id' },
      );
    } else {
      console.warn(`[platform-webhook] Cannot find coachId for Stripe customer ${customerId}`);
    }
  }

  console.log(`[platform-webhook] Subscription updated — customer=${customerId} status=${sub.status} tier=${tier}`);
}

async function handleSubscriptionCancelled(
  sb: ReturnType<typeof createServiceClient>,
  sub: Stripe.Subscription,
) {
  const customerId = sub.customer as string;
  await sb
    .from('coach_platform_subscriptions')
    .update({
      status:            'cancelled',
      paid_chat_enabled: false,
    })
    .eq('stripe_customer_id', customerId);

  console.log(`[platform-webhook] Subscription cancelled — customer=${customerId}`);
}

function inferTierFromPriceId(priceId: string): string {
  const proId  = process.env.STRIPE_COACH_PRO_PRICE_ID ?? '';
  const entId  = process.env.STRIPE_COACH_ENTERPRISE_PRICE_ID ?? '';
  if (priceId === proId)  return 'pro';
  if (priceId === entId)  return 'enterprise';
  return 'starter';
}
