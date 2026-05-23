import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PAYMENT_AGENT_URL = process.env.SKILLZ_AGENT_COACHING_PAYMENT_URL ?? 'http://localhost:3007';
const AUTH_TOKEN        = process.env.SKILLZ_AGENT_AUTH_TOKEN ?? '';

// POST /api/appointments/cancel
// Can be called by:
//   - Authenticated coach (cancels any of their appointments)
//   - Unauthenticated client (must supply appointmentId + clientEmail for verification)
// Body: { appointmentId, reason?, cancelledBy? }  — optionally clientEmail for client-side cancels
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    appointmentId: string;
    reason?:       string;
    cancelledBy?:  'coach' | 'client';
    clientEmail?:  string;
  };

  const { appointmentId, reason, cancelledBy, clientEmail } = body;
  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
  }

  const sb = service();

  // Load the appointment
  const { data: appt, error: apptError } = await sb
    .from('appointments')
    .select('*, appointment_types(cancellation_policy, title)')
    .eq('appointment_id', appointmentId)
    .single();

  if (apptError || !appt) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
  }

  if (['cancelled', 'expired', 'completed'].includes(appt.status as string)) {
    return NextResponse.json({ error: `Appointment is already ${appt.status}` }, { status: 400 });
  }

  // Authorization: coach must be authenticated, or client provides matching email
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isCoach  = user?.id === (appt.coach_id as string);
  const isClient = !user && clientEmail && clientEmail.toLowerCase() === (appt.client_email as string).toLowerCase();

  if (!isCoach && !isClient) {
    return NextResponse.json({ error: 'Unauthorised to cancel this appointment' }, { status: 403 });
  }

  const actor = isCoach ? 'coach' : 'client';

  // Determine refund eligibility from cancellation policy
  const policy = ((appt as Record<string, unknown>).appointment_types as Record<string, unknown>)
    ?.cancellation_policy as { hours_notice: number; refund_pct: number } | null;

  const now         = Date.now();
  const startsAt    = new Date(appt.starts_at as string).getTime();
  const hoursUntil  = (startsAt - now) / 3_600_000;
  const hoursNotice = policy?.hours_notice ?? 24;
  const refundPct   = policy?.refund_pct   ?? 0;

  const isEligibleForRefund =
    hoursUntil >= hoursNotice &&
    refundPct > 0 &&
    appt.payment_external_id != null &&
    appt.status === 'confirmed';

  let refundIssued    = false;
  let refundAmountUsd = 0;

  if (isEligibleForRefund) {
    const priceUsd    = parseFloat(String(appt.price_usd ?? 0));
    refundAmountUsd   = Math.round(priceUsd * refundPct) / 100;
    const amountCents = Math.round(refundAmountUsd * 100);

    if (amountCents > 0) {
      try {
        const refundRes = await fetch(`${PAYMENT_AGENT_URL}/action`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            userId: appt.coach_id,
            config: {},
            action: 'issue_refund',
            params: {
              externalId:         appt.payment_external_id,
              provider:           appt.payment_provider ?? 'stripe',
              amountSmallestUnit: amountCents,
              reason:             'requested_by_customer',
            },
          }),
        });
        const refundData = await refundRes.json() as { success: boolean };
        refundIssued = refundData.success;
      } catch (e) {
        console.error('[appointments/cancel] Refund call failed:', (e as Error).message);
      }
    }
  }

  // Update appointment to cancelled
  await sb.from('appointments').update({
    status:              'cancelled',
    cancelled_at:        new Date().toISOString(),
    cancellation_reason: reason ?? null,
    cancelled_by:        cancelledBy ?? actor,
    refund_issued:       refundIssued,
    refund_amount_usd:   refundIssued ? refundAmountUsd : null,
    updated_at:          new Date().toISOString(),
  }).eq('appointment_id', appointmentId);

  return NextResponse.json({
    success:         true,
    refundIssued,
    refundAmountUsd: refundIssued ? refundAmountUsd : 0,
    message:         refundIssued
      ? `Appointment cancelled. A refund of $${refundAmountUsd.toFixed(2)} has been issued.`
      : isEligibleForRefund
        ? 'Appointment cancelled. Refund processing failed — please contact support.'
        : `Appointment cancelled. No refund applies (policy requires ${hoursNotice}h notice; ${hoursUntil < hoursNotice ? 'cancelled within notice window' : 'no payment was made'}).`,
  });
}

// GET /api/appointments/cancel?appointmentId=&coachId= — coach fetches appointments list
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coachId = searchParams.get('coachId');
  const status  = searchParams.get('status'); // optional filter

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const effectiveCoachId = coachId ?? user.id;
  if (user.id !== effectiveCoachId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });
  }

  const sb = service();
  let query = sb
    .from('appointments')
    .select('*, appointment_types(title, duration_mins, price_usd, currency)')
    .eq('coach_id', effectiveCoachId)
    .order('starts_at', { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ appointments: data ?? [] });
}
