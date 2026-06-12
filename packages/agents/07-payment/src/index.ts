import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { supabase } from '@coaching/sdk';
import { configureBridge } from '@coaching/tools';
import { activateProgramLicense } from '@coaching/skills';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Request, Response } from 'express';

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT     = parseInt(process.env.AGENT_PAYMENT_PORT ?? '3007', 10);
const AGENT_ID = 'coaching-payment';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

function getRazorpay(): Razorpay {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveProvider(currency: string): 'stripe' | 'razorpay' {
  return currency.toUpperCase() === 'INR' ? 'razorpay' : 'stripe';
}

function idempotencyKey(userId: string, tag: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `${userId}-${tag}-${minute}`;
}

// Razorpay receipt field max is 40 chars
function razorpayReceipt(userId: string, tag: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  const suffix = `-${tag}-${minute}`;
  const maxPrefix = 40 - suffix.length;
  return `${userId.replace(/-/g, '').slice(0, maxPrefix)}${suffix}`;
}

async function persistPaymentRecord(record: {
  userId: string;
  provider: string;
  externalId: string;
  currency: string;
  amountSmallestUnit: number;
  description: string;
  status: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await supabase.from('payment_records').insert({
    user_id:              record.userId,
    provider:             record.provider,
    external_id:          record.externalId,
    currency:             record.currency.toUpperCase(),
    amount_smallest_unit: record.amountSmallestUnit,
    description:          record.description,
    status:               record.status,
    metadata:             record.metadata,
    created_at:           new Date().toISOString(),
  });
  if (error) console.error(`[${AGENT_ID}] persistPaymentRecord error:`, error.message);
}

// ── Manifest ──────────────────────────────────────────────────────────────────

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Payment',
  version:         '1.0.0',
  description:     'Multi-provider payment agent. Stripe for USD (cards, Google Pay, ACH). Razorpay for INR (UPI, net banking).',
  icon:            '💳',
  domain:          ['payment', 'billing', 'checkout'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'dashboard' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      {
        type: 'text-summary',
        id:       'pay-summary',
        title:    'Payment Overview',
        dataKey:  'summary',
      },
      {
        type:    'table',
        id:      'pay-transactions',
        title:   'Recent Transactions',
        dataKey: 'transactions',
        columns: [
          { key: 'external_id',  label: 'ID',          type: 'text' },
          { key: 'description',  label: 'Description', type: 'text' },
          { key: 'amount',       label: 'Amount',      type: 'text' },
          { key: 'currency',     label: 'Currency',    type: 'text' },
          { key: 'status',       label: 'Status',      type: 'badge',
            badgeColors: {
              succeeded: 'bg-green-100 text-green-700',
              pending:   'bg-yellow-100 text-yellow-700',
              failed:    'bg-red-100 text-red-700',
              refunded:  'bg-gray-100 text-gray-500',
            },
          },
          { key: 'created_at',   label: 'Date',        type: 'date' },
        ],
      },
      {
        type:        'action-form',
        id:          'pay-create-link',
        title:       'Create Payment Link',
        action:      'create_payment_link',
        submitLabel: 'Generate Link',
        fields: [
          { name: 'amount',      label: 'Amount (smallest unit)',  inputType: 'number', required: true },
          { name: 'currency',    label: 'Currency (USD / INR)',    inputType: 'text',   required: true },
          { name: 'description', label: 'Description',             inputType: 'text',   required: true },
          { name: 'redirectUrl', label: 'Redirect URL (optional)', inputType: 'text',   required: false },
        ],
      },
    ],
  },
  actions: [
    {
      name:        'create_payment_link',
      description: 'Create a hosted checkout URL. Routes to Stripe (USD: cards, Google Pay, ACH) or Razorpay (INR: UPI, netbanking) automatically.',
      params: {
        amount:      { type: 'number', required: true,  description: 'Amount in smallest currency unit (cents or paise). Positive integer.' },
        currency:    { type: 'string', required: true,  description: 'ISO 4217 code: USD, INR, GBP, etc.' },
        description: { type: 'string', required: true,  description: 'Human-readable label (e.g., package title)' },
        redirectUrl: { type: 'string', required: false, description: 'URL to redirect after successful payment' },
        packageId:   { type: 'string', required: false, description: 'Optional coaching package ID for metadata' },
        licenseId:   { type: 'string', required: false, description: 'Optional license ID to activate on payment success' },
      },
    },
    {
      name:        'get_payment_status',
      description: 'Get the current status of a payment by its provider-assigned external ID.',
      params: {
        externalId: { type: 'string', required: true, description: 'Stripe PaymentIntent ID (pi_...) or Razorpay order_id (order_...)' },
        provider:   { type: 'string', required: true, description: 'stripe | razorpay' },
      },
    },
    {
      name:        'list_transactions',
      description: 'List payment records for this user with optional date and pagination filters.',
      params: {
        since:  { type: 'string', required: false, description: 'ISO 8601 date — returns records on or after this date' },
        limit:  { type: 'number', required: false, description: 'Max records (default 20, max 100)' },
        offset: { type: 'number', required: false, description: 'Pagination offset' },
      },
    },
    {
      name:        'issue_refund',
      description: 'Issue a full or partial refund via the original payment provider.',
      params: {
        externalId:          { type: 'string', required: true,  description: 'Stripe PaymentIntent ID or Razorpay payment_id' },
        provider:            { type: 'string', required: true,  description: 'stripe | razorpay' },
        amountSmallestUnit:  { type: 'number', required: false, description: 'Partial refund amount in smallest unit. Omit for full refund.' },
        reason:              { type: 'string', required: false, description: 'duplicate | fraudulent | requested_by_customer' },
      },
    },
    {
      name:        'get_supported_methods',
      description: 'Returns available payment methods for a given currency.',
      params: {
        currency: { type: 'string', required: true, description: 'ISO 4217 currency code' },
      },
    },
    {
      name:        'verify_webhook',
      description: 'Manually verify a webhook payload signature (for testing). Production webhooks use /webhooks/stripe and /webhooks/razorpay.',
      params: {
        provider:  { type: 'string', required: true, description: 'stripe | razorpay' },
        payload:   { type: 'string', required: true, description: 'Raw request body as string' },
        signature: { type: 'string', required: true, description: 'stripe-signature or x-razorpay-signature header value' },
      },
    },
  ],
};

