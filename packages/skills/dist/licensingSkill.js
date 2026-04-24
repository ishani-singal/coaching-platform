"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseModuleToCoach = licenseModuleToCoach;
exports.computeAndWriteRevenue = computeAndWriteRevenue;
exports.getLicenseDashboard = getLicenseDashboard;
const tools_1 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function licenseModuleToCoach(licensorId, licenseeId, moduleId, terms) {
    await (0, tools_1.createModuleLicense)(licensorId, licenseeId, moduleId, terms);
}
async function computeAndWriteRevenue(enrollmentId, priceUsd) {
    // Load package → programs → modules for this enrollment
    const { data: enrollment } = await sdk_1.supabase
        .from('enrollments')
        .select('package_id, installing_coach_id')
        .eq('enrollment_id', enrollmentId)
        .single();
    if (!enrollment)
        throw new Error('Enrollment not found');
    const { data: programs } = await sdk_1.supabase
        .from('package_programs')
        .select('program_id, programs(program_modules(module_id))')
        .eq('package_id', enrollment.package_id);
    // Collect all module IDs
    const moduleIds = [];
    for (const pp of programs ?? []) {
        const prog = pp.programs;
        for (const pm of prog.program_modules ?? []) {
            moduleIds.push(pm.module_id);
        }
    }
    // Merge ancestry chains across all modules
    const ancestryMap = new Map();
    for (const moduleId of moduleIds) {
        const chain = await (0, tools_1.getAncestryChain)(moduleId);
        for (const row of chain) {
            const existing = ancestryMap.get(row.ancestorCoachId);
            if (existing) {
                existing.totalPct = Math.min(100, existing.totalPct + row.applicableCutPct);
            }
            else {
                ancestryMap.set(row.ancestorCoachId, { coachId: row.ancestorCoachId, totalPct: row.applicableCutPct });
            }
        }
    }
    // Build merged ancestry for revenue split using first module's chain as canonical
    const mergedAncestry = moduleIds.length > 0 ? await (0, tools_1.getAncestryChain)(moduleIds[0]) : [];
    const allocations = (0, tools_1.calculateRevenueSplit)(priceUsd, mergedAncestry);
    // Patch delivering_coach coachId
    for (const a of allocations) {
        if (a.role === 'delivering_coach') {
            a.coachId = enrollment.installing_coach_id;
        }
    }
    await (0, tools_1.writeRevenueEvents)(enrollmentId, allocations);
    return allocations;
}
async function getLicenseDashboard(coachId) {
    const [granted, held, revenue] = await Promise.all([
        (0, tools_1.getLicensesGrantedByCoach)(coachId),
        (0, tools_1.getLicensesHeldByCoach)(coachId),
        (0, tools_1.getRevenueByCoach)(coachId),
    ]);
    return {
        granted,
        held,
        revenueThisMonth: revenue.totalUsd,
        topEarningModule: null,
    };
}
//# sourceMappingURL=licensingSkill.js.map