"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnrollment = createEnrollment;
exports.getEnrollmentByToken = getEnrollmentByToken;
exports.getEnrollmentWithProgress = getEnrollmentWithProgress;
exports.submitResponse = submitResponse;
exports.advanceCurrentModule = advanceCurrentModule;
exports.completeEnrollment = completeEnrollment;
exports.getCoachEnrollmentStats = getCoachEnrollmentStats;
const sdk_1 = require("@coaching/sdk");
async function createEnrollment(packageId, coachId, clientId, type) {
    const { data, error } = await sdk_1.supabase
        .from('client_profiles')
        .update({ package_id: packageId, enrollment_type: type })
        .eq('client_id', clientId)
        .eq('coach_id', coachId)
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapClient(data);
}
async function getEnrollmentByToken(token) {
    const { data, error } = await sdk_1.supabase
        .from('client_profiles')
        .select('*, packages(*)')
        .eq('invite_token', token)
        .single();
    if (error)
        throw new Error('Client not found');
    return {
        ...mapClient(data),
        pkg: mapPackage(data.packages),
    };
}
async function getEnrollmentWithProgress(clientId) {
    const { data: client } = await sdk_1.supabase
        .from('client_profiles')
        .select('*')
        .eq('client_id', clientId)
        .single();
    const responses = (client?.responses ?? []);
    const completedSectionIds = responses.map(r => r.section_id);
    return { enrollment: mapClient(client), completedSectionIds, responses };
}
async function submitResponse(clientId, sectionId, responseData) {
    const { error } = await sdk_1.supabase.rpc('append_enrollment_response', {
        p_client_id: clientId,
        p_section_id: sectionId,
        p_response_data: responseData,
    });
    if (error)
        throw new Error(error.message);
}
async function advanceCurrentModule(clientId, nextModuleId) {
    await sdk_1.supabase.from('client_profiles').update({ current_module_id: nextModuleId }).eq('client_id', clientId);
}
async function completeEnrollment(clientId) {
    await sdk_1.supabase.from('client_profiles').update({ completed_at: new Date().toISOString() }).eq('client_id', clientId);
}
async function getCoachEnrollmentStats(coachId, packageId) {
    let q = sdk_1.supabase
        .from('client_profiles')
        .select('client_id, completed_at, current_module_id')
        .eq('coach_id', coachId)
        .not('enrollment_type', 'is', null);
    if (packageId)
        q = q.eq('package_id', packageId);
    const { data } = await q;
    const rows = data ?? [];
    const total = rows.length;
    const completed = rows.filter((r) => r.completed_at).length;
    const active = rows.filter((r) => !r.completed_at).length;
    return {
        totalEnrollments: total,
        activeEnrollments: active,
        completionRate: total > 0 ? completed / total : 0,
        avgModuleReached: 0,
    };
}
function mapClient(row) {
    const rawResponses = (row.responses ?? []);
    return {
        clientId: row.client_id,
        coachId: row.coach_id,
        inviteToken: row.invite_token,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        goals: (row.goals ?? ''),
        background: (row.background ?? ''),
        preferences: (row.preferences ?? {}),
        packageId: row.package_id,
        enrollmentType: row.enrollment_type,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        currentModuleId: row.current_module_id,
        responses: rawResponses.map(r => ({
            sectionId: r.section_id,
            responseData: (r.response_data ?? {}),
            submittedAt: r.submitted_at,
        })),
    };
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        title: row.title,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        currencies: row.currencies ?? ['INR'],
        showSeatsFilled: row.show_seats_filled ?? false,
        isPublished: row.is_published,
        includedProgramIds: row.included_program_ids ?? [],
    };
}
//# sourceMappingURL=enrollmentTools.js.map