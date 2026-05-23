import { BookingPage, PaymentLink } from '@coaching/sdk';
import {
  createBookingPage,
  getBookingContext,
  createPaymentLink,
  recordSession,
  getCoachBySlug,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function createSessionPage(
  userId: string,
  coachId: string,
  clientId: string | null,
  config: { title: string; durationMins: number; description?: string; priceUsd?: number }
): Promise<BookingPage> {
  const page = await createBookingPage(userId, config);

  if (clientId) {
    await recordSession(coachId, clientId, page.eventTypeId, null, new Date());
  }

  return page;
}

export async function syncBookingsToSessions(userId: string, coachId: string): Promise<void> {
  const ctx = await getBookingContext(userId);
  const bookings = (ctx.snapshot.rawContext?.bookings ?? []) as Array<Record<string, unknown>>;

  for (const booking of bookings) {
    const ref = booking.id as string;
    const { data: existing } = await supabase
      .from('coaching_sessions')
      .select('session_id')
      .eq('booking_ref', ref)
      .eq('coach_id', coachId)
      .maybeSingle();

    if (!existing) {
      await recordSession(
        coachId,
        (booking.clientId as string) ?? coachId,
        ref,
        null,
        new Date((booking.startTime as string) ?? Date.now())
      );
    }
  }
}

export async function createPackagePaymentLink(userId: string, coachId: string, packageId: string): Promise<PaymentLink> {
  const { data: pkg } = await supabase
    .from('packages')
    .select('title, price_usd, currencies')
    .eq('package_id', packageId)
    .single();

  const coach = await getCoachBySlug(coachId).catch(() => null);
  const redirectUrl = `https://${process.env.PLATFORM_DOMAIN}/coaches/${coach?.slug ?? coachId}/${packageId}/enroll`;

  const currency       = ((pkg?.currencies as string[] | undefined)?.[0]) ?? 'USD';
  const amountSmallest = Math.round(((pkg?.price_usd as number) ?? 0) * 100);

  return createPaymentLink(userId, {
    amount:      amountSmallest,
    currency,
    description: (pkg?.title as string) ?? 'Coaching package',
    redirectUrl,
    packageId,
  });
}
