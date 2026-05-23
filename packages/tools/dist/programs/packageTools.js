"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPackage = createPackage;
exports.updatePackage = updatePackage;
exports.addProgramToPackage = addProgramToPackage;
exports.relinkPackagePrograms = relinkPackagePrograms;
exports.publishPackage = publishPackage;
exports.unpublishPackage = unpublishPackage;
exports.getPackageWithPrograms = getPackageWithPrograms;
exports.getPackageDetail = getPackageDetail;
exports.getPublishedPackagesForCoach = getPublishedPackagesForCoach;
exports.getAllPackagesForCoach = getAllPackagesForCoach;
exports.deletePackage = deletePackage;
const sdk_1 = require("@coaching/sdk");
async function createPackage(coachId, title, pricingModel, opts) {
    const { data, error } = await sdk_1.supabase
        .from('packages')
        .insert({
        coach_id: coachId,
        title,
        pricing_model: pricingModel,
        price_usd: opts?.priceUsd ?? null,
        currencies: opts?.currencies ?? ['INR'],
        total_seats: opts?.totalSeats ?? null,
        show_seats_filled: opts?.showSeatsFilled ?? false,
        apply_deadline: opts?.applyDeadline ?? null,
        discount_price: opts?.discountPrice ?? null,
        discount_until: opts?.discountUntil ?? null,
        certificate_url: opts?.certificateUrl ?? null,
        certificate_template: opts?.certificateTemplate ?? null,
        included_program_ids: opts?.includedProgramIds ?? [],
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapPackage(data);
}
async function updatePackage(packageId, coachId, title, pricingModel, opts) {
    const { data, error } = await sdk_1.supabase
        .from('packages')
        .update({
        title,
        pricing_model: pricingModel,
        price_usd: opts?.priceUsd ?? null,
        currencies: opts?.currencies ?? ['INR'],
        total_seats: opts?.totalSeats ?? null,
        show_seats_filled: opts?.showSeatsFilled ?? false,
        apply_deadline: opts?.applyDeadline ?? null,
        discount_price: opts?.discountPrice ?? null,
        discount_until: opts?.discountUntil ?? null,
        certificate_url: opts?.certificateUrl ?? null,
        certificate_template: opts?.certificateTemplate ?? null,
        included_program_ids: opts?.includedProgramIds ?? [],
    })
        .eq('package_id', packageId)
        .eq('coach_id', coachId)
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapPackage(data);
}
async function addProgramToPackage(packageId, programId, order) {
    const { data: pkg, error: fetchErr } = await sdk_1.supabase
        .from('packages')
        .select('programs')
        .eq('package_id', packageId)
        .single();
    if (fetchErr)
        throw new Error(fetchErr.message);
    const current = pkg.programs ?? [];
    const { error } = await sdk_1.supabase
        .from('packages')
        .update({ programs: [...current, { program_id: programId, display_order: order }] })
        .eq('package_id', packageId);
    if (error)
        throw new Error(error.message);
}
async function relinkPackagePrograms(packageId, programIds) {
    const programs = programIds.map((id, i) => ({ program_id: id, display_order: i }));
    const { error } = await sdk_1.supabase
        .from('packages')
        .update({ programs })
        .eq('package_id', packageId);
    if (error)
        throw new Error(error.message);
}
async function publishPackage(packageId) {
    const { data: pkg } = await sdk_1.supabase
        .from('packages')
        .select('programs')
        .eq('package_id', packageId)
        .single();
    if (!pkg || (pkg.programs ?? []).length === 0)
        throw new Error('No programs linked');
    await sdk_1.supabase.from('packages').update({ is_published: true }).eq('package_id', packageId);
}
async function unpublishPackage(packageId) {
    await sdk_1.supabase.from('packages').update({ is_published: false }).eq('package_id', packageId);
}
async function getPackageWithPrograms(packageId) {
    const { data, error } = await sdk_1.supabase
        .from('packages')
        .select('*')
        .eq('package_id', packageId)
        .single();
    if (error)
        throw new Error(error.message);
    return mapPackage(data);
}
async function getPackageDetail(packageId) {
    const { data: pkg, error } = await sdk_1.supabase
        .from('packages')
        .select('package_id, title, programs')
        .eq('package_id', packageId)
        .single();
    if (error)
        throw new Error(error.message);
    const programRefs = (pkg.programs ?? [])
        .sort((a, b) => a.display_order - b.display_order);
    if (programRefs.length === 0) {
        return { packageId: pkg.package_id, title: pkg.title, programs: [] };
    }
    // programs.periods is a JSONB column — program_modules was dropped in migration 025
    const { data: progRows, error: progErr } = await sdk_1.supabase
        .from('programs')
        .select('program_id, title, periods')
        .in('program_id', programRefs.map(p => p.program_id));
    if (progErr)
        throw new Error(progErr.message);
    // Collect all module IDs across every period of every program
    const rows = (progRows ?? []);
    const allModuleIds = [...new Set(rows.flatMap(prog => {
            const periods = prog.periods ?? [];
            return periods.flatMap(period => (period.modules ?? []).map(m => m.module_id));
        }))];
    // Batch-fetch module details
    const moduleMap = new Map();
    if (allModuleIds.length > 0) {
        const { data: modRows } = await sdk_1.supabase
            .from('modules')
            .select('module_id, title, category')
            .in('module_id', allModuleIds);
        for (const m of modRows ?? []) {
            const mod = m;
            moduleMap.set(mod.module_id, {
                moduleId: mod.module_id,
                title: mod.title,
                category: (mod.category ?? ''),
            });
        }
    }
    const orderMap = new Map(programRefs.map(p => [p.program_id, p.display_order]));
    const programs = rows
        .sort((a, b) => (orderMap.get(a.program_id) ?? 0) - (orderMap.get(b.program_id) ?? 0))
        .map(prog => {
        const periods = prog.periods ?? [];
        const sortedPeriods = periods.sort((a, b) => a.period_order - b.period_order);
        const modulesOrdered = sortedPeriods
            .flatMap(period => (period.modules ?? []).sort((a, b) => a.display_order - b.display_order))
            .map(m => moduleMap.get(m.module_id))
            .filter((m) => !!m);
        return {
            programId: prog.program_id,
            title: prog.title,
            periodType: sortedPeriods[0]?.period_type,
            periodCount: sortedPeriods.length,
            modules: modulesOrdered,
        };
    });
    return { packageId: pkg.package_id, title: pkg.title, programs };
}
async function getPublishedPackagesForCoach(coachId) {
    const { data } = await sdk_1.supabase
        .from('packages')
        .select('*')
        .eq('coach_id', coachId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapPackage);
}
async function getAllPackagesForCoach(coachId) {
    const { data } = await sdk_1.supabase
        .from('packages')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapPackage);
}
async function deletePackage(packageId, coachId) {
    // Clear enrollment fields on any clients enrolled in this package
    await sdk_1.supabase.from('client_profiles')
        .update({ package_id: null, enrollment_type: null, started_at: null, completed_at: null, current_module_id: null, responses: [] })
        .eq('package_id', packageId);
    const { error } = await sdk_1.supabase.from('packages').delete()
        .eq('package_id', packageId)
        .eq('coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        title: row.title,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        currencies: row.currencies ?? ['INR'],
        totalSeats: row.total_seats,
        showSeatsFilled: row.show_seats_filled ?? false,
        applyDeadline: row.apply_deadline,
        discountPrice: row.discount_price,
        discountUntil: row.discount_until,
        isPublished: row.is_published,
        certificateUrl: row.certificate_url,
        certificateTemplate: row.certificate_template,
        includedProgramIds: row.included_program_ids ?? [],
    };
}
//# sourceMappingURL=packageTools.js.map