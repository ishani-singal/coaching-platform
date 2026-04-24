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
        .from('enrollments')
        .insert({ package_id: packageId, installing_coach_id: coachId, client_id: clientId, enrollment_type: type })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapEnrollment(data);
}
async function getEnrollmentByToken(token) {
    const { data, error } = await sdk_1.supabase
        .from('enrollments')
        .select('*, client_profiles(*), coaching_packages(*)')
        .eq('invite_token', token)
        .single();
    if (error)
        throw new Error('Enrollment not found');
    return {
        ...mapEnrollment(data),
        client: mapClient(data.client_profiles),
        pkg: mapPackage(data.coaching_packages),
    };
}
async function getEnrollmentWithProgress(enrollmentId) {
    const { data: enrollment } = await sdk_1.supabase
        .from('enrollments')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .single();
    const { data: responses } = await sdk_1.supabase
        .from('enrollment_responses')
        .select('section_id, response_data, submitted_at')
        .eq('enrollment_id', enrollmentId);
    const completedSectionIds = (responses ?? []).map((r) => r.section_id);
    return { enrollment: mapEnrollment(enrollment), completedSectionIds, responses: responses ?? [] };
}
async function submitResponse(enrollmentId, sectionId, responseData) {
    await sdk_1.supabase.from('enrollment_responses').insert({ enrollment_id: enrollmentId, section_id: sectionId, response_data: responseData });
}
async function advanceCurrentModule(enrollmentId, nextModuleId) {
    await sdk_1.supabase.from('enrollments').update({ current_module_id: nextModuleId }).eq('enrollment_id', enrollmentId);
}
async function completeEnrollment(enrollmentId) {
    await sdk_1.supabase.from('enrollments').update({ completed_at: new Date().toISOString() }).eq('enrollment_id', enrollmentId);
}
async function getCoachEnrollmentStats(coachId, packageId) {
    let q = sdk_1.supabase.from('enrollments').select('enrollment_id, completed_at, current_module_id').eq('installing_coach_id', coachId);
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
function mapEnrollment(row) {
    return {
        enrollmentId: row.enrollment_id,
        packageId: row.package_id,
        installingCoachId: row.installing_coach_id,
        clientId: row.client_id,
        enrollmentType: row.enrollment_type,
        inviteToken: row.invite_token,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        currentModuleId: row.current_module_id,
    };
}
function mapClient(row) {
    return {
        clientId: row.client_id,
        coachId: row.coach_id,
        name: row.name,
        email: row.email,
        goals: (row.goals ?? ''),
        background: (row.background ?? ''),
        preferences: (row.preferences ?? {}),
    };
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        personaSnapshotId: row.persona_snapshot_id,
        title: row.title,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        isPublished: row.is_published,
    };
}
//# sourceMappingURL=enrollmentTools.js.map