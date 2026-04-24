"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPackage = createPackage;
exports.addProgramToPackage = addProgramToPackage;
exports.publishPackage = publishPackage;
exports.getPackageWithPrograms = getPackageWithPrograms;
exports.getPublishedPackagesForCoach = getPublishedPackagesForCoach;
const sdk_1 = require("@coaching/sdk");
async function createPackage(coachId, personaSnapshotId, title, pricingModel, priceUsd) {
    const { data, error } = await sdk_1.supabase
        .from('coaching_packages')
        .insert({ coach_id: coachId, persona_snapshot_id: personaSnapshotId, title, pricing_model: pricingModel, price_usd: priceUsd })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapPackage(data);
}
async function addProgramToPackage(packageId, programId, order) {
    await sdk_1.supabase.from('package_programs').insert({ package_id: packageId, program_id: programId, display_order: order });
}
async function publishPackage(packageId) {
    const { data: pkg } = await sdk_1.supabase
        .from('coaching_packages')
        .select('persona_snapshot_id')
        .eq('package_id', packageId)
        .single();
    if (!pkg?.persona_snapshot_id)
        throw new Error('No persona snapshot linked');
    const { data: programs } = await sdk_1.supabase
        .from('package_programs')
        .select('program_id, programs(is_published, program_modules(module_id, modules(is_published)))')
        .eq('package_id', packageId);
    if (!programs || programs.length === 0)
        throw new Error('No programs linked');
    for (const pp of programs) {
        const prog = pp.programs;
        if (!prog.is_published)
            throw new Error(`Program ${pp.program_id} is unpublished`);
        const pms = prog.program_modules;
        for (const pm of pms ?? []) {
            if (!pm.modules.is_published)
                throw new Error(`Module ${pm.module_id} in program ${pp.program_id} unpublished`);
        }
    }
    await sdk_1.supabase.from('coaching_packages').update({ is_published: true }).eq('package_id', packageId);
}
async function getPackageWithPrograms(packageId) {
    const { data, error } = await sdk_1.supabase
        .from('coaching_packages')
        .select('*, package_programs(display_order, programs(*))')
        .eq('package_id', packageId)
        .single();
    if (error)
        throw new Error(error.message);
    return mapPackage(data);
}
async function getPublishedPackagesForCoach(coachId) {
    const { data } = await sdk_1.supabase
        .from('coaching_packages')
        .select('*')
        .eq('coach_id', coachId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapPackage);
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        personaSnapshotId: row.persona_snapshot_id,
        title: row.title,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        isPublished: row.is_published,
    };
}
//# sourceMappingURL=packageTools.js.map