"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scaffoldModule = scaffoldModule;
exports.addContentToSection = addContentToSection;
exports.forkModule = forkModule;
exports.previewModule = previewModule;
const tools_1 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function scaffoldModule(coachId, title, category) {
    const mod = await (0, tools_1.createModule)(coachId, title, category);
    // Create placeholder section for each view type
    await Promise.all([
        (0, tools_1.addSection)(mod.moduleId, 0, ['client'], 'text', { content: '' }),
        (0, tools_1.addSection)(mod.moduleId, 1, ['trainee'], 'text', { content: '' }),
        (0, tools_1.addSection)(mod.moduleId, 2, ['delivery'], 'facilitation_guide', { content: '' }),
    ]);
    return mod;
}
async function addContentToSection(sectionId, contentType, body, visibleTo) {
    if (!visibleTo.length)
        throw new Error('visibleTo must not be empty');
    const validViews = new Set(['client', 'trainee', 'delivery']);
    for (const v of visibleTo) {
        if (!validViews.has(v))
            throw new Error(`Invalid viewType: ${v}`);
    }
    await sdk_1.supabase
        .from('module_sections')
        .update({ content_type: contentType, body, visible_to: visibleTo })
        .eq('section_id', sectionId);
}
async function forkModule(originalModuleId, newCoachId) {
    // Verify license
    const { data: license } = await sdk_1.supabase
        .from('module_licenses')
        .select('license_id, can_sublicense')
        .eq('module_id', originalModuleId)
        .eq('licensee_coach_id', newCoachId)
        .maybeSingle();
    const { data: mod } = await sdk_1.supabase.from('modules').select('creator_coach_id').eq('module_id', originalModuleId).single();
    const isOwner = mod?.creator_coach_id === newCoachId;
    if (!isOwner && !license)
        throw new Error('Not licensed to fork this module');
    return (0, tools_1.forkModule)(originalModuleId, newCoachId);
}
async function previewModule(moduleId, viewType) {
    const mod = await (0, tools_1.getModuleWithSections)(moduleId, viewType);
    return mod.sections ?? [];
}
//# sourceMappingURL=moduleAuthoringSkill.js.map