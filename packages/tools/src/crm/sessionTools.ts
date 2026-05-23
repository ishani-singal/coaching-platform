import { supabase } from '@coaching/sdk';
import { CoachingSession, SessionStatus } from '@coaching/sdk';

export async function recordSession(
  coachId: string,
  clientId: string,
  bookingRef: string,
  paymentRef: string | null,
  scheduledAt: Date,
  durationMins = 60
): Promise<CoachingSession> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .insert({
      coach_id:         coachId,
      client_id:        clientId,
      booking_ref:      bookingRef,
      payment_ref:      paymentRef,
      scheduled_at:     scheduledAt.toISOString(),
      duration_minutes: durationMins,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSession(data);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus, notes?: string): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (notes) update.session_notes = notes;
  await supabase.from('coaching_sessions').update(update).eq('session_id', sessionId);
}

export async function getSessionHistory(coachId: string, clientId?: string): Promise<CoachingSession[]> {
  let q = supabase.from('coaching_sessions').select('*').eq('coach_id', coachId).order('scheduled_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data } = await q;
  return (data ?? []).map(mapSession);
}

export async function getUpcomingSessions(coachId: string): Promise<CoachingSession[]> {
  const { data } = await supabase
    .from('coaching_sessions')
    .select('*')
    .eq('coach_id', coachId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at');
  return (data ?? []).map(mapSession);
}

function mapSession(row: Record<string, unknown>): CoachingSession {
  return {
    sessionId:       row.session_id as string,
    coachId:         row.coach_id as string,
    clientId:        row.client_id as string,
    bookingRef:      row.booking_ref as string | undefined,
    paymentRef:      row.payment_ref as string | undefined,
    scheduledAt:     row.scheduled_at as string,
    durationMinutes: row.duration_minutes as number,
    status:          row.status as SessionStatus,
    sessionNotes:    row.session_notes as string | undefined,
    createdAt:       row.created_at as string,
  };
}
