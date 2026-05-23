import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Stripe sends raw body so we must disable body parsing
export const dynamic = 'force-dynamic';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// POST /api/appointments/webhook/stripe
// Verifies Stripe signature, then confirms or expires appointments based on payment outcome.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_APPOINTMENTS_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[appt-webhook] STRIPE_APPOINTMENTS_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: unknown) {
    console.error('[appt-webhook] Signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const sb = service();

  if (event.type === 'checkout.session.completed') {
    const session       = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointment_id;
    if (!appointmentId) return NextResponse.json({ received: true });

    const paymentIntentId     = session.payment_intent as string | null;
    const recurrenceGroupId   = session.metadata?.recurrence_group_id || null;
    // appointment_ids is a comma-separated list when recurring
    const appointmentIdsRaw   = session.metadata?.appointment_ids ?? appointmentId;
    const appointmentIds      = appointmentIdsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);

    const now = new Date().toISOString();
    await sb.from('appointments').update({
      status:              'confirmed',
      payment_external_id: paymentIntentId ?? session.id,
      payment_provider:    'stripe',
      confirmed_at:        now,
      updated_at:          now,
    }).in('appointment_id', appointmentIds);

    // Send confirmation email to client (shows all session dates for recurring)
    const { data: appts } = await sb
      .from('appointments')
      .select('client_name, client_email, starts_at, ends_at, timezone, appointment_types(title)')
      .in('appointment_id', appointmentIds)
      .order('starts_at', { ascending: true });

    const firstAppt  = (appts ?? [])[0] as Record<string, unknown> | undefined;
    if (firstAppt && process.env.RESEND_API_KEY) {
      const resend    = new Resend(process.env.RESEND_API_KEY);
      const typeTitle = (firstAppt.appointment_types as Record<string, unknown> | null)?.title ?? 'Session';
      const tz        = (firstAppt.timezone as string) ?? 'UTC';
      const isRecurring = appointmentIds.length > 1;

      const dateLines = (appts ?? []).map((a, i) => {
        const d = new Date((a as Record<string,unknown>).starts_at as string).toLocaleString('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' });
        return `<li>Session ${i + 1}: ${d}</li>`;
      }).join('');

      const subject = isRecurring
        ? `Booking confirmed: ${typeTitle} (${appointmentIds.length} sessions)`
        : `Booking confirmed: ${typeTitle}`;

      const body = isRecurring
        ? `<p>Hi ${firstAppt.client_name},</p>
           <p>Your recurring booking for <strong>${typeTitle}</strong> has been confirmed.</p>
           <p><strong>Your ${appointmentIds.length} sessions:</strong></p>
           <ul>${dateLines}</ul>
           <p>All times in ${tz}. We look forward to working with you!</p>`
        : `<p>Hi ${firstAppt.client_name},</p>
           <p>Your booking for <strong>${typeTitle}</strong> has been confirmed.</p>
           <p><strong>Date &amp; Time:</strong> ${new Date(firstAppt.starts_at as string).toLocaleString('en-US', { timeZone: tz })} (${tz})</p>
           <p>We look forward to seeing you!</p>`;

      await resend.emails.send({
        from:    process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
        to:      firstAppt.client_email as string,
        subject,
        html:    body,
      }).catch(e => console.error('[appt-webhook] Email failed:', e));

      void recurrenceGroupId; // referenced in metadata, used for confirmation page URL
    }
  } else if (event.type === 'checkout.session.expired') {
    const session             = event.data.object as Stripe.Checkout.Session;
    const appointmentIdsRaw   = session.metadata?.appointment_ids ?? session.metadata?.appointment_id;
    if (!appointmentIdsRaw) return NextResponse.json({ received: true });

    const appointmentIds = appointmentIdsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);

    // Only expire rows that are still pending_payment
    await sb.from('appointments')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('appointment_id', appointmentIds)
      .eq('status', 'pending_payment');
  }

  return NextResponse.json({ received: true });
}
