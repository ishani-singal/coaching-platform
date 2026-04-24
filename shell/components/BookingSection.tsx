import type { BookingPage } from '@coaching/sdk';
import Link from 'next/link';

type Props = { bookingPages: BookingPage[]; coachSlug: string };

export default function BookingSection({ bookingPages, coachSlug }: Props) {
  if (bookingPages.length === 0) return null;

  return (
    <section className="py-16 px-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">Book a Session</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookingPages.map(page => (
          <div key={page.eventTypeId} className="border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-lg mb-4">Session</h3>
            <Link
              href={`/coaches/${coachSlug}/book`}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm inline-block"
            >
              Book Now
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
