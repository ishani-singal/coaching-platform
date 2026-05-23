import { getCoachBySlug, configureBridge } from '@coaching/tools';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 to-white py-16 px-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Events</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Upcoming events and workshops with {coach.displayName}.
        </p>
      </section>

      <section className="py-24 px-8 max-w-2xl mx-auto text-center">
        <div className="bg-gray-50 rounded-2xl border border-gray-100 px-10 py-16">
          <p className="text-4xl mb-4">📅</p>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Coming Soon</h2>
          <p className="text-gray-500 text-sm">Events and workshops will be listed here.</p>
        </div>
      </section>
    </div>
  );
}
