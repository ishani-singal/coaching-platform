import { callAgentAction, callAgentContext } from './agentBridge';
import { CalendarEvent } from '@coaching/sdk';

const ID = 'calendar-aggregator';

export async function getUpcomingEvents(userId: string, days = 7): Promise<CalendarEvent[]> {
  const r = await callAgentAction(ID, userId, 'get_events', { days });
  return (r.data?.events ?? []) as CalendarEvent[];
}

export async function createCalendarEvent(userId: string, params: {
  title: string; startTime: string; endTime: string; description?: string; attendeeEmail?: string;
}) {
  return callAgentAction(ID, userId, 'create_event', params);
}

export async function checkAvailability(userId: string, startTime: string, endTime: string): Promise<boolean> {
  const r = await callAgentAction(ID, userId, 'check_availability', { startTime, endTime });
  return (r.data?.available ?? false) as boolean;
}

export async function getCalendarContext(userId: string) {
  return callAgentContext(ID, userId);
}
