"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const skills_2 = require("@coaching/skills");
const tools_2 = require("@coaching/tools");
const sdk_2 = require("@coaching/sdk");
const resend_1 = require("resend");
const PORT = parseInt(process.env.AGENT_CRM_PORT ?? '3005', 10);
const AGENT_ID = 'coaching-crm';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Client CRM',
    version: '1.0.0',
    description: 'Lightweight CRM for coaching clients: notes, tags, pipeline, session history.',
    icon: '👥',
    domain: ['crm', 'clients', 'coaching'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'table' },
    panelSpec: {
        layout: 'single-column',
        sections: [
            { type: 'text-summary', id: 'crm-summary', title: 'CRM Overview', dataKey: 'summary' },
            { type: 'table', id: 'crm-clients', title: 'Clients', dataKey: 'clients',
                columns: [
                    { key: 'name', label: 'Name', type: 'text' },
                    { key: 'email', label: 'Email', type: 'text' },
                    { key: 'status', label: 'Status', type: 'badge',
                        badgeColors: { active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-500', lead: 'bg-blue-100 text-blue-700' },
                    },
                    { key: 'clientId', label: 'Note', type: 'action-button', actionName: 'add_note' },
                ],
            },
            { type: 'action-form', id: 'crm-add-note', title: 'Add Note', action: 'add_note', submitLabel: 'Save Note',
                fields: [
                    { name: 'clientId', label: 'Client ID', inputType: 'text', required: true },
                    { name: 'note', label: 'Note', inputType: 'textarea', required: true },
                ],
            },
            { type: 'action-form', id: 'crm-add-tag', title: 'Tag Client', action: 'add_tag', submitLabel: 'Add Tag',
                fields: [
                    { name: 'clientId', label: 'Client ID', inputType: 'text', required: true },
                    { name: 'tag', label: 'Tag', inputType: 'text', required: true },
                ],
            },
        ],
    },
    actions: [
        { name: 'get_client_list', description: 'Get all clients with optional filter', params: { tag: { type: 'string', required: false, description: '' }, status: { type: 'string', required: false, description: '' } } },
        { name: 'get_client_detail', description: 'Get full client detail', params: { clientId: { type: 'string', required: true, description: '' } } },
        { name: 'add_note', description: 'Add note to client', params: { clientId: { type: 'string', required: true, description: '' }, note: { type: 'string', required: true, description: '' } } },
        { name: 'delete_note', description: 'Delete a note', params: { noteId: { type: 'string', required: true, description: '' } } },
        { name: 'add_tag', description: 'Tag a client', params: { clientId: { type: 'string', required: true, description: '' }, tag: { type: 'string', required: true, description: '' } } },
        { name: 'remove_tag', description: 'Remove a tag from client', params: { clientId: { type: 'string', required: true, description: '' }, tag: { type: 'string', required: true, description: '' } } },
        { name: 'get_pipeline', description: 'Get CRM pipeline view', params: {} },
        { name: 'update_client', description: 'Update client profile', params: { clientId: { type: 'string', required: true, description: '' }, patch: { type: 'object', required: true, description: '' } } },
        { name: 'get_sessions', description: 'Get session history', params: { clientId: { type: 'string', required: false, description: '' } } },
        { name: 'sync_bookings', description: 'Sync bookings to sessions', params: {} },
        { name: 'get_dashboard_stats', description: 'Get CRM dashboard stats', params: {} },
        { name: 'resend_invite', description: 'Resend enrollment invite email to a client', params: { clientId: { type: 'string', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const clients = await (0, tools_2.getClientsByCoach)(req.userId);
    const { data: sessions } = await sdk_2.supabase
        .from('coaching_sessions')
        .select('session_id')
        .eq('coach_id', req.userId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString());
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${clients.length} client(s) · ${(sessions ?? []).length} upcoming session(s)`,
            keyEntities: clients.slice(0, 5).map(c => ({ id: c.clientId, type: 'client', label: c.name, attributes: { email: c.email } })),
            recentEvents: [],
            pendingActions: [],
            rawContext: {
                clients: clients.map(c => ({ clientId: c.clientId, name: c.name, email: c.email, status: c.status ?? 'active' })),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'get_client_list':
            return { success: true, message: 'Clients', data: await (0, skills_1.getCoachCRMOverview)(uid) };
        case 'get_client_detail':
            return { success: true, message: 'Client detail', data: await (0, skills_1.getClientDashboard)(uid, p.clientId) };
        case 'add_note':
            await (0, tools_1.addNote)(uid, p.clientId, p.note);
            return { success: true, message: 'Note added' };
        case 'delete_note':
            await (0, tools_1.deleteNote)(p.noteId);
            return { success: true, message: 'Note deleted' };
        case 'add_tag':
            await (0, tools_1.addTag)(uid, p.clientId, p.tag);
            return { success: true, message: 'Tag added' };
        case 'remove_tag':
            await (0, tools_1.removeTag)(uid, p.clientId, p.tag);
            return { success: true, message: 'Tag removed' };
        case 'get_pipeline':
            return { success: true, message: 'Pipeline', data: await (0, skills_1.getPipelineView)(uid) };
        case 'update_client':
            await (0, tools_1.updateClientProfile)(p.clientId, p.patch);
            return { success: true, message: 'Client updated' };
        case 'get_sessions':
            return { success: true, message: 'Sessions', data: { sessions: await (0, tools_1.getSessionHistory)(uid, p.clientId) } };
        case 'sync_bookings':
            await (0, skills_2.syncBookingsToSessions)(uid, uid);
            return { success: true, message: 'Bookings synced' };
        case 'get_dashboard_stats':
            return { success: true, message: 'Dashboard stats', data: await (0, skills_1.getDashboardStats)(uid) };
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