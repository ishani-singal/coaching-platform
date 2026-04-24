"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionPage = createSessionPage;
exports.syncBookingsToSessions = syncBookingsToSessions;
exports.createPackagePaymentLink = createPackagePaymentLink;
const tools_1 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function createSessionPage(userId, coachId, clientId, enrollmentId, config) {
    const page = await (0, tools_1.createBookingPage)(userId, config);
    if (clientId) {
        await (0, tools_1.recordSession)(coachId, clientId, enrollmentId, page.eventTypeId, null, new Date());
    }
    return page;
}
async function syncBookingsToSessions(userId, coachId) {
    const ctx = await (0, tools_1.getBookingContext)(userId);
    const bookings = (ctx.snapshot.rawContext?.bookings ?? []);
    for (const booking of bookings) {
        const ref = booking.id;
        const { data: existing } = await sdk_1.supabase
            .from('coaching_sessions')
            .select('session_id')
            .eq('booking_ref', ref)
            .eq('coach_id', coachId)
            .maybeSingle();
        if (!existing) {
            await (0, tools_1.recordSession)(coachId, booking.clientId ?? coachId, null, ref, null, new Date(booking.startTime ?? Date.now()));
        }
    }
}
async function createPackagePaymentLink(userId, coachId, packageId) {
    const { data: pkg } = await sdk_1.supabase
        .from('coaching_packages')
        .select('title, price_usd')
        .eq('package_id', packageId)
        .single();
    const coach = await (0, tools_1.getCoachBySlug)(coachId).catch(() => null);
    const redirectUrl = `https://${process.env.PLATFORM_DOMAIN}/coaches/${coach?.slug ?? coachId}/${packageId}/enroll`;
    return (0, tools_1.createPaymentLink)(userId, {
        amountUsd: pkg?.price_usd ?? 0,
        description: pkg?.title ?? 'Coaching package',
        redirectUrl,
    });
}
//# sourceMappingURL=bookingSkill.js.map