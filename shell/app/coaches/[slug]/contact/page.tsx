import { getCoachBySlug, configureBridge } from '@coaching/tools';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { count } = await supabase
    .from('appointment_types')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coach.userId)
    .eq('is_active', true);
  const hasBooking = (count ?? 0) > 0;

  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 to-white py-16 px-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Contact Us</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Get in touch with {coach.displayName}.
        </p>
      </section>

      <section className="py-16 px-8 max-w-xl mx-auto space-y-8">
        {/* Chat CTA */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 px-8 py-8 text-center">
          <h2 className="text-xl font-semibold text-indigo-900 mb-2">Ask a Question</h2>
          <p className="text-indigo-600 text-sm mb-5">
            Chat directly with {coach.displayName}&apos;s AI assistant for a quick response.
          </p>
          <Link
            href={`/coaches/${slug}`}
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Start a Chat
          </Link>
        </div>

        {/* Booking CTA */}
        {hasBooking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Book a Session</h2>
            <p className="text-gray-500 text-sm mb-5">
              Schedule a 1-on-1 session with {coach.displayName}.
            </p>
            <Link
              href={`/coaches/${slug}/book`}
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Book Now
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
