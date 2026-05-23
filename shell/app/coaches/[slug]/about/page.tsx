import { getCoachBySlug, getLatestPersonaSnapshot, configureBridge } from '@coaching/tools';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [snapshot, { count: apptTypesCount }] = await Promise.all([
    getLatestPersonaSnapshot(coach.userId),
    supabase.from('appointment_types').select('*', { count: 'exact', head: true }).eq('coach_id', coach.userId).eq('is_active', true),
  ]);
  const hasBooking = (apptTypesCount ?? 0) > 0;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-50 to-white py-24 px-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{coach.displayName}</h1>
        {snapshot && (
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">{snapshot.summary}</p>
        )}
      </section>

      {/* Bio */}
      {coach.bio && (
        <section className="py-16 px-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">About</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{coach.bio}</p>
        </section>
      )}

      {/* CTA */}
      <section className="py-12 px-8 max-w-2xl mx-auto text-center">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/coaches/${slug}`}
            className="border border-indigo-300 text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            Chat with {coach.displayName}
          </Link>
          {hasBooking && (
            <Link
              href={`/coaches/${slug}/book`}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Book a Session
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
