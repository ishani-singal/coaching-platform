import { getCoachBySlug, getBookingPages, configureBridge } from '@coaching/tools';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);
  const pages = await getBookingPages(coach.coachId).catch(() => []);

  if (pages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No booking pages available yet.</p>
      </div>
    );
  }

  const page = pages[0];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto py-12 px-8">
        <h1 className="text-2xl font-bold mb-8">Book a session with {coach.displayName}</h1>
        <iframe
          src={page.embedUrl}
          width="100%"
          height="700"
          frameBorder="0"
          title="Booking"
          className="rounded-xl border"
        />
      </div>
    </div>
  );
}
