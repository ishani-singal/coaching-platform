"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgram = createProgram;
exports.addModuleToProgram = addModuleToProgram;
exports.removeModuleFromProgram = removeModuleFromProgram;
exports.reorderModules = reorderModules;
exports.publishProgram = publishProgram;
exports.getProgramWithModules = getProgramWithModules;
exports.listModulesForCoach = listModulesForCoach;
exports.listProgramsForCoach = listProgramsForCoach;
exports.createProgramPeriod = createProgramPeriod;
exports.addModuleToPeriod = addModuleToPeriod;
exports.getProgramWithPeriods = getProgramWithPeriods;
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
async function listModulesForCoach(coachId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .select('*')
        .eq('creator_coach_id', coachId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(error.message);
    return (data ?? []).map(mapModuleRow);
}
async function listProgramsForCoach(coachId) {
    const { data, error } = await sdk_1.supabase
        .from('programs')
        .select('*')
        .eq('creator_coach_id', coachId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(error.message);
    return (data ?? []).map(mapProgram);
}
async function createProgramPeriod(programId, periodOrder, label, periodType) {
    const { data, error } = await sdk_1.supabase
        .from('program_periods')
        .insert({ program_id: programId, period_order: periodOrder, label, period_type: periodType })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapPeriod(data);
}
async function addModuleToPeriod(programId, moduleId, periodId, displayOrder) {
    const { error } = await sdk_1.supabase
        .from('program_modules')
        .insert({ program_id: programId, module_id: moduleId, period_id: periodId, display_order: displayOrder });
    if (error)
        throw new Error(error.message);
}
async function getProgramWithPeriods(programId) {
    const { data: prog, error } = await sdk_1.supabase
        .from('programs')
        .select('*')
        .eq('program_id', programId)
        .single();
    if (error)
        throw new Error(error.message);
    const { data: periodsRaw } = await sdk_1.supabase
        .from('program_periods')
        .select('*')
        .eq('program_id', programId)
        .order('period_order');
    const { data: pm } = await sdk_1.supabase
        .from('program_modules')
        .select('module_id, display_order, period_id, modules(*)')
        .eq('program_id', programId)
        .order('display_order');
    const flatModules = [];
    const periodMap = new Map();
    for (const row of pm ?? []) {
        const r = row;
        const m = r.modules;
        const module = mapModuleRow(m);
        if (r.period_id) {
            const pid = r.period_id;
            if (!periodMap.has(pid))
                periodMap.set(pid, []);
            periodMap.get(pid).push(module);
        }
        else {
            flatModules.push(module);
        }
    }
    const periods = (periodsRaw ?? []).map((p) => ({
        ...mapPeriod(p),
        modules: periodMap.get(p.period_id) ?? [],
    }));
    return {
        ...mapProgram(prog),
        modules: flatModules,
        periods,
    };
}
function mapPeriod(row) {
    return {
        periodId: row.period_id,
        programId: row.program_id,
        periodOrder: row.period_order,
        label: row.label,
        periodType: row.period_type,
    };
}
function mapModuleRow(m) {
    return {
        moduleId: m.module_id,
        creatorCoachId: m.creator_coach_id,
        title: m.title,
        category: (m.category ?? ''),
        version: m.version,
        derivedFromModuleId: m.derived_from_module_id,
        sourceProgramId: m.source_program_id,
        isPublished: m.is_published,
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