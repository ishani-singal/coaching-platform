"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClientProfile = createClientProfile;
exports.upsertClientProfile = upsertClientProfile;
exports.getClientProfile = getClientProfile;
exports.getClientByInviteToken = getClientByInviteToken;
exports.getClientsByCoach = getClientsByCoach;
exports.updateClientProfile = updateClientProfile;
const sdk_1 = require("@coaching/sdk");
async function createClientProfile(coachId, data) {
    const { data: row, error } = await sdk_1.supabase
        .from('client_profiles')
        .insert({
        coach_id: coachId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        goals: data.goals,
        background: data.background,
        preferences: data.preferences ?? {},
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapClient(row);
}
async function upsertClientProfile(coachId, email, data) {
    const { data: existing } = await sdk_1.supabase
        .from('client_profiles')
        .select('client_id')
        .eq('coach_id', coachId)
        .eq('email', email)
        .maybeSingle();
    if (existing) {
        const { data: row, error } = await sdk_1.supabase
            .from('client_profiles')
            .update({ name: data.name ?? '', goals: data.goals, background: data.background, preferences: data.preferences ?? {} })
            .eq('client_id', existing.client_id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return mapClient(row);
    }
    const { data: row, error } = await sdk_1.supabase
        .from('client_profiles')
        .insert({ coach_id: coachId, email, name: data.name ?? '', goals: data.goals, background: data.background, preferences: data.preferences ?? {} })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapClient(row);
}
async function getClientProfile(clientId) {
    const { data, error } = await sdk_1.supabase.from('client_profiles').select('*').eq('client_id', clientId).single();
    if (error)
        throw new Error('Client not found');
    return mapClient(data);
}
async function getClientByInviteToken(token) {
    const { data, error } = await sdk_1.supabase.from('client_profiles').select('*').eq('invite_token', token).single();
    if (error)
        throw new Error('Client not found');
    return mapClient(data);
}
async function getClientsByCoach(coachId) {
    const { data } = await sdk_1.supabase.from('client_profiles').select('*').eq('coach_id', coachId).order('created_at', { ascending: false });
    return (data ?? []).map(mapClient);
}
async function updateClientProfile(clientId, patch) {
    const update = {};
    if (patch.name)
        update.name = patch.name;
    if (patch.phone)
        update.phone = patch.phone;
    if (patch.goals)
        update.goals = patch.goals;
    if (patch.background)
        update.background = patch.background;
    if (patch.preferences)
        update.preferences = patch.preferences;
    await sdk_1.supabase.from('client_profiles').update(update).eq('client_id', clientId);
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
//# sourceMappingURL=clientProfileTools.js.map