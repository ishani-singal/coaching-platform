"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgram = createProgram;
exports.addModuleToPeriodByOrder = addModuleToPeriodByOrder;
exports.removeModuleFromPeriod = removeModuleFromPeriod;
exports.removeModuleFromProgram = removeModuleFromProgram;
exports.updateProgram = updateProgram;
exports.deleteProgram = deleteProgram;
exports.getProgramWithModules = getProgramWithModules;
exports.listModulesForCoach = listModulesForCoach;
exports.listProgramsForCoach = listProgramsForCoach;
exports.createProgramPeriod = createProgramPeriod;
exports.deleteProgramPeriod = deleteProgramPeriod;
exports.updateProgramPeriod = updateProgramPeriod;
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
async function addModuleToPeriodByOrder(programId, periodOrder, moduleId, displayOrder) {
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const periods = prog.periods ?? [];
    const updated = periods.map((p) => {
        const period = p;
        if (period.period_order !== periodOrder)
            return period;
        const mods = period.modules ?? [];
        return { ...period, modules: [...mods, { module_id: moduleId, display_order: displayOrder }] };
    });
    const { error } = await sdk_1.supabase
        .from('programs').update({ periods: updated }).eq('program_id', programId);
    if (error)
        throw new Error(error.message);
}
async function removeModuleFromPeriod(programId, periodOrder, moduleId) {
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const periods = prog.periods ?? [];
    const updated = periods.map((p) => {
        const period = p;
        if (period.period_order !== periodOrder)
            return period;
        const mods = (period.modules ?? []).filter(m => m.module_id !== moduleId);
        return { ...period, modules: mods };
    });
    const { error } = await sdk_1.supabase
        .from('programs').update({ periods: updated }).eq('program_id', programId);
    if (error)
        throw new Error(error.message);
}
async function removeModuleFromProgram(programId, moduleId) {
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const periods = prog.periods ?? [];
    const updated = periods.map((p) => {
        const period = p;
        const mods = (period.modules ?? []).filter(m => m.module_id !== moduleId);
        return { ...period, modules: mods };
    });
    const { error } = await sdk_1.supabase
        .from('programs').update({ periods: updated }).eq('program_id', programId);
    if (error)
        throw new Error(error.message);
}
async function updateProgram(programId, coachId, patch) {
    const update = {};
    if (patch.title !== undefined)
        update.title = patch.title;
    if (patch.description !== undefined)
        update.description = patch.description;
    if (patch.coverImageUrl !== undefined)
        update.cover_image_url = patch.coverImageUrl;
    if (Object.keys(update).length === 0)
        return;
    const { error } = await sdk_1.supabase
        .from('programs')
        .update(update)
        .eq('program_id', programId)
        .eq('creator_coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function deleteProgram(programId, coachId) {
    // Remove this program from any package that references it in the programs JSONB column
    const { data: affectedPackages } = await sdk_1.supabase
        .from('packages')
        .select('package_id, programs')
        .contains('programs', JSON.stringify([{ program_id: programId }]));
    for (const pkg of affectedPackages ?? []) {
        const updated = (pkg.programs ?? [])
            .filter(p => p.program_id !== programId);
        await sdk_1.supabase.from('packages').update({ programs: updated }).eq('package_id', pkg.package_id);
    }
    await sdk_1.supabase.from('program_licenses').delete().eq('program_id', programId);
    // Null out inline-creation back-reference on modules
    const { error } = await sdk_1.supabase.from('programs').delete()
        .eq('program_id', programId)
        .eq('creator_coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function getProgramWithModules(programId) {
    const { data: prog, error } = await sdk_1.supabase
        .from('programs')
        .select('*')
        .eq('program_id', programId)
        .single();
    if (error)
        throw new Error(error.message);
    const rawPeriods = (prog.periods ?? []);
    rawPeriods.sort((a, b) => a.period_order - b.period_order);
    const allModuleRefs = rawPeriods.flatMap(p => (p.modules ?? []).sort((a, b) => a.display_order - b.display_order));
    const moduleIds = allModuleRefs.map(m => m.module_id);
    const modMap = await fetchModuleMap(moduleIds);
    return {
        ...mapProgram(prog),
        modules: moduleIds
            .map(id => modMap.get(id))
            .filter((m) => !!m),
    };
}
async function listModulesForCoach(coachId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .select('module_id, title, category')
        .eq('creator_coach_id', coachId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(error.message);
    return (data ?? []).map(mapModuleRow);
}
async function listProgramsForCoach(coachId) {
    const { data, error } = await sdk_1.supabase
        .from('programs')
        .select('program_id, title, periods')
        .eq('creator_coach_id', coachId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(error.message);
    return (data ?? []).map(mapProgram);
}
async function createProgramPeriod(programId, periodOrder, label, periodType) {
    const newEntry = { period_order: periodOrder, label, period_type: periodType, modules: [] };
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const { error } = await sdk_1.supabase
        .from('programs')
        .update({ periods: [...(prog.periods ?? []), newEntry] })
        .eq('program_id', programId);
    if (error)
        throw new Error(error.message);
    return { programId, periodOrder, label, periodType };
}
async function deleteProgramPeriod(programId, periodOrder) {
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const allPeriods = (prog.periods ?? []);
    const target = allPeriods.find(p => p.period_order === periodOrder);
    const orphanedModules = target?.modules ?? [];
    const remaining = allPeriods.filter(p => p.period_order !== periodOrder);
    let updated;
    if (orphanedModules.length === 0) {
        updated = remaining;
    }
    else if (remaining.length === 0) {
        // No periods left: create implicit period with orphaned modules
        updated = [{ period_order: 0, label: '', period_type: 'custom', modules: orphanedModules }];
    }
    else {
        // Move orphaned modules to the lowest-order remaining period
        const minOrder = Math.min(...remaining.map(p => p.period_order));
        updated = remaining.map(p => {
            if (p.period_order !== minOrder)
                return p;
            const existingMods = p.modules ?? [];
            return { ...p, modules: [...existingMods, ...orphanedModules] };
        });
    }
    const { error } = await sdk_1.supabase
        .from('programs').update({ periods: updated }).eq('program_id', programId);
    if (error)
        throw new Error(error.message);
}
async function updateProgramPeriod(programId, periodOrder, patch) {
    const { data: prog, error: fetchErr } = await sdk_1.supabase
        .from('programs').select('periods').eq('program_id', programId).single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const updated = (prog.periods ?? []).map((p) => {
        const period = p;
        if (period.period_order !== periodOrder)
            return period;
        return { ...period, ...(patch.label !== undefined ? { label: patch.label } : {}) };
    });
    const { error } = await sdk_1.supabase
        .from('programs').update({ periods: updated }).eq('program_id', programId);
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
    const rawPeriods = (prog.periods ?? []);
    rawPeriods.sort((a, b) => a.period_order - b.period_order);
    const allModuleIds = [...new Set(rawPeriods.flatMap(p => (p.modules ?? []).map(m => m.module_id)))];
    const modMap = await fetchModuleMap(allModuleIds);
    return {
        ...mapProgram(prog),
        periods: rawPeriods.map(rawPeriod => ({
            programId,
            periodOrder: rawPeriod.period_order,
            label: rawPeriod.label,
            periodType: rawPeriod.period_type,
            modules: (rawPeriod.modules ?? [])
                .sort((a, b) => a.display_order - b.display_order)
                .map(m => modMap.get(m.module_id))
                .filter((m) => !!m),
        })),
    };
}
function mapPeriodJson(row, programId) {
    return {
        programId,
        periodOrder: row.period_order,
        label: row.label,
        periodType: row.period_type,
        modules: (row.modules ?? []),
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
        noSublicense: m.no_sublicense ?? false,
    };
}
function mapProgram(row) {
    const programId = row.program_id;
    return {
        programId,
        creatorCoachId: row.creator_coach_id,
        title: row.title,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        periods: (row.periods ?? []).map(p => mapPeriodJson(p, programId)),
    };
}
async function fetchModuleMap(moduleIds) {
    if (moduleIds.length === 0)
        return new Map();
    const { data } = await sdk_1.supabase.from('modules').select('*').in('module_id', moduleIds);
    const map = new Map();
    for (const row of data ?? []) {
        const m = mapModuleRow(row);
        map.set(m.moduleId, m);
    }
    return map;
}
//# sourceMappingURL=programTools.js.map