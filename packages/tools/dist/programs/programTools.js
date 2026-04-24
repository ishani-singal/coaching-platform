"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgram = createProgram;
exports.addModuleToProgram = addModuleToProgram;
exports.removeModuleFromProgram = removeModuleFromProgram;
exports.reorderModules = reorderModules;
exports.publishProgram = publishProgram;
exports.getProgramWithModules = getProgramWithModules;
const sdk_1 = require("@coaching/sdk");
async function createProgram(coachId, title, description) {
    const { data, error } = await sdk_1.supabase
        .from('programs')
        .insert({ creator_coach_id: coachId, title, description })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapProgram(data);
}
async function addModuleToProgram(programId, moduleId, order) {
    const { error } = await sdk_1.supabase
        .from('program_modules')
        .insert({ program_id: programId, module_id: moduleId, display_order: order });
    if (error)
        throw new Error(error.message);
}
async function removeModuleFromProgram(programId, moduleId) {
    await sdk_1.supabase.from('program_modules').delete().eq('program_id', programId).eq('module_id', moduleId);
}
async function reorderModules(programId, orderedModuleIds) {
    await Promise.all(orderedModuleIds.map((id, idx) => sdk_1.supabase.from('program_modules')
        .update({ display_order: idx })
        .eq('program_id', programId)
        .eq('module_id', id)));
}
async function publishProgram(programId) {
    await sdk_1.supabase.from('programs').update({ is_published: true }).eq('program_id', programId);
}
async function getProgramWithModules(programId) {
    const { data: prog, error } = await sdk_1.supabase
        .from('programs')
        .select('*')
        .eq('program_id', programId)
        .single();
    if (error)
        throw new Error(error.message);
    const { data: pm } = await sdk_1.supabase
        .from('program_modules')
        .select('module_id, display_order, modules(*)')
        .eq('program_id', programId)
        .order('display_order');
    return {
        ...mapProgram(prog),
        modules: (pm ?? []).map((row) => {
            const m = row.modules;
            return {
                moduleId: m.module_id,
                creatorCoachId: m.creator_coach_id,
                title: m.title,
                category: (m.category ?? ''),
                version: m.version,
                isPublished: m.is_published,
            };
        }),
    };
}
function mapProgram(row) {
    return {
        programId: row.program_id,
        creatorCoachId: row.creator_coach_id,
        title: row.title,
        description: row.description,
        isPublished: row.is_published,
    };
}
//# sourceMappingURL=programTools.js.map