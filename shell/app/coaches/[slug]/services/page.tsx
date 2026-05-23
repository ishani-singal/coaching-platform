import { getCoachBySlug, getPublishedPackagesForCoach, configureBridge } from '@coaching/tools';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [publishedPackages, { count: apptTypesCount }] = await Promise.all([
    getPublishedPackagesForCoach(coach.userId),
    supabase.from('appointment_types').select('*', { count: 'exact', head: true }).eq('coach_id', coach.userId).eq('is_active', true),
  ]);
  const hasBooking = (apptTypesCount ?? 0) > 0;

  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 to-white py-16 px-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Programs &amp; Services</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Explore everything {coach.displayName} has to offer.
        </p>
      </section>

      {publishedPackages.length > 0 ? (
        <section className="py-16 px-8 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {publishedPackages.map(pkg => (
              <div key={pkg.packageId} className="border rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col">
                {pkg.coverImageUrl && (
                  <img src={pkg.coverImageUrl} alt={pkg.title} className="w-full rounded-lg mb-4 aspect-video object-cover" />
                )}
                <h3 className="font-bold text-lg mb-2">{pkg.title}</h3>
                {pkg.description && <p className="text-gray-600 text-sm mb-4 flex-1">{pkg.description}</p>}
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-bold text-indigo-600">
                    {pkg.pricingModel === 'free' ? 'Free' : pkg.priceUsd ? `$${pkg.priceUsd}` : 'Contact'}
                  </span>
                  <Link
                    href={`/coaches/${slug}/${pkg.packageId}`}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="py-24 px-8 text-center text-gray-400">
          <p>No programs published yet. Check back soon.</p>
        </section>
      )}

      {hasBooking && (
        <section className="py-12 px-8 max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-semibold mb-4">Book a Session</h2>
          <Link
            href={`/coaches/${slug}/book`}
            className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Book with {coach.displayName}
          </Link>
        </section>
      )}
    </div>
  );
}
