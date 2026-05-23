"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModuleLicense = createModuleLicense;
exports.createProgramLicense = createProgramLicense;
exports.getPendingLicenseByToken = getPendingLicenseByToken;
exports.activateProgramLicenseById = activateProgramLicenseById;
exports.revokeModuleLicense = revokeModuleLicense;
exports.getAncestryChain = getAncestryChain;
exports.calculateRevenueSplit = calculateRevenueSplit;
exports.writeRevenueEvents = writeRevenueEvents;
exports.getLicensesGrantedByCoach = getLicensesGrantedByCoach;
exports.getLicensesHeldByCoach = getLicensesHeldByCoach;
exports.getRevenueByCoach = getRevenueByCoach;
const sdk_1 = require("@coaching/sdk");
async function createModuleLicense(licensorId, licenseeId, moduleId, terms) {
    const { data: mod } = await sdk_1.supabase.from('modules').select('creator_coach_id, no_sublicense').eq('module_id', moduleId).single();
    if (mod?.no_sublicense)
        throw new Error('This module cannot be licensed');
    if (mod?.creator_coach_id !== licensorId) {
        const { data: existing } = await sdk_1.supabase
            .from('module_licenses')
            .select('can_sublicense')
            .eq('module_id', moduleId)
            .eq('licensee_coach_id', licensorId)
            .maybeSingle();
        if (!existing?.can_sublicense)
            throw new Error('Not authorized to license this module');
    }
    const { error } = await sdk_1.supabase.from('module_licenses').insert({
        module_id: moduleId,
        licensor_coach_id: licensorId,
        licensee_coach_id: licenseeId,
        direct_cut_pct: terms.directCutPct,
        derivative_cut_pct: terms.derivativeCutPct,
        propagate_to_depth: terms.propagateToDepth,
        can_sublicense: terms.canSublicense,
    });
    if (error)
        throw new Error(error.message);
}
async function createProgramLicense(licensorId, licenseeId, programId, terms) {
    const { data, error } = await sdk_1.supabase.from('program_licenses').insert({
        program_id: programId,
        licensor_coach_id: licensorId,
        licensee_coach_id: licenseeId,
        direct_cut_pct: 0,
        derivative_cut_pct: 0,
        propagate_to_depth: terms.propagateToDepth,
        can_sublicense: false,
        license_fee_amount: terms.licenseFeeAmount ?? null,
        license_fee_currency: terms.licenseFeeCurrency ?? 'USD',
        status: 'pending',
    }).select('license_id, invite_token').single();
    if (error)
        throw new Error(error.message);
    return { licenseId: data.license_id, inviteToken: data.invite_token };
}
async function getPendingLicenseByToken(token) {
    const { data } = await sdk_1.supabase
        .from('program_licenses')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();
    return data ?? null;
}
async function activateProgramLicenseById(licenseId) {
    const { data, error } = await sdk_1.supabase
        .from('program_licenses')
        .update({ status: 'active' })
        .eq('license_id', licenseId)
        .select('program_id, licensee_coach_id')
        .single();
    if (error)
        throw new Error(error.message);
    return { programId: data.program_id, licenseeCoachId: data.licensee_coach_id };
}
async function revokeModuleLicense(licenseId) {
    await sdk_1.supabase.from('module_licenses').delete().eq('license_id', licenseId);
}
async function getAncestryChain(moduleId) {
    const { data } = await sdk_1.supabase
        .from('module_ancestry')
        .select('*')
        .eq('module_id', moduleId)
        .order('depth');
    return (data ?? []).map((row) => ({
        moduleId: row.module_id,
        ancestorModuleId: row.ancestor_module_id,
        ancestorCoachId: row.ancestor_coach_id,
        depth: row.depth,
        applicableCutPct: row.applicable_cut_pct,
    }));
}
function calculateRevenueSplit(priceUsd, ancestry) {
    const platformCutPct = parseFloat(process.env.PLATFORM_CUT_PCT ?? '10');
    const allocations = [];
    const platformAmount = (priceUsd * platformCutPct) / 100;
    allocations.push({ coachId: 'platform', role: 'platform', ancestorDepth: 0, amountUsd: platformAmount, pct: platformCutPct });
    let remaining = priceUsd - platformAmount;
    const sorted = [...ancestry].sort((a, b) => a.depth - b.depth);
    for (const row of sorted) {
        const amount = (priceUsd * row.applicableCutPct) / 100;
        allocations.push({
            coachId: row.ancestorCoachId,
            role: 'licensor',
            ancestorDepth: row.depth,
            amountUsd: amount,
            pct: row.applicableCutPct,
        });
        remaining -= amount;
    }
    const deliveryPct = (remaining / priceUsd) * 100;
    allocations.push({ coachId: 'delivering', role: 'delivering_coach', ancestorDepth: 0, amountUsd: remaining, pct: deliveryPct });
    return allocations;
}
async function writeRevenueEvents(clientId, allocations) {
    const rows = allocations.map(a => ({
        client_id: clientId,
        coach_id: a.coachId,
        role: a.role,
        amount_usd: a.amountUsd,
        ancestor_depth: a.ancestorDepth,
    }));
    await sdk_1.supabase.from('revenue_events').insert(rows);
}
async function getLicensesGrantedByCoach(coachId) {
    const { data } = await sdk_1.supabase.from('module_licenses').select('*').eq('licensor_coach_id', coachId);
    return data ?? [];
}
async function getLicensesHeldByCoach(coachId) {
    const { data } = await sdk_1.supabase.from('module_licenses').select('*').eq('licensee_coach_id', coachId);
    return data ?? [];
}
async function getRevenueByCoach(coachId, since) {
    let q = sdk_1.supabase.from('revenue_events').select('amount_usd, client_id').eq('coach_id', coachId);
    if (since)
        q = q.gte('created_at', since);
    const { data } = await q;
    const rows = data ?? [];
    const totalUsd = rows.reduce((sum, r) => sum + r.amount_usd, 0);
    return { totalUsd, byModule: {}, byLicensee: {} };
}
//# sourceMappingURL=licenseTools.js.map