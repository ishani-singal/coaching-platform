import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge } from '@coaching/tools';
import { Resend } from 'resend';
import {
  enrollClient, getCoachDashboard, getCoachEnrollmentStats, completeSection, getModuleView,
} from '@coaching/skills';
import { completeEnrollment, getEnrollmentWithProgress } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_PROGRAM_RUNNER_PORT ?? '3002', 10);
const AGENT_ID = 'coaching-program-runner';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Program Runner',
  version:         '1.0.0',
  description:     'Deliver coaching programs to clients and trainees. Manage enrollments and progress.',
  icon:            '🎯',
  domain:          ['delivery', 'enrollment', 'coaching'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'dashboard' },
  actions: [
    { name: 'enroll_client',       description: 'Enroll a client in a package',     params: { packageId: { type: 'string', required: true, description: '' }, clientName: { type: 'string', required: true, description: '' }, clientEmail: { type: 'string', required: true, description: '' }, clientPhone: { type: 'string', required: false, description: '' }, goals: { type: 'string', required: false, description: '' }, background: { type: 'string', required: false, description: '' }, enrollmentType: { type: 'string', required: true, description: 'client | trainee', enum: ['client', 'trainee'] } } },
    { name: 'get_dashboard',       description: 'Get coach enrollment dashboard',   params: {} },
    { name: 'get_client_progress', description: 'Get enrollment progress',          params: { enrollmentId: { type: 'string', required: true, description: '' } } },
    { name: 'complete_section',    description: 'Mark a section as complete',       params: { enrollmentId: { type: 'string', required: true, description: '' }, sectionId: { type: 'string', required: true, description: '' }, responseData: { type: 'object', required: false, description: '' } } },
    { name: 'send_nudge',          description: 'Send nudge email to client',       params: { enrollmentId: { type: 'string', required: true, description: '' }, message: { type: 'string', required: false, description: '' } } },
    { name: 'get_analytics',       description: 'Get enrollment analytics',         params: { packageId: { type: 'string', required: false, description: '' } } },
    { name: 'graduate_trainee',    description: 'Graduate a trainee to coach',      params: { enrollmentId: { type: 'string', required: true, description: '' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const userId = req.userId;
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('enrollment_id, completed_at, client_id')
    .eq('installing_coach_id', userId);

  const active    = (enrollments ?? []).filter((e: Record<string, unknown>) => !e.completed_at).length;
  const total     = (enrollments ?? []).length;

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${active} active enrollment(s) · ${total} total`,
      keyEntities: [],
      recentEvents: [],
      pendingActions: [],
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'enroll_client': {
      const result = await enrollClient(p.packageId as string, uid, {
        name: p.clientName as string,
        email: p.clientEmail as string,
        phone: p.clientPhone as string | undefined,
        goals: p.goals as string | undefined,
        background: p.background as string | undefined,
      }, p.enrollmentType as 'client' | 'trainee');
      return { success: true, message: 'Client enrolled', data: result as unknown as Record<string, unknown> };
    }

    case 'get_dashboard':
      return { success: true, message: 'Dashboard', data: { rows: await getCoachDashboard(uid) } };

    case 'get_client_progress':
      return { success: true, message: 'Progress', data: await getEnrollmentWithProgress(p.enrollmentId as string) as unknown as Record<string, unknown> };

    case 'complete_section': {
      const flags = await completeSection(p.enrollmentId as string, p.sectionId as string, p.responseData as Record<string, unknown> | undefined);
      return { success: true, message: 'Section completed', data: flags };
    }

    case 'send_nudge': {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('invite_token, client_profiles(email, name), coaching_packages(title)')
        .eq('enrollment_id', p.enrollmentId)
        .single();
      const client = enrollment?.client_profiles as Record<string, unknown>;
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    process.env.FROM_EMAIL ?? 'noreply@coachplatform.com',
        to:      client?.email as string,
        subject: `Your next module in ${(enrollment?.coaching_packages as Record<string, unknown>)?.title} is ready`,
        html:    `<p>Hi ${client?.name}, ${p.message ?? 'Keep going — your next module awaits!'}</p><a href="https://${process.env.PLATFORM_DOMAIN}/portal/${enrollment?.invite_token}">Continue learning</a>`,
      });
      return { success: true, message: 'Nudge sent' };
    }

    case 'get_analytics':
      return { success: true, message: 'Analytics', data: await getCoachEnrollmentStats(uid, p.packageId as string | undefined) as unknown as Record<string, unknown> };

    case 'graduate_trainee': {
      await completeEnrollment(p.enrollmentId as string);
      return { success: true, message: 'Trainee graduated' };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
