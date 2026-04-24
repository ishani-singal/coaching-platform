import { getClientsByCoach, getSessionHistory, getNotes, getAllTags, getClientsByTag, getClientProfile } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function getClientDashboard(coachId: string, clientId: string) {
  const [profile, notes, tags, sessions] = await Promise.all([
    getClientProfile(clientId),
    getNotes(coachId, clientId),
    getAllTags(coachId).then(async () => {
      const { data } = await supabase
        .from('coach_client_tags')
        .select('tag')
        .eq('coach_id', coachId)
        .eq('client_id', clientId);
      return (data ?? []).map((r: Record<string, unknown>) => r.tag as string);
    }),
    getSessionHistory(coachId, clientId),
  ]);

  const { data: enrollment } = await supabase
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

export async function getCoachCRMOverview(coachId: string) {
  const clients = await getClientsByCoach(coachId);

  const overview = await Promise.all(
    clients.map(async client => {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('enrollment_id, completed_at, current_module_id')
        .eq('client_id', client.clientId)
        .eq('installing_coach_id', coachId)
        .maybeSingle();

      const { data: tags } = await supabase
        .from('coach_client_tags')
        .select('tag')
        .eq('coach_id', coachId)
        .eq('client_id', client.clientId);

      const status = !enrollment ? 'prospect' : enrollment.completed_at ? 'completed' : 'active';

      return {
        ...client,
        tags:           (tags ?? []).map((t: Record<string, unknown>) => t.tag as string),
        enrollmentStatus: status,
        lastSession:    null,
        completionPct:  0,
      };
    })
  );

  return {
    active:    overview.filter(c => c.enrollmentStatus === 'active'),
    completed: overview.filter(c => c.enrollmentStatus === 'completed'),
    prospect:  overview.filter(c => c.enrollmentStatus === 'prospect'),
  };
}

export async function getPipelineView(coachId: string) {
  const { data: allTags } = await supabase
    .from('coach_client_tags')
    .select('tag')
    .eq('coach_id', coachId);

  const uniqueTags = [...new Set((allTags ?? []).map((r: Record<string, unknown>) => r.tag as string))];

  const pipeline: Record<string, Awaited<ReturnType<typeof getClientsByTag>>> = {};
  for (const tag of uniqueTags) {
    pipeline[tag] = await getClientsByTag(coachId, tag);
  }
  return pipeline;
}
