"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientDashboard = getClientDashboard;
exports.getCoachCRMOverview = getCoachCRMOverview;
exports.getPipelineView = getPipelineView;
const tools_1 = require("@coaching/tools");
const sdk_1 = require("@coaching/sdk");
async function getClientDashboard(coachId, clientId) {
    const [profile, notes, tags, sessions] = await Promise.all([
        (0, tools_1.getClientProfile)(clientId),
        (0, tools_1.getNotes)(coachId, clientId),
        (0, tools_1.getAllTags)(coachId).then(async () => {
            const { data } = await sdk_1.supabase
                .from('coach_client_tags')
                .select('tag')
                .eq('coach_id', coachId)
                .eq('client_id', clientId);
            return (data ?? []).map((r) => r.tag);
        }),
        (0, tools_1.getSessionHistory)(coachId, clientId),
    ]);
    const { data: enrollment } = await sdk_1.supabase
        .from('enrollments')
        .select('*, coaching_packages(title), current_module_id')
        .eq('client_id', clientId)
        .eq('installing_coach_id', coachId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextSession = sessions.find(s => s.status === 'scheduled' && new Date(s.scheduledAt) > new Date());
    return { profile, notes, tags, enrollment, sessions, nextSession };
}
async function getCoachCRMOverview(coachId) {
    const clients = await (0, tools_1.getClientsByCoach)(coachId);
    const overview = await Promise.all(clients.map(async (client) => {
        const { data: enrollment } = await sdk_1.supabase
            .from('enrollments')
            .select('enrollment_id, completed_at, current_module_id')
            .eq('client_id', client.clientId)
            .eq('installing_coach_id', coachId)
            .maybeSingle();
        const { data: tags } = await sdk_1.supabase
            .from('coach_client_tags')
            .select('tag')
            .eq('coach_id', coachId)
            .eq('client_id', client.clientId);
        const status = !enrollment ? 'prospect' : enrollment.completed_at ? 'completed' : 'active';
        return {
            ...client,
            tags: (tags ?? []).map((t) => t.tag),
            enrollmentStatus: status,
            lastSession: null,
            completionPct: 0,
        };
    }));
    return {
        active: overview.filter(c => c.enrollmentStatus === 'active'),
        completed: overview.filter(c => c.enrollmentStatus === 'completed'),
        prospect: overview.filter(c => c.enrollmentStatus === 'prospect'),
    };
}
async function getPipelineView(coachId) {
    const { data: allTags } = await sdk_1.supabase
        .from('coach_client_tags')
        .select('tag')
        .eq('coach_id', coachId);
    const uniqueTags = [...new Set((allTags ?? []).map((r) => r.tag))];
    const pipeline = {};
    for (const tag of uniqueTags) {
        pipeline[tag] = await (0, tools_1.getClientsByTag)(coachId, tag);
    }
    return pipeline;
}
//# sourceMappingURL=crmSkill.js.map