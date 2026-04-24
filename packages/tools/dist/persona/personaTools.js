"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPersonaSource = addPersonaSource;
exports.removePersonaSource = removePersonaSource;
exports.getPersonaSources = getPersonaSources;
exports.getLatestPersonaSnapshot = getLatestPersonaSnapshot;
exports.savePersonaSnapshot = savePersonaSnapshot;
const sdk_1 = require("@coaching/sdk");
async function addPersonaSource(coachId, sourceType, content, url) {
    const { data, error } = await sdk_1.supabase
        .from('persona_sources')
        .insert({ coach_id: coachId, source_type: sourceType, content, url })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapSource(data);
}
async function removePersonaSource(sourceId) {
    await sdk_1.supabase.from('persona_sources').delete().eq('id', sourceId);
}
async function getPersonaSources(coachId) {
    const { data } = await sdk_1.supabase
        .from('persona_sources')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapSource);
}
async function getLatestPersonaSnapshot(coachId) {
    const { data } = await sdk_1.supabase
        .from('persona_snapshots')
        .select('*')
        .eq('coach_id', coachId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ? mapSnapshot(data) : null;
}
async function savePersonaSnapshot(coachId, tone, style, summary, raw) {
    const { data: latest } = await sdk_1.supabase
        .from('persona_snapshots')
        .select('version')
        .eq('coach_id', coachId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data, error } = await sdk_1.supabase
        .from('persona_snapshots')
        .insert({ coach_id: coachId, version: nextVersion, tone, style, summary, raw_snapshot: raw })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapSnapshot(data);
}
function mapSource(row) {
    return {
        id: row.id,
        coachId: row.coach_id,
        sourceType: row.source_type,
        content: row.content,
        url: row.url,
        createdAt: row.created_at,
    };
}
function mapSnapshot(row) {
    return {
        id: row.id,
        coachId: row.coach_id,
        version: row.version,
        tone: row.tone,
        style: row.style,
        summary: row.summary,
        rawSnapshot: row.raw_snapshot,
    };
}
//# sourceMappingURL=personaTools.js.map