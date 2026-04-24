"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClientProfile = createClientProfile;
exports.upsertClientProfile = upsertClientProfile;
exports.getClientProfile = getClientProfile;
exports.getClientByInviteToken = getClientByInviteToken;
exports.getClientsByCoach = getClientsByCoach;
exports.updateClientProfile = updateClientProfile;
exports.linkClientToEnrollment = linkClientToEnrollment;
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
    const { data: row, error } = await sdk_1.supabase
        .from('client_profiles')
        .upsert({ coach_id: coachId, email, name: data.name ?? '', goals: data.goals, background: data.background, preferences: data.preferences ?? {} }, { onConflict: 'coach_id,email' })
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
async function linkClientToEnrollment(clientId, enrollmentId) {
    await sdk_1.supabase.from('client_profiles').update({ enrollment_id: enrollmentId }).eq('client_id', clientId);
}
function mapClient(row) {
    return {
        clientId: row.client_id,
        coachId: row.coach_id,
        enrollmentId: row.enrollment_id,
        inviteToken: row.invite_token,
        name: row.name,
        email: row.email,
        phone: row.phone,
        goals: (row.goals ?? ''),
        background: (row.background ?? ''),
        preferences: (row.preferences ?? {}),
    };
}
//# sourceMappingURL=clientProfileTools.js.map