// ── onContext ─────────────────────────────────────────────────────────────────

async function onContext(req: ContextRequest) {
  const { data: records } = await supabase
    .from('payment_records')
    .select('external_id, description, amount_smallest_unit, currency, status, created_at')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const txList   = records ?? [];
  const succeeded = txList.filter((r: Record<string, unknown>) => r.status === 'succeeded').length;
  const pending   = txList.filter((r: Record<string, unknown>) => r.status === 'pending').length;

  const formatted = txList.map((r: Record<string, unknown>) => ({
    external_id: r.external_id,
    description: r.description,
    amount:      ((r.amount_smallest_unit as number) / 100).toFixed(2),
    currency:    r.currency,
    status:      r.status,
    created_at:  r.created_at,
  }));

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${succeeded} successful · ${pending} pending · ${txList.length} recent transaction(s)`,
      keyEntities: txList.slice(0, 3).map((r: Record<string, unknown>) => ({
        id:         r.external_id as string,
        type:       'payment',
        label:      `${r.description} — ${((r.amount_smallest_unit as number) / 100).toFixed(2)} ${r.currency}`,
        attributes: { status: r.status },
      })),
      recentEvents:   [],
      pendingActions: pending > 0
        ? [{ type: 'pending_payment', label: `${pending} payment(s) still pending`, priority: 'medium' as const }]
        : [],
      rawContext: { transactions: formatted },
    },
  };
}

// ── onAction ──────────────────────────────────────────────────────────────────

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {

    // ── create_payment_link ───────────────────────────────────────────────────
    case 'create_payment_link': {
      const amount      = p.amount as number;
      const currency    = (p.currency as string).toUpperCase();
      const description = p.description as string;
      const redirectUrl = (p.redirectUrl as string | undefined)
        ?? `https://${process.env.PLATFORM_DOMAIN ?? 'localhost:3000'}/payment/complete`;
      const packageId   = p.packageId as string | undefined;
      const licenseId   = p.licenseId as string | undefined;

      if (!Number.isInteger(amount) || amount <= 0) {
        return { success: false, message: 'amount must be a positive integer (smallest currency unit)' };
      }

      const provider = resolveProvider(currency);

      // ── Bypass payment if credentials not configured ──────────────────────
      const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
      const razorpayConfigured = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

      if ((provider === 'stripe' && !stripeConfigured) || (provider === 'razorpay' && !razorpayConfigured)) {
        console.warn(`[${AGENT_ID}] Payment provider ${provider} not configured. Bypassing payment.`);
        return {
          success: true,
          message: `Payment bypassed (${provider} credentials not configured)`,
          data: {
            bypassed: true,
            provider,
            paymentLinkUrl: redirectUrl,
            paymentLinkId: 'bypassed',
          },
        };
      }

      // ── Stripe (USD and other non-INR currencies) ─────────────────────────
      if (provider === 'stripe') {
        const stripe = getStripe();

        // Google Pay / Apple Pay surface automatically via Stripe's hosted checkout UI.
        const paymentMethodTypes = ['card'] as Stripe.Checkout.SessionCreateParams['payment_method_types'];

        // Checkout Session: supports inline price_data, Google Pay surfaces automatically
        // via Stripe's adaptive pricing in the hosted UI.
        const session = await stripe.checkout.sessions.create(
          {
            mode:                 'payment',
            payment_method_types: paymentMethodTypes,
            line_items: [{
              price_data: {
                currency:     currency.toLowerCase(),
                product_data: { name: description },
                unit_amount:  amount,
              },
              quantity: 1,
            }],
            success_url: redirectUrl,
            cancel_url:  redirectUrl,
            metadata:    { userId: uid, ...(packageId ? { packageId } : {}), ...(licenseId ? { licenseId } : {}) },
          },
          { idempotencyKey: idempotencyKey(uid, 'create-session') }
        );

        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? session.id);

        await persistPaymentRecord({
          userId:             uid,
          provider:           'stripe',
          externalId:         paymentIntentId,
          currency,
          amountSmallestUnit: amount,
          description,
          status:             'pending',
          metadata:           { sessionId: session.id, packageId: packageId ?? null },
        });

        return {
          success: true,
          message: 'Payment link created (Stripe)',
          data: {
            paymentLinkUrl:  session.url,
            paymentLinkId:   session.id,
            paymentIntentId,
            provider:        'stripe',
          },
        };
      }

      // ── Razorpay (INR — UPI, net banking, Indian cards) ───────────────────
      // Uses Payment Links API (rzp.io URL) — works in test mode without KYC.
      const rp = getRazorpay();

      // Create a Payment Link (not an Order) — gives a shareable rzp.io URL
      const link = await (rp as unknown as {
        paymentLink: {
          create(opts: Record<string, unknown>): Promise<{ id: string; short_url: string }>;
        };
      }).paymentLink.create({
        amount,
        currency,
        description,
        callback_url:    redirectUrl,
        callback_method: 'get',
        notes:           { userId: uid, ...(packageId ? { packageId } : {}), ...(licenseId ? { licenseId } : {}) },
      });

      await persistPaymentRecord({
        userId:             uid,
        provider:           'razorpay',
        externalId:         link.id,
        currency,
        amountSmallestUnit: amount,
        description,
        status:             'pending',
        metadata:           { paymentLinkId: link.id, shortUrl: link.short_url, packageId: packageId ?? null },
      });

      return {
        success: true,
        message: 'Payment link created (Razorpay)',
        data: {
          paymentLinkUrl: link.short_url,
          paymentLinkId:  link.id,
          provider:       'razorpay',
        },
      };
    }

    // ── get_payment_status ────────────────────────────────────────────────────
    case 'get_payment_status': {
      const externalId = p.externalId as string;
      const provider   = p.provider as string;

      if (provider === 'stripe') {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(externalId);
        return { success: true, message: 'Status retrieved', data: { status: intent.status, provider: 'stripe' } };
      }

      if (provider === 'razorpay') {
        const rp    = getRazorpay();
        const order = await rp.orders.fetch(externalId);
        return { success: true, message: 'Status retrieved', data: { status: order.status, provider: 'razorpay' } };
      }

      return { success: false, message: `Unknown provider: ${provider}` };
    }

    // ── list_transactions ─────────────────────────────────────────────────────
    case 'list_transactions': {
      const since  = p.since  as string | undefined;
      const limit  = Math.min((p.limit  as number | undefined) ?? 20, 100);
      const offset = (p.offset as number | undefined) ?? 0;

      let query = supabase
        .from('payment_records')
        .select('external_id, description, amount_smallest_unit, currency, status, provider, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (since) query = query.gte('created_at', since);

      const { data, error } = await query;
      if (error) return { success: false, message: error.message };

      return {
        success: true,
        message: 'Transactions loaded',
        data: {
          transactions: (data ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            amountDisplay: `${((r.amount_smallest_unit as number) / 100).toFixed(2)} ${r.currency}`,
          })),
          total:  (data ?? []).length,
          offset,
          limit,
        },
      };
    }

    // ── issue_refund ──────────────────────────────────────────────────────────
    case 'issue_refund': {
      const externalId         = p.externalId as string;
      const provider           = p.provider as string;
      const amountSmallestUnit = p.amountSmallestUnit as number | undefined;
      const reason             = (p.reason as string | undefined) ?? 'requested_by_customer';

      if (provider === 'stripe') {
        const stripe        = getStripe();
        const refundParams: Stripe.RefundCreateParams = {
          payment_intent: externalId,
          reason:         reason as Stripe.RefundCreateParams['reason'],
          ...(amountSmallestUnit ? { amount: amountSmallestUnit } : {}),
        };
        const refund = await stripe.refunds.create(
          refundParams,
          { idempotencyKey: idempotencyKey(uid, `refund-${externalId}`) }
        );

        await supabase.from('payment_records').update({ status: 'refunded' }).eq('external_id', externalId);

        return { success: true, message: 'Refund issued (Stripe)', data: { refundId: refund.id, status: refund.status } };
      }

      if (provider === 'razorpay') {
        const rp          = getRazorpay();
        const refundBody: Record<string, unknown> = { speed: 'normal', notes: { reason } };
        if (amountSmallestUnit) refundBody.amount = amountSmallestUnit;

        const refund = await rp.payments.refund(externalId, refundBody) as unknown as Record<string, unknown>;

        await supabase.from('payment_records').update({ status: 'refunded' }).eq('external_id', externalId);

        return { success: true, message: 'Refund issued (Razorpay)', data: { refundId: refund.id, status: refund.status } };
      }

      return { success: false, message: `Unknown provider: ${provider}` };
    }

    // ── get_supported_methods ─────────────────────────────────────────────────
    case 'get_supported_methods': {
      const currency = (p.currency as string).toUpperCase();

      if (currency === 'INR') {
        return {
          success: true,
          message: 'Supported methods for INR',
          data:    { provider: 'razorpay', currency: 'INR', methods: ['upi', 'card', 'netbanking', 'wallet'] },
        };
      }

      const methods = ['card', 'google_pay'];
      if (currency === 'USD') methods.push('us_bank_account');

      return {
        success: true,
        message: `Supported methods for ${currency}`,
        data:    { provider: 'stripe', currency, methods },
      };
    }

    // ── verify_webhook ────────────────────────────────────────────────────────
    case 'verify_webhook': {
      const provider  = p.provider  as string;
      const payload   = p.payload   as string;
      const signature = p.signature as string;

      if (provider === 'stripe') {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return { success: false, message: 'STRIPE_WEBHOOK_SECRET not configured' };
        try {
          getStripe().webhooks.constructEvent(payload, signature, secret);
          return { success: true, message: 'Stripe webhook signature valid' };
        } catch (e: unknown) {
          return { success: false, message: `Invalid Stripe signature: ${(e as Error).message}` };
        }
      }

      if (provider === 'razorpay') {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return { success: false, message: 'RAZORPAY_WEBHOOK_SECRET not configured' };
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        const valid    = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        return valid
          ? { success: true,  message: 'Razorpay webhook signature valid' }
          : { success: false, message: 'Invalid Razorpay signature' };
      }

      return { success: false, message: `Unknown provider: ${provider}` };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

// ── Server + Webhook routes ───────────────────────────────────────────────────

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// Stripe webhook — uses rawBody stored by the verify callback in createAgentServer
app.post('/webhooks/stripe', async (req: Request & { rawBody?: Buffer }, res: Response) => {
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'] as string;

  if (!secret || !signature) {
    res.status(400).json({ error: 'Missing STRIPE_WEBHOOK_SECRET or stripe-signature header' });
    return;
  }

  if (!req.rawBody) {
    res.status(400).json({ error: 'Raw body not available — webhook misconfigured' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, signature, secret);
  } catch (e: unknown) {
    console.error(`[${AGENT_ID}] Stripe webhook verification failed:`, (e as Error).message);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase.from('payment_records').update({ status: 'succeeded' }).eq('external_id', pi.id);
    if (pi.metadata?.licenseId) {
      try {
        await activateProgramLicense(pi.metadata.licenseId);
      } catch (e: unknown) {
        console.error(`[${AGENT_ID}] License activation failed for licenseId ${pi.metadata.licenseId}:`, (e as Error).message);
      }
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase.from('payment_records').update({ status: 'failed' }).eq('external_id', pi.id);
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    if (charge.payment_intent) {
      await supabase.from('payment_records').update({ status: 'refunded' }).eq('external_id', charge.payment_intent as string);
    }
  }

  res.json({ received: true });
});

// Razorpay webhook — HMAC-SHA256 over raw body
app.post('/webhooks/razorpay', async (req: Request & { rawBody?: Buffer }, res: Response) => {
  const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!secret || !signature) {
    res.status(400).json({ error: 'Missing RAZORPAY_WEBHOOK_SECRET or x-razorpay-signature header' });
    return;
  }

  if (!req.rawBody) {
    res.status(400).json({ error: 'Raw body not available — webhook misconfigured' });
    return;
  }

  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    console.error(`[${AGENT_ID}] Razorpay webhook signature mismatch`);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  const payload  = req.body as Record<string, unknown>;
  const eventType = payload.event as string;

  if (eventType === 'payment.captured') {
    const payment = (payload.payload as Record<string, unknown>).payment as { entity: { order_id: string } };
    await supabase.from('payment_records').update({ status: 'succeeded' }).eq('external_id', payment.entity.order_id);
  } else if (eventType === 'payment.failed') {
    const payment = (payload.payload as Record<string, unknown>).payment as { entity: { order_id: string } };
    await supabase.from('payment_records').update({ status: 'failed' }).eq('external_id', payment.entity.order_id);
  } else if (eventType === 'refund.processed') {
    const refund = (payload.payload as Record<string, unknown>).refund as { entity: { payment_id: string } };
    await supabase.from('payment_records').update({ status: 'refunded' }).eq('external_id', refund.entity.payment_id);
  }

  res.json({ received: true });
});

export { app as paymentApp };

if (process.env.MULTI_AGENT_MODE !== 'true') {
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}
