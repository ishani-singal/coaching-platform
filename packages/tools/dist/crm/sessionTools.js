"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSession = recordSession;
exports.updateSessionStatus = updateSessionStatus;
exports.getSessionHistory = getSessionHistory;
exports.getUpcomingSessions = getUpcomingSessions;
const sdk_1 = require("@coaching/sdk");
async function recordSession(coachId, clientId, enrollmentId, bookingRef, paymentRef, scheduledAt, durationMins = 60) {
    const { data, error } = await sdk_1.supabase
        .from('coaching_sessions')
        .insert({
        coach_id: coachId,
        client_id: clientId,
        enrollment_id: enrollmentId,
        booking_ref: bookingRef,
        payment_ref: paymentRef,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: durationMins,
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapSession(data);
}
async function updateSessionStatus(sessionId, status, notes) {
    const update = { status };
    if (notes)
        update.session_notes = notes;
    await sdk_1.supabase.from('coaching_sessions').update(update).eq('session_id', sessionId);
}
async function getSessionHistory(coachId, clientId) {
    let q = sdk_1.supabase.from('coaching_sessions').select('*').eq('coach_id', coachId).order('scheduled_at', { ascending: false });
    if (clientId)
        q = q.eq('client_id', clientId);
    const { data } = await q;
    return (data ?? []).map(mapSession);
}
async function getUpcomingSessions(coachId) {
    const { data } = await sdk_1.supabase
        .from('coaching_sessions')
        .select('*')
        .eq('coach_id', coachId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at');
    return (data ?? []).map(mapSession);
}
function mapSession(row) {
    return {
        sessionId: row.session_id,
        coachId: row.coach_id,
        clientId: row.client_id,
        enrollmentId: row.enrollment_id,
        bookingRef: row.booking_ref,
        paymentRef: row.payment_ref,
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes,
        status: row.status,
        sessionNotes: row.session_notes,
        createdAt: row.created_at,
    };
}
//# sourceMappingURL=sessionTools.js.map