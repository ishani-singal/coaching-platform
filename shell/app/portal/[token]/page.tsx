import { getEnrollmentByToken, configureBridge } from '@coaching/tools';
import { getModuleView } from '@coaching/skills';
import ClientPortalModule from '@/components/ClientPortalModule';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let enrollment: Awaited<ReturnType<typeof getEnrollmentByToken>> | null = null;
  try {
    enrollment = await getEnrollmentByToken(token);
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid or expired portal link.</p>
      </div>
    );
  }

  const { client, pkg, ...e } = enrollment!;

  let sections: Awaited<ReturnType<typeof getModuleView>> = [];
  if (e.currentModuleId) {
    sections = await getModuleView(e.enrollmentId, e.currentModuleId).catch(() => []);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{pkg.title}</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome, {client.name}</p>
          {e.completedAt && (
            <div className="mt-2 text-green-600 font-medium">🎉 Program completed!</div>
          )}
        </div>

        {sections.length > 0 ? (
          <ClientPortalModule
            sections={sections}
            enrollmentId={e.enrollmentId}
            token={token}
          />
        ) : (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            {e.currentModuleId ? 'Loading module…' : 'No module assigned yet. Your coach will update this soon.'}
          </div>
        )}

        {e.enrollmentType === 'trainee' && e.completedAt && (
          <div className="mt-8 bg-indigo-50 rounded-xl p-6 text-center">
            <h2 className="font-bold text-lg mb-2">Ready to become a coach?</h2>
            <Link href={`/portal/${token}/graduate`} className="bg-indigo-600 text-white px-6 py-2 rounded-lg">
              Set Up My Coach Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
