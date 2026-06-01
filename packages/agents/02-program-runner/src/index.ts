import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge } from '@coaching/tools';
import {
  enrollClient, getCoachDashboard, getCoachEnrollmentStats, completeSection, getModuleView,
  sendFromCoach,
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
  panelSpec: {
    layout: 'single-column',
    sections: [
      { type: 'text-summary', id: 'pr-summary',     title: 'Enrollment Overview', dataKey: 'summary' },
      { type: 'table',        id: 'pr-enrollments',  title: 'Active Enrollments',  dataKey: 'enrollments',
        columns: [
          { key: 'client_name',   label: 'Client',   type: 'text' },
          { key: 'package_title', label: 'Package',  type: 'text' },
          { key: 'enrolled_at',   label: 'Enrolled', type: 'date' },
          { key: 'client_id',     label: 'Nudge',    type: 'action-button', actionName: 'send_nudge' },
        ],
      },
      { type: 'action-form', id: 'pr-enroll', title: 'Enroll Client', action: 'enroll_client', submitLabel: 'Enroll',
        fields: [
          { name: 'clientName',     label: 'Client Name', inputType: 'text',   required: true },
          { name: 'clientEmail',    label: 'Email',       inputType: 'text',   required: true },
          { name: 'packageId',      label: 'Package ID',  inputType: 'text',   required: true },
          { name: 'enrollmentType', label: 'Type',        inputType: 'select', required: true, options: ['client', 'trainee'] },
        ],
      },
    ],
  },
  actions: [
    { name: 'enroll_client',       description: 'Enroll a client in a package',     params: { packageId: { type: 'string', required: true, description: '' }, clientName: { type: 'string', required: true, description: '' }, clientEmail: { type: 'string', required: true, description: '' }, clientPhone: { type: 'string', required: false, description: '' }, goals: { type: 'string', required: false, description: '' }, background: { type: 'string', required: false, description: '' }, enrollmentType: { type: 'string', required: true, description: 'client | trainee', enum: ['client', 'trainee'] }, customPrice: { type: 'number', required: false, description: 'Override price in USD for this specific client (overrides package default)' }, discountAmount: { type: 'number', required: false, description: 'Flat discount in USD to subtract from the effective price for this client' } } },
    { name: 'get_dashboard',       description: 'Get coach enrollment dashboard',   params: {} },
    { name: 'get_client_progress', description: 'Get enrollment progress',          params: { clientId: { type: 'string', required: true, description: '' } } },
    { name: 'complete_section',    description: 'Mark a section as complete',       params: { clientId: { type: 'string', required: true, description: '' }, sectionId: { type: 'string', required: true, description: '' }, responseData: { type: 'object', required: false, description: '' } } },
    { name: 'send_nudge',          description: 'Send nudge email to client',       params: { clientId: { type: 'string', required: true, description: '' }, message: { type: 'string', required: false, description: '' } } },
    { name: 'get_analytics',       description: 'Get enrollment analytics',         params: { packageId: { type: 'string', required: false, description: '' } } },
    { name: 'graduate_trainee',    description: 'Graduate a trainee to coach',      params: { clientId: { type: 'string', required: true, description: '' } } },
    { name: 'resend_invite',       description: 'Resend the invite email for a client', params: { clientId: { type: 'string', required: true, description: '' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const userId = req.userId;
  const { data: clients } = await supabase
    .from('client_profiles')
    .select('client_id, completed_at, created_at, name, packages(title)')
    .eq('coach_id', userId)
    .not('enrollment_type', 'is', null);

  const active = (clients ?? []).filter((e: Record<string, unknown>) => !e.completed_at).length;
  const total  = (clients ?? []).length;

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${active} active enrollment(s) · ${total} total`,
      keyEntities: [],
      recentEvents: [],
      pendingActions: [],
      rawContext: {
        enrollments: (clients ?? [])
          .filter((e: Record<string, unknown>) => !e.completed_at)
          .map((e: Record<string, unknown>) => ({
            client_id:     e.client_id,
            client_name:   e.name ?? 'Unknown',
            package_title: (e.packages as Record<string, unknown> | null)?.title ?? '—',
            enrolled_at:   e.created_at,
          })),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'enroll_client': {
      const customPrice    = p.customPrice    != null ? Number(p.customPrice)    : undefined;
      const discountAmount = p.discountAmount != null ? Number(p.discountAmount) : undefined;
      const result = await enrollClient(p.packageId as string, uid, {
        name: p.clientName as string,
        email: p.clientEmail as string,
        phone: p.clientPhone as string | undefined,
        goals: p.goals as string | undefined,
        background: p.background as string | undefined,
      }, p.enrollmentType as 'client' | 'trainee', { customPriceUsd: customPrice, discountAmountUsd: discountAmount });
      return { success: true, message: 'Client enrolled', data: result as unknown as Record<string, unknown> };
    }

    case 'get_dashboard':
      return { success: true, message: 'Dashboard', data: { rows: await getCoachDashboard(uid) } };

    case 'get_client_progress':
      return { success: true, message: 'Progress', data: await getEnrollmentWithProgress(p.clientId as string) as unknown as Record<string, unknown> };

    case 'complete_section': {
      const flags = await completeSection(p.clientId as string, p.sectionId as string, p.responseData as Record<string, unknown> | undefined);
      return { success: true, message: 'Section completed', data: flags };
    }

    case 'send_nudge': {
      const { data: client } = await supabase
        .from('client_profiles')
        .select('invite_token, email, name, packages(title)')
        .eq('client_id', p.clientId)
        .single();
      const domain   = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
      const protocol = domain.startsWith('localhost') ? 'http' : 'https';
      await sendFromCoach(uid, {
        to:      client?.email as string,
        subject: `Your next module in ${(client?.packages as unknown as Record<string, unknown>)?.title} is ready`,
        html:    `<p>Hi ${client?.name}, ${p.message ?? 'Keep going — your next module awaits!'}</p><a href="${protocol}://${domain}/portal/${client?.invite_token}">Continue learning</a>`,
      });
      return { success: true, message: 'Nudge sent' };
    }

    case 'get_analytics':
      return { success: true, message: 'Analytics', data: await getCoachEnrollmentStats(uid, p.packageId as string | undefined) as unknown as Record<string, unknown> };

    case 'graduate_trainee': {
      await completeEnrollment(p.clientId as string);
      return { success: true, message: 'Trainee graduated' };
    }

    case 'resend_invite': {
      const { data: client } = await supabase
        .from('client_profiles')
        .select('invite_token, email, name, packages(title)')
        .eq('client_id', p.clientId)
        .single();
      if (!client) return { success: false, message: 'Client not found' };
      const domain   = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
      const protocol = domain.startsWith('localhost') ? 'http' : 'https';
      const portalUrl = `${protocol}://${domain}/portal/${client.invite_token}`;
      await sendFromCoach(uid, {
        to:      client.email as string,
        subject: `Your invite to ${(client.packages as unknown as Record<string, unknown>)?.title ?? 'a coaching program'}`,
        html:    `<p>Hi ${client.name},</p><p>Click <a href="${portalUrl}">here</a> to access your program.</p>`,
      });
      return { success: true, message: 'Invite resent', data: { portalUrl } };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// Multi-agent mode: export app for mounting by parent server
if (process.env.MULTI_AGENT_MODE === 'true') {
  export { app as programRunnerApp };
  console.log(`[${AGENT_ID}] Exported for multi-agent mode`);
} else {
  // Standalone mode: start server
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}
