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
    panelSpec: {
        layout: 'single-column',
        sections: [
            { type: 'text-summary', id: 'pr-summary', title: 'Enrollment Overview', dataKey: 'summary' },
            { type: 'table', id: 'pr-enrollments', title: 'Active Enrollments', dataKey: 'enrollments',
                columns: [
                    { key: 'client_name', label: 'Client', type: 'text' },
                    { key: 'package_title', label: 'Package', type: 'text' },
                    { key: 'enrolled_at', label: 'Enrolled', type: 'date' },
                    { key: 'client_id', label: 'Nudge', type: 'action-button', actionName: 'send_nudge' },
                ],
            },
            { type: 'action-form', id: 'pr-enroll', title: 'Enroll Client', action: 'enroll_client', submitLabel: 'Enroll',
                fields: [
                    { name: 'clientName', label: 'Client Name', inputType: 'text', required: true },
                    { name: 'clientEmail', label: 'Email', inputType: 'text', required: true },
                    { name: 'packageId', label: 'Package ID', inputType: 'text', required: true },
                    { name: 'enrollmentType', label: 'Type', inputType: 'select', required: true, options: ['client', 'trainee'] },
                ],
            },
        ],
    },
    actions: [
        { name: 'enroll_client', description: 'Enroll a client in a package', params: { packageId: { type: 'string', required: true, description: '' }, clientName: { type: 'string', required: true, description: '' }, clientEmail: { type: 'string', required: true, description: '' }, clientPhone: { type: 'string', required: false, description: '' }, goals: { type: 'string', required: false, description: '' }, background: { type: 'string', required: false, description: '' }, enrollmentType: { type: 'string', required: true, description: 'client | trainee', enum: ['client', 'trainee'] }, customPrice: { type: 'number', required: false, description: 'Override price in USD for this specific client (overrides package default)' }, discountAmount: { type: 'number', required: false, description: 'Flat discount in USD to subtract from the effective price for this client' } } },
        { name: 'get_dashboard', description: 'Get coach enrollment dashboard', params: {} },
        { name: 'get_client_progress', description: 'Get enrollment progress', params: { clientId: { type: 'string', required: true, description: '' } } },
        { name: 'complete_section', description: 'Mark a section as complete', params: { clientId: { type: 'string', required: true, description: '' }, sectionId: { type: 'string', required: true, description: '' }, responseData: { type: 'object', required: false, description: '' } } },
        { name: 'send_nudge', description: 'Send nudge email to client', params: { clientId: { type: 'string', required: true, description: '' }, message: { type: 'string', required: false, description: '' } } },
        { name: 'get_analytics', description: 'Get enrollment analytics', params: { packageId: { type: 'string', required: false, description: '' } } },
        { name: 'graduate_trainee', description: 'Graduate a trainee to coach', params: { clientId: { type: 'string', required: true, description: '' } } },
        { name: 'resend_invite', description: 'Resend the invite email for a client', params: { clientId: { type: 'string', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const userId = req.userId;
    const { data: clients } = await sdk_2.supabase
        .from('client_profiles')
        .select('client_id, completed_at, created_at, name, packages(title)')
        .eq('coach_id', userId)
        .not('enrollment_type', 'is', null);
    const active = (clients ?? []).filter((e) => !e.completed_at).length;
    const total = (clients ?? []).length;
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${active} active enrollment(s) · ${total} total`,
            keyEntities: [],
            recentEvents: [],
            pendingActions: [],
            rawContext: {
                enrollments: (clients ?? [])
                    .filter((e) => !e.completed_at)
                    .map((e) => ({
                    client_id: e.client_id,
                    client_name: e.name ?? 'Unknown',
                    package_title: e.packages?.title ?? '—',
                    enrolled_at: e.created_at,
                })),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'enroll_client': {
            const customPrice = p.customPrice != null ? Number(p.customPrice) : undefined;
            const discountAmount = p.discountAmount != null ? Number(p.discountAmount) : undefined;
            const result = await (0, skills_1.enrollClient)(p.packageId, uid, {
                name: p.clientName,
                email: p.clientEmail,
                phone: p.clientPhone,
                goals: p.goals,
                background: p.background,
            }, p.enrollmentType, { customPriceUsd: customPrice, discountAmountUsd: discountAmount });
            return { success: true, message: 'Client enrolled', data: result };
        }
        case 'get_dashboard':
            return { success: true, message: 'Dashboard', data: { rows: await (0, skills_1.getCoachDashboard)(uid) } };
        case 'get_client_progress':
            return { success: true, message: 'Progress', data: await (0, tools_2.getEnrollmentWithProgress)(p.clientId) };
        case 'complete_section': {
            const flags = await (0, skills_1.completeSection)(p.clientId, p.sectionId, p.responseData);
            return { success: true, message: 'Section completed', data: flags };
        }
        case 'send_nudge': {
            const { data: client } = await sdk_2.supabase
                .from('client_profiles')
                .select('invite_token, email, name, packages(title)')
                .eq('client_id', p.clientId)
                .single();
            const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
                from: process.env.FROM_EMAIL ?? 'noreply@coachplatform.com',
                to: client?.email,
                subject: `Your next module in ${client?.packages?.title} is ready`,
                html: `<p>Hi ${client?.name}, ${p.message ?? 'Keep going — your next module awaits!'}</p><a href="https://${process.env.PLATFORM_DOMAIN}/portal/${client?.invite_token}">Continue learning</a>`,
            });
            return { success: true, message: 'Nudge sent' };
        }
        case 'get_analytics':
            return { success: true, message: 'Analytics', data: await (0, skills_1.getCoachEnrollmentStats)(uid, p.packageId) };
        case 'graduate_trainee': {
            await (0, tools_2.completeEnrollment)(p.clientId);
            return { success: true, message: 'Trainee graduated' };
        }
        case 'resend_invite': {
            const { data: client } = await sdk_2.supabase
                .from('client_profiles')
                .select('invite_token, email, name, packages(title)')
                .eq('client_id', p.clientId)
                .single();
            if (!client)
                return { success: false, message: 'Client not found' };
            const domain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
            const protocol = domain.startsWith('localhost') ? 'http' : 'https';
            const portalUrl = `${protocol}://${domain}/portal/${client.invite_token}`;
            if (process.env.RESEND_API_KEY) {
                const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
                await resend.emails.send({
                    from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
                    to: client.email,
                    subject: `Your invite to ${client.packages?.title ?? 'a coaching program'}`,
                    html: `<p>Hi ${client.name},</p><p>Click <a href="${portalUrl}">here</a> to access your program.</p>`,
                });
            }
            return { success: true, message: 'Invite resent', data: { portalUrl } };
        }
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map