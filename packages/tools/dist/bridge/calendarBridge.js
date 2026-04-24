"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpcomingEvents = getUpcomingEvents;
exports.createCalendarEvent = createCalendarEvent;
exports.checkAvailability = checkAvailability;
exports.getCalendarContext = getCalendarContext;
const agentBridge_1 = require("./agentBridge");
const ID = 'calendar-aggregator';
async function getUpcomingEvents(userId, days = 7) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'get_events', { days });
    return (r.data?.events ?? []);
}
async function createCalendarEvent(userId, params) {
    return (0, agentBridge_1.callAgentAction)(ID, userId, 'create_event', params);
}
async function checkAvailability(userId, startTime, endTime) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'check_availability', { startTime, endTime });
    return (r.data?.available ?? false);
}
async function getCalendarContext(userId) {
    return (0, agentBridge_1.callAgentContext)(ID, userId);
}
//# sourceMappingURL=calendarBridge.js.map