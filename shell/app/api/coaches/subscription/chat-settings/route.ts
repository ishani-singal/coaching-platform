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
 * POST /api/coaches/subscription/chat-settings
 * Upserts the coach's chat limit settings and optionally creates/updates a Stripe Price.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    freeMessageLimit?:   number;
    freeCostLimitCents?: number;
    paidChatPriceUsd?:  number | null;
    upsellMessage?:      string;
  };

  const service = serviceClient();

  // Verify coach has Pro/Enterprise subscription to set paid price
  if (body.paidChatPriceUsd != null) {
    const { data: sub } = await service
      .from('coach_platform_subscriptions')
      .select('status, paid_chat_enabled')
      .eq('coach_id', user.id)
      .maybeSingle();

    if (!sub?.paid_chat_enabled || sub.status !== 'active') {
      return NextResponse.json(
        { error: 'Upgrade to a Pro or Enterprise plan to enable paid chat' },
        { status: 403 },
      );
    }
  }

  // Build upsert payload
  const upsertData: Record<string, unknown> = { coach_id: user.id };
  if (body.freeMessageLimit   != null) upsertData.free_message_limit   = Math.max(1, Math.min(body.freeMessageLimit, 1000));
  if (body.freeCostLimitCents != null) upsertData.free_cost_limit_cents = Math.max(1, Math.min(body.freeCostLimitCents, 10000));
  if (body.upsellMessage      != null) upsertData.upsell_message       = body.upsellMessage.slice(0, 500);

  // Handle paid chat price — create or archive Stripe Price
  if (body.paidChatPriceUsd != null) {
    if (body.paidChatPriceUsd <= 0) {
      // Disabling paid chat
      upsertData.paid_chat_price_usd = null;
      upsertData.stripe_price_id     = null;
    } else {
      const stripe = getStripe();

      // Look up coach's connected product or create one
      const { data: existing } = await service
        .from('coach_chat_settings')
        .select('stripe_price_id')
        .eq('coach_id', user.id)
        .maybeSingle();

      // Archive old price if exists
      if (existing?.stripe_price_id) {
        await stripe.prices.update(existing.stripe_price_id, { active: false }).catch(() => {});
      }

      // Get coach display name for product description
      const { data: profile } = await service
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const product = await stripe.products.create({
        name:     `Unlimited Chat — ${profile?.display_name ?? 'Coach'}`,
        metadata: { type: 'chat_unlock', coachId: user.id },
      });

      const price = await stripe.prices.create({
        product:     product.id,
        unit_amount: Math.round(body.paidChatPriceUsd * 100), // cents
        currency:    'usd',
        metadata:    { type: 'chat_unlock', coachId: user.id },
      });

      upsertData.paid_chat_price_usd = body.paidChatPriceUsd;
      upsertData.stripe_price_id     = price.id;
    }
  }

  const { error } = await service
    .from('coach_chat_settings')
    .upsert(upsertData, { onConflict: 'coach_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
