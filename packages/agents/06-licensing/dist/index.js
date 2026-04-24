"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const sdk_2 = require("@coaching/sdk");
const PORT = parseInt(process.env.AGENT_LICENSING_PORT ?? '3006', 10);
const AGENT_ID = 'coaching-licensing';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Licensing & Revenue',
    version: '1.0.0',
    description: 'License your modules to other coaches with per-module revenue terms and full chain attribution.',
    icon: '💰',
    domain: ['licensing', 'revenue', 'coaching'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'dashboard' },
    panelSpec: {
        layout: 'two-column',
        sections: [
            { type: 'text-summary', id: 'lic-summary', title: 'Licensing Overview', dataKey: 'summary' },
            { type: 'table', id: 'lic-granted', title: 'Licenses Granted', dataKey: 'granted',
                columns: [
                    { key: 'module_title', label: 'Module', type: 'text' },
                    { key: 'licensee_name', label: 'Licensee', type: 'text' },
                    { key: 'direct_cut_pct', label: 'Cut %', type: 'text' },
                    { key: 'expires_at', label: 'Expires', type: 'date' },
                ],
            },
            { type: 'table', id: 'lic-held', title: 'Licenses Held', dataKey: 'held',
                columns: [
                    { key: 'module_title', label: 'Module', type: 'text' },
                    { key: 'licensor_name', label: 'From', type: 'text' },
                    { key: 'expires_at', label: 'Expires', type: 'date' },
                ],
            },
            { type: 'action-form', id: 'lic-grant', title: 'Grant License', action: 'grant_license', submitLabel: 'Grant',
                fields: [
                    { name: 'moduleId', label: 'Module ID', inputType: 'text', required: true },
                    { name: 'licenseeCoachId', label: 'Licensee Coach ID', inputType: 'text', required: true },
                    { name: 'directCutPct', label: 'Direct Cut %', inputType: 'number', required: true },
                    { name: 'derivativeCutPct', label: 'Derivative Cut %', inputType: 'number', required: true },
                ],
            },
        ],
    },
    actions: [
        { name: 'get_license_dashboard', description: 'Get licensing overview', params: {} },
        { name: 'grant_license', description: 'Grant module license', params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
        { name: 'revoke_license', description: 'Revoke a module license', params: { licenseId: { type: 'string', required: true, description: '' } } },
        { name: 'get_revenue_breakdown', description: 'Get revenue breakdown', params: { since: { type: 'string', required: false, description: '' }, groupBy: { type: 'string', required: false, description: '' } } },
        { name: 'get_ancestry', description: 'Get module ancestry chain', params: { moduleId: { type: 'string', required: true, description: '' } } },
        { name: 'update_license_depth', description: 'Update license propagation', params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const dashboard = await (0, skills_1.getLicenseDashboard)(req.userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const revenue = await (0, tools_1.getRevenueByCoach)(req.userId, startOfMonth);
    // Check expiring licenses
    const { data: expiring } = await sdk_2.supabase
        .from('module_licenses')
        .select('license_id, module_id, expires_at')
        .eq('licensor_coach_id', req.userId)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${dashboard.granted.length} license(s) granted · ${dashboard.held.length} held · $${revenue.totalUsd.toFixed(2)} revenue this month`,
            keyEntities: [],
            recentEvents: [],
            pendingActions: (expiring ?? []).map((l) => ({
                type: 'expiring_license',
                label: `License for module ${l.module_id} expires soon`,
                dueAt: l.expires_at,
                priority: 'high',
            })),
            rawContext: {
                granted: dashboard.granted.map(l => ({
                    module_title: l.module_title ?? l.module_id,
                    licensee_name: l.licensee_name ?? l.licensee_coach_id,
                    direct_cut_pct: `${l.direct_cut_pct}%`,
                    expires_at: l.expires_at ?? null,
                })),
                held: dashboard.held.map(l => ({
                    module_title: l.module_title ?? l.module_id,
                    licensor_name: l.licensor_name ?? l.licensor_coach_id,
                    expires_at: l.expires_at ?? null,
                })),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'get_license_dashboard':
            return { success: true, message: 'Dashboard', data: await (0, skills_1.getLicenseDashboard)(uid) };
        case 'grant_license':
            await (0, skills_1.licenseModuleToCoach)(uid, p.licenseeCoachId, p.moduleId, {
                directCutPct: p.directCutPct,
                derivativeCutPct: p.derivativeCutPct,
                propagateToDepth: p.propagateToDepth ?? null,
                canSublicense: p.canSublicense ?? false,
            });
            return { success: true, message: 'License granted' };
        case 'revoke_license':
            await (0, tools_1.revokeModuleLicense)(p.licenseId);
            return { success: true, message: 'License revoked' };
        case 'get_revenue_breakdown':
            return { success: true, message: 'Revenue', data: await (0, tools_1.getRevenueByCoach)(uid, p.since) };
        case 'get_ancestry':
            return { success: true, message: 'Ancestry', data: { ancestry: await (0, tools_1.getAncestryChain)(p.moduleId) } };
        case 'update_license_depth':
            await sdk_2.supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
            return { success: true, message: 'Updated' };
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map