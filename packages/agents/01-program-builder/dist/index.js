"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const skills_2 = require("@coaching/skills");
const skills_3 = require("@coaching/skills");
const skills_4 = require("@coaching/skills");
const sdk_2 = require("@coaching/sdk");
const PORT = parseInt(process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001', 10);
const AGENT_ID = 'coaching-program-builder';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Program Builder',
    version: '1.0.0',
    description: 'Build coaching modules, programs and packages with three-view content architecture.',
    icon: '📚',
    domain: ['programs', 'coaching', 'content'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'flow-wizard' },
    actions: [
        { name: 'create_module', description: 'Create a new module', params: { title: { type: 'string', required: true, description: 'Module title' }, category: { type: 'string', required: true, description: 'Category' }, derivedFromModuleId: { type: 'string', required: false, description: 'Parent module ID' } } },
        { name: 'add_section', description: 'Add content section to a module', params: { moduleId: { type: 'string', required: true, description: '' }, contentType: { type: 'string', required: true, description: '' }, body: { type: 'object', required: true, description: '' }, visibleTo: { type: 'array', required: true, description: '' } } },
        { name: 'fork_module', description: 'Fork a licensed module', params: { moduleId: { type: 'string', required: true, description: '' } } },
        { name: 'build_program', description: 'Build a program from modules', params: { title: { type: 'string', required: true, description: '' }, moduleIds: { type: 'array', required: true, description: '' } } },
        { name: 'assemble_package', description: 'Assemble a coaching package', params: { personaSnapshotId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: true, description: '' }, programIds: { type: 'array', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' } } },
        { name: 'publish_package', description: 'Publish a package', params: { packageId: { type: 'string', required: true, description: '' } } },
        { name: 'preview_module', description: 'Preview module sections by view type', params: { moduleId: { type: 'string', required: true, description: '' }, viewType: { type: 'string', required: true, description: 'client | trainee | delivery', enum: ['client', 'trainee', 'delivery'] } } },
        { name: 'license_module', description: 'License a module to another coach', params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
        { name: 'update_license_depth', description: 'Update propagation depth on a license', params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
    ],
};
async function onContext(req) {
    const userId = req.userId;
    const [{ data: packages }, { data: modules }, { data: licenses }] = await Promise.all([
        sdk_2.supabase.from('coaching_packages').select('package_id, title, is_published').eq('coach_id', userId),
        sdk_2.supabase.from('modules').select('module_id, title, is_published').eq('creator_coach_id', userId),
        sdk_2.supabase.from('module_licenses').select('license_id').eq('licensor_coach_id', userId),
    ]);
    const published = (packages ?? []).filter((p) => p.is_published).length;
    const drafts = (modules ?? []).filter((m) => !m.is_published);
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${published} published package(s) · ${(modules ?? []).length} modules · ${(licenses ?? []).length} active license(s)`,
            keyEntities: (packages ?? []).slice(0, 5).map((p) => ({ id: p.package_id, type: 'package', label: p.title, attributes: {} })),
            recentEvents: [],
            pendingActions: drafts.slice(0, 3).map((m) => ({ type: 'draft_module', label: `Module "${m.title}" is unpublished`, priority: 'medium' })),
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        case 'create_module':
            return { success: true, message: 'Module created', data: await (0, skills_1.scaffoldModule)(uid, p.title, p.category) };
        case 'add_section':
            await (0, skills_1.addContentToSection)(p.sectionId, p.contentType, p.body, p.visibleTo);
            return { success: true, message: 'Section updated' };
        case 'fork_module':
            return { success: true, message: 'Module forked', data: await (0, skills_1.forkModule)(p.moduleId, uid) };
        case 'build_program':
            return { success: true, message: 'Program built', data: await (0, skills_2.buildProgram)(uid, p.title, p.moduleIds) };
        case 'assemble_package':
            return { success: true, message: 'Package assembled', data: await (0, skills_3.assemblePackage)(uid, p.personaSnapshotId, p.title, p.programIds, { model: p.pricingModel, priceUsd: p.priceUsd }) };
        case 'publish_package':
            await (0, skills_3.publishPackage)(p.packageId);
            return { success: true, message: 'Package published' };
        case 'preview_module':
            return { success: true, message: 'Preview', data: { sections: await (0, skills_1.previewModule)(p.moduleId, p.viewType) } };
        case 'license_module':
            await (0, skills_4.licenseModuleToCoach)(uid, p.licenseeCoachId, p.moduleId, {
                directCutPct: p.directCutPct,
                derivativeCutPct: p.derivativeCutPct,
                propagateToDepth: p.propagateToDepth ?? null,
                canSublicense: p.canSublicense ?? false,
            });
            return { success: true, message: 'License created' };
        case 'update_license_depth':
            await sdk_2.supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
            return { success: true, message: 'License updated' };
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map