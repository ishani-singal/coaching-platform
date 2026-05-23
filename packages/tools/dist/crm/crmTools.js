"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNote = addNote;
exports.getNotes = getNotes;
exports.deleteNote = deleteNote;
exports.addTag = addTag;
exports.removeTag = removeTag;
exports.getClientsByTag = getClientsByTag;
exports.getAllTags = getAllTags;
exports.getClientSummary = getClientSummary;
const sdk_1 = require("@coaching/sdk");
async function addNote(coachId, clientId, note) {
    await sdk_1.supabase.from('coach_client_notes').insert({ coach_id: coachId, client_id: clientId, note });
}
async function getNotes(coachId, clientId) {
    const { data } = await sdk_1.supabase
        .from('coach_client_notes')
        .select('*')
        .eq('coach_id', coachId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
    return data ?? [];
}
async function deleteNote(noteId) {
    await sdk_1.supabase.from('coach_client_notes').delete().eq('note_id', noteId);
}
async function addTag(coachId, clientId, tag) {
    await sdk_1.supabase.from('coach_client_tags').upsert({ coach_id: coachId, client_id: clientId, tag });
}
async function removeTag(coachId, clientId, tag) {
    await sdk_1.supabase.from('coach_client_tags').delete().eq('coach_id', coachId).eq('client_id', clientId).eq('tag', tag);
}
async function getClientsByTag(coachId, tag) {
    const { data } = await sdk_1.supabase
        .from('coach_client_tags')
        .select('client_id, client_profiles(*)')
        .eq('coach_id', coachId)
        .eq('tag', tag);
    return (data ?? []).map((row) => {
        const c = row.client_profiles;
        return mapClient(c);
    });
}
async function getAllTags(coachId) {
    const { data } = await sdk_1.supabase
        .from('coach_client_tags')
        .select('tag')
        .eq('coach_id', coachId);
    const tags = [...new Set((data ?? []).map((r) => r.tag))];
    return tags;
}
async function getClientSummary(coachId, clientId) {
    const [profile, notes, tags] = await Promise.all([
        sdk_1.supabase.from('client_profiles').select('*').eq('client_id', clientId).single().then(r => r.data),
        sdk_1.supabase.from('coach_client_notes').select('*').eq('coach_id', coachId).eq('client_id', clientId).then(r => r.data ?? []),
        sdk_1.supabase.from('coach_client_tags').select('tag').eq('coach_id', coachId).eq('client_id', clientId).then(r => (r.data ?? []).map((x) => x.tag)),
    ]);
    return { profile: profile ? mapClient(profile) : null, notes, tags, enrollment: null, upcomingSessions: [] };
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
        responses: row.responses ?? [],
    };
}
//# sourceMappingURL=crmTools.js.map