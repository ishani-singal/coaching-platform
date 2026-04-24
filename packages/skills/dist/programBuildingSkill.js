"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProgram = buildProgram;
exports.previewProgram = previewProgram;
const tools_1 = require("@coaching/tools");
const tools_2 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function buildProgram(coachId, title, moduleIds) {
    // Validate each module: owned or licensed
    for (const moduleId of moduleIds) {
        const { data: mod } = await sdk_1.supabase.from('modules').select('creator_coach_id').eq('module_id', moduleId).single();
        if (mod?.creator_coach_id !== coachId) {
            const { data: lic } = await sdk_1.supabase
                .from('module_licenses')
                .select('license_id')
                .eq('module_id', moduleId)
                .eq('licensee_coach_id', coachId)
                .maybeSingle();
            if (!lic)
                throw new Error(`Not authorized to use module ${moduleId}`);
        }
    }
    const program = await (0, tools_1.createProgram)(coachId, title);
    for (let i = 0; i < moduleIds.length; i++) {
        await (0, tools_1.addModuleToProgram)(program.programId, moduleIds[i], i);
    }
    return program;
}
async function previewProgram(programId, viewType) {
    const prog = await (0, tools_1.getProgramWithModules)(programId);
    const allSections = [];
    for (const mod of prog.modules ?? []) {
        const full = await (0, tools_2.getModuleWithSections)(mod.moduleId, viewType);
        allSections.push(...(full.sections ?? []));
    }
    return allSections;
}
//# sourceMappingURL=programBuildingSkill.js.map