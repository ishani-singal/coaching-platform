import { getEnrollmentByToken, configureBridge } from '@coaching/tools';
import { getModuleView } from '@coaching/skills';
import { supabase } from '@coaching/sdk';
import ClientPortalModule from '@/components/ClientPortalModule';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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

  // Gate: paid packages require a completed payment before granting portal access
  if (pkg.priceUsd && pkg.priceUsd > 0) {
    const { data: paidRecord } = await supabase
      .from('payment_records')
      .select('external_id')
      .eq('client_id', e.clientId)
      .eq('status', 'succeeded')
      .limit(1);

    if (!paidRecord || paidRecord.length === 0) {
      redirect(`/portal/${token}/pay`);
    }
  }

  // Self-heal: if current_module_id was never seeded (stale dist or pre-fix enrollment),
  // resolve the first module of the package now and persist it.
  if (!e.currentModuleId) {
    const { data: firstProgram } = await supabase
      .from('package_programs')
      .select('program_id')
      .eq('package_id', e.packageId)
      .order('display_order')
      .limit(1)
      .maybeSingle();

    if (firstProgram) {
      const { data: firstModule } = await supabase
        .from('program_modules')
        .select('module_id')
        .eq('program_id', firstProgram.program_id)
        .order('display_order')
        .limit(1)
        .maybeSingle();

      if (firstModule) {
        await supabase
          .from('client_profiles')
          .update({ current_module_id: firstModule.module_id })
          .eq('client_id', e.clientId);

        e.currentModuleId = firstModule.module_id as string;
      }
    }
  }

  let sections: Awaited<ReturnType<typeof getModuleView>> = [];
  if (e.currentModuleId) {
    sections = await getModuleView(e.clientId, e.currentModuleId).catch(() => []);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{pkg.title}</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome, {e.name}</p>
          {e.completedAt && (
            <div className="mt-2 text-green-600 font-medium">🎉 Program completed!</div>
          )}
        </div>

        {sections.length > 0 ? (
          <ClientPortalModule
            sections={sections}
            enrollmentId={e.clientId}
            token={token}
          />
        ) : (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            {e.currentModuleId ? 'Loading module…' : 'No module assigned yet. Your coach will update this soon.'}
          </div>
        )}

        {e.enrollmentType === 'trainee' && e.completedAt && (
          <div className="mt-8 bg-indigo-50 rounded-xl p-6 space-y-3">
            <h2 className="font-bold text-lg text-center">You&apos;ve completed the program!</h2>
            {pkg.certificateUrl && (
              <a href={pkg.certificateUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm">
                ⬇ Download Certificate
              </a>
            )}
            <Link href={`/portal/${token}/graduate`}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm">
              🎓 Create your Skillz Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
