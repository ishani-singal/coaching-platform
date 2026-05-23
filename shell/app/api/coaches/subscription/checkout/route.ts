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

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  pro:        process.env.STRIPE_COACH_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_COACH_ENTERPRISE_PRICE_ID,
};

/**
 * POST /api/coaches/subscription/checkout
 * Creates a Stripe subscription checkout session for the coach's Skillz plan.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { planTier: 'pro' | 'enterprise'; successUrl?: string; cancelUrl?: string };

  if (!body.planTier || !PLAN_PRICE_IDS[body.planTier]) {
    return NextResponse.json({ error: 'Invalid plan tier or price not configured' }, { status: 400 });
  }

  const priceId  = PLAN_PRICE_IDS[body.planTier]!;
  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
  const successUrl = body.successUrl ?? `${baseUrl}/settings/subscription?success=true`;
  const cancelUrl  = body.cancelUrl  ?? `${baseUrl}/settings/subscription?cancelled=true`;

  const service  = serviceClient();
  const stripe   = getStripe();

  // Look up or create Stripe customer for this coach
  const { data: existing } = await service
    .from('coach_platform_subscriptions')
    .select('stripe_customer_id')
    .eq('coach_id', user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id;
  if (!customerId) {
    // Get coach email from user_profiles or auth metadata
    const { data: profile } = await service
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const customer = await stripe.customers.create({
      email:    user.email,
      name:     profile?.display_name ?? user.email,
      metadata: { coachId: user.id },
    });
    customerId = customer.id;
  }

  const checkout = await stripe.checkout.sessions.create({
    mode:        'subscription',
    customer:    customerId,
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata: {
      type:     'coach_platform_subscription',
      coachId:  user.id,
      planTier: body.planTier,
    },
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
