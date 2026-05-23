
import { getCoachBySlug } from '@coaching/tools';
import { getLatestPersonaSnapshot } from '@coaching/tools';
import { configureBridge } from '@coaching/tools';
import PersonaChatWidget from '@/components/PersonaChatWidget';
import PublicComponentRenderer from '@/components/WebsiteBuilder/PublicComponentRenderer';

// Configure bridge for server-side calls
configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function CoachHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const coach = await getCoachBySlug(slug);
  const snapshot = await getLatestPersonaSnapshot(coach.userId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Published website components */}
      <PublicComponentRenderer config={coach.websitePublished} />

      {/* Full-screen chat */}
      <div className="flex-1 flex flex-col px-4 pt-6 pb-4 min-h-0 overflow-hidden">
        <h2 className="text-2xl font-bold text-center mb-1">Chat with {coach.displayName}</h2>
        {snapshot && (
          <p className="text-center text-gray-500 text-sm mb-4">{snapshot.summary}</p>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PersonaChatWidget coachSlug={slug} />
        </div>
      </div>
    </div>
  );
}
