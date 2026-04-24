"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingPage = createBookingPage;
exports.getBookingPages = getBookingPages;
exports.cancelBooking = cancelBooking;
exports.getBookingContext = getBookingContext;
const agentBridge_1 = require("./agentBridge");
// Cal.com API key lives inside the skillz customer-booking agent — NOT in this repo
const ID = 'customer-booking';
async function createBookingPage(userId, params) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'create_booking_page', params);
    return r.data;
}
async function getBookingPages(userId) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'list_booking_pages', {});
    return (r.data?.pages ?? []);
}
async function cancelBooking(userId, bookingRef, reason) {
    return (0, agentBridge_1.callAgentAction)(ID, userId, 'cancel_booking', { bookingRef, reason });
}
async function getBookingContext(userId) {
    return (0, agentBridge_1.callAgentContext)(ID, userId);
}
//# sourceMappingURL=bookingBridge.js.map