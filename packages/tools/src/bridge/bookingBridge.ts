import { callAgentAction, callAgentContext } from './agentBridge';
import { BookingPage } from '@coaching/sdk';

// Cal.com API key lives inside the skillz customer-booking agent — NOT in this repo
const ID = 'customer-booking';

export async function createBookingPage(userId: string, params: {
  title: string; durationMins: number; description?: string; priceUsd?: number;
}): Promise<BookingPage> {
  const r = await callAgentAction(ID, userId, 'create_booking_page', params);
  return r.data as BookingPage;
}

export async function getBookingPages(userId: string): Promise<BookingPage[]> {
  const r = await callAgentAction(ID, userId, 'list_booking_pages', {});
  return (r.data?.pages ?? []) as BookingPage[];
}

export async function cancelBooking(userId: string, bookingRef: string, reason?: string) {
  return callAgentAction(ID, userId, 'cancel_booking', { bookingRef, reason });
}

export async function getBookingContext(userId: string) {
  return callAgentContext(ID, userId);
}
