import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

// Build all start times for a recurring series starting from `firstStartMs`,
// spaced `intervalWeeks` apart, for `occurrences` total sessions.
function buildRecurrenceDates(firstStartMs: number, intervalWeeks: number, occurrences: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < occurrences; i++) {
    dates.push(new Date(firstStartMs + i * intervalWeeks * 7 * 24 * 60 * 60 * 1000));
  }
  return dates;
}

// POST /api/appointments/book
// Public endpoint — no auth required (client is booking with the coach)
// Body: { appointmentTypeId, coachId, clientName, clientEmail, startsAt, timezone }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    appointmentTypeId: string;
    coachId:           string;
    clientName:        string;
    clientEmail:       string;
    startsAt:          string;  // ISO 8601
    timezone:          string;
  };

  const { appointmentTypeId, coachId, clientName, clientEmail, startsAt, timezone } = body;

  if (!appointmentTypeId || !coachId || !clientName || !clientEmail || !startsAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const sb = service();

  // Load appointment type
  const { data: apptType, error: typeError } = await sb
    .from('appointment_types')
    .select('*')
    .eq('appointment_type_id', appointmentTypeId)
    .eq('coach_id', coachId)
    .eq('is_active', true)
    .single();

  if (typeError || !apptType) {
    return NextResponse.json({ error: 'Appointment type not found or inactive' }, { status: 404 });
  }

  const durationMins  = apptType.duration_mins as number;
  const priceUsd      = parseFloat(String(apptType.price_usd ?? 0));
  const currency      = (apptType.currency as string) ?? 'USD';

  // Determine whether this is a recurring booking
  const recurrence = apptType.recurrence as {
    enabled: boolean; frequency: string; occurrences: number; interval_weeks: number;
  } | null;
  const isRecurring   = recurrence?.enabled === true;
  const occurrences   = isRecurring ? (recurrence!.occurrences ?? 1) : 1;
  const intervalWeeks = isRecurring ? (recurrence!.interval_weeks ?? 1) : 1;

  const firstStartMs  = new Date(startsAt).getTime();
  const startDates    = buildRecurrenceDates(firstStartMs, intervalWeeks, occurrences);
  const totalPriceUsd = priceUsd * occurrences;
  const isFree        = totalPriceUsd <= 0;

  // Check ALL slots are available before inserting anything
  const expiryWindow = new Date(Date.now() - 15 * 60_000).toISOString();
  for (const startDate of startDates) {
    const slotStart = startDate.toISOString();
    const slotEnd   = new Date(startDate.getTime() + durationMins * 60_000).toISOString();
    const { data: clash } = await sb
      .from('appointments')
      .select('appointment_id')
      .eq('coach_id', coachId)
      .or(`status.eq.confirmed,and(status.eq.pending_payment,created_at.gte.${expiryWindow})`)
      .lt('starts_at', slotEnd)
      .gt('ends_at', slotStart)
      .limit(1);

    if (clash && clash.length > 0) {
      return NextResponse.json({
        error: `Time slot ${new Date(slotStart).toLocaleDateString()} is no longer available`,
      }, { status: 409 });
    }
  }

  const expiresAt         = new Date(Date.now() + 15 * 60_000).toISOString();
  const recurrenceGroupId = isRecurring ? randomUUID() : null;

  // Insert all appointment rows
  const rows = startDates.map((startDate, idx) => {
    const slotStart = startDate.toISOString();
    const slotEnd   = new Date(startDate.getTime() + durationMins * 60_000).toISOString();
    return {
      appointment_type_id:  appointmentTypeId,
      coach_id:             coachId,
      client_name:          clientName,
      client_email:         clientEmail,
      starts_at:            slotStart,
      ends_at:              slotEnd,
      timezone:             timezone ?? 'UTC',
      status:               isFree ? 'confirmed' : 'pending_payment',
      price_usd:            priceUsd,   // per-session price stored on each row
      currency,
      payment_expires_at:   isFree ? null : expiresAt,
      confirmed_at:         isFree ? new Date().toISOString() : null,
      recurrence_group_id:  recurrenceGroupId,
      recurrence_index:     idx + 1,
    };
  });

  const { data: inserted, error: insertError } = await sb
    .from('appointments')
    .insert(rows)
    .select('appointment_id, recurrence_index')
    .order('recurrence_index', { ascending: true });

  if (insertError || !inserted?.length) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create appointment' }, { status: 500 });
  }

  const firstAppointmentId = inserted[0].appointment_id as string;
  const allAppointmentIds  = inserted.map(r => r.appointment_id as string);

  // Free appointments — confirm immediately, return success
  if (isFree) {
    return NextResponse.json({
      success:       true,
      appointmentId: firstAppointmentId,
      appointmentIds: allAppointmentIds,
      recurrenceGroupId,
      status:        'confirmed',
      occurrences,
    });
  }

  // Paid appointments — create a single Stripe Checkout Session covering all sessions
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data: coachProfile } = await sb
    .from('user_profiles')
    .select('slug')
    .eq('user_id', coachId)
    .maybeSingle();

  const coachSlug  = coachProfile?.slug as string | undefined;
  const successUrl = coachSlug
    ? `${appUrl}/coaches/${coachSlug}/book/${appointmentTypeId}/confirm?appointment_id=${firstAppointmentId}${recurrenceGroupId ? `&group=${recurrenceGroupId}` : ''}`
    : `${appUrl}/booking/confirm?appointment_id=${firstAppointmentId}`;
  const cancelUrl  = coachSlug
    ? `${appUrl}/coaches/${coachSlug}/book/${appointmentTypeId}`
    : `${appUrl}/booking`;

  // Build a descriptive product name for multi-session packages
  const productName = isRecurring
    ? `${apptType.title as string} — ${occurrences} sessions (${recurrence!.frequency})`
    : apptType.title as string;

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode:           'payment',
      customer_email: clientEmail,
      line_items: [{
        price_data: {
          currency:     currency.toLowerCase(),
          unit_amount:  Math.round(priceUsd * 100),   // per-session unit price
          product_data: {
            name:        productName,
            description: isRecurring
              ? `${occurrences} sessions · ${recurrence!.frequency} · ${durationMins} min each`
              : ((apptType.description as string | null) ?? undefined),
          },
        },
        quantity: occurrences,   // Stripe shows per-session price × count = total
      }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: {
        appointment_id:       firstAppointmentId,
        appointment_ids:      allAppointmentIds.join(','),
        recurrence_group_id:  recurrenceGroupId ?? '',
        appointment_type_id:  appointmentTypeId,
        coach_id:             coachId,
        client_email:         clientEmail,
        occurrences:          String(occurrences),
      },
      payment_intent_data: {
        metadata: {
          appointment_id:      firstAppointmentId,
          recurrence_group_id: recurrenceGroupId ?? '',
          coach_id:            coachId,
          occurrences:         String(occurrences),
        },
      },
    });

    // Stamp the Stripe session ID on all appointments in the group
    await sb.from('appointments').update({
      payment_external_id: session.id,
      payment_provider:    'stripe',
      updated_at:          new Date().toISOString(),
    }).in('appointment_id', allAppointmentIds);

    return NextResponse.json({
      success:          true,
      appointmentId:    firstAppointmentId,
      appointmentIds:   allAppointmentIds,
      recurrenceGroupId,
      status:           'pending_payment',
      checkoutUrl:      session.url,
      occurrences,
      totalPriceUsd,
    });

  } catch (e: unknown) {
    // Roll back all appointment rows so slots are freed
    await sb.from('appointments')
      .update({ status: 'expired' })
      .in('appointment_id', allAppointmentIds);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
