"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const resend_1 = require("resend");
const skills_1 = require("@coaching/skills");
const tools_2 = require("@coaching/tools");
const sdk_2 = require("@coaching/sdk");
const PORT = parseInt(process.env.AGENT_PROGRAM_RUNNER_PORT ?? '3002', 10);
const AGENT_ID = 'coaching-program-runner';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Program Runner',
    version: '1.0.0',
    description: 'Deliver coaching programs to clients and trainees. Manage enrollments and progress.',
    icon: '🎯',
    domain: ['delivery', 'enrollment', 'coaching'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'dashboard' },
    actions: [
        { name: 'enroll_client', description: 'Enroll a client in a package', params: { packageId: { type: 'string', required: true, description: '' }, clientName: { type: 'string', required: true, description: '' }, clientEmail: { type: 'string', required: true, description: '' }, clientPhone: { type: 'string', required: false, description: '' }, goals: { type: 'string', required: false, description: '' }, background: { type: 'string', required: false, description: '' }, enrollmentType: { type: 'string', required: true, description: 'client | trainee', enum: ['client', 'trainee'] } } },
        { name: 'get_dashboard', description: 'Get coach enrollment dashboard', params: {} },
        { name: 'get_client_progress', description: 'Get enrollment progress', params: { enrollmentId: { type: 'string', required: true, description: '' } } },
        { name: 'complete_section', description: 'Mark a section as complete', params: { enrollmentId: { type: 'string', required: true, description: '' }, sectionId: { type: 'string', required: true, description: '' }, responseData: { type: 'object', required: false, description: '' } } },
        { name: 'send_nudge', description: 'Send nudge email to client', params: { enrollmentId: { type: 'string', required: true, description: '' }, message: { type: 'string', required: false, description: '' } } },
        { name: 'get_analytics', description: 'Get enrollment analytics', params: { packageId: { type: 'string', required: false, description: '' } } },
        { name: 'graduate_trainee', description: 'Graduate a trainee to coach', params: { enrollmentId: { type: 'string', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const userId = req.userId;
    const { data: enrollments } = await sdk_2.supabase
        .from('enrollments')
        .select('enrollment_id, completed_at, client_id')
        .eq('installing_coach_id', userId);
    const active = (enrollments ?? []).filter((e) => !e.completed_at).length;
    const total = (enrollments ?? []).length;
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${active} active enrollment(s) · ${total} total`,
            keyEntities: [],
            recentEvents: [],
            pendingActions: [],
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'enroll_client': {
            const result = await (0, skills_1.enrollClient)(p.packageId, uid, {
                name: p.clientName,
                email: p.clientEmail,
                phone: p.clientPhone,
                goals: p.goals,
                background: p.background,
            }, p.enrollmentType);
            return { success: true, message: 'Client enrolled', data: result };
        }
        case 'get_dashboard':
            return { success: true, message: 'Dashboard', data: { rows: await (0, skills_1.getCoachDashboard)(uid) } };
        case 'get_client_progress':
            return { success: true, message: 'Progress', data: await (0, tools_2.getEnrollmentWithProgress)(p.enrollmentId) };
        case 'complete_section': {
            const flags = await (0, skills_1.completeSection)(p.enrollmentId, p.sectionId, p.responseData);
            return { success: true, message: 'Section completed', data: flags };
        }
        case 'send_nudge': {
            const { data: enrollment } = await sdk_2.supabase
                .from('enrollments')
                .select('invite_token, client_profiles(email, name), coaching_packages(title)')
                .eq('enrollment_id', p.enrollmentId)
                .single();
            const client = enrollment?.client_profiles;
            const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
                from: process.env.FROM_EMAIL ?? 'noreply@coachplatform.com',
                to: client?.email,
                subject: `Your next module in ${enrollment?.coaching_packages?.title} is ready`,
                html: `<p>Hi ${client?.name}, ${p.message ?? 'Keep going — your next module awaits!'}</p><a href="https://${process.env.PLATFORM_DOMAIN}/portal/${enrollment?.invite_token}">Continue learning</a>`,
            });
            return { success: true, message: 'Nudge sent' };
        }
        case 'get_analytics':
            return { success: true, message: 'Analytics', data: await (0, skills_1.getCoachEnrollmentStats)(uid, p.packageId) };
        case 'graduate_trainee': {
            await (0, tools_2.completeEnrollment)(p.enrollmentId);
            return { success: true, message: 'Trainee graduated' };
        }
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map