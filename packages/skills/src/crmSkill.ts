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

  let enrollmentEntry = null;
  if (profile.packageId) {
    const { data: pkgData } = await supabase
      .from('packages')
      .select('title, programs')
      .eq('package_id', profile.packageId)
      .single();

    const programIds = ((pkgData?.programs as Array<{ program_id: string }>) ?? []).map(p => p.program_id);
    const pmResult = await (
      programIds.length > 0
        ? supabase.from('programs').select('periods').in('program_id', programIds)
        : Promise.resolve({ data: [] as unknown[] })
    );

    const moduleIds = [...new Set(
      (pmResult.data ?? []).flatMap((row: unknown) => {
        const r = row as { periods?: Array<{ modules?: Array<{ module_id: string }> }> };
        return (r.periods ?? []).flatMap(p => (p.modules ?? []).map(m => m.module_id));
      })
    )];
    const completedSections = profile.responses.length;

    let totalSections = 0;
    if (moduleIds.length > 0) {
      const { count } = await supabase
        .from('module_sections')
        .select('section_id', { count: 'exact', head: true })
        .in('module_id', moduleIds);
      totalSections = count ?? 0;
    }

    enrollmentEntry = {
      clientId:       profile.clientId,
      packageId:      profile.packageId,
      packageTitle:   (pkgData?.title as string) ?? 'Unknown',
      enrollmentType: profile.enrollmentType,
      completedAt:    profile.completedAt ?? null,
      startedAt:      profile.startedAt ?? null,
      totalSections,
      completedSections,
      completionPct:  totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0,
    };
  }

  const nextSession = sessions.find(s => s.status === 'scheduled' && new Date(s.scheduledAt) > new Date());

  return { profile, notes, tags, enrollments: enrollmentEntry ? [enrollmentEntry] : [], sessions, nextSession };
}

export async function getCoachCRMOverview(coachId: string) {
  const clients = await getClientsByCoach(coachId);

  // Batch-fetch payment status and package titles
  const clientIds  = clients.map(c => c.clientId);
  const packageIds = [...new Set(clients.map(c => c.packageId).filter(Boolean) as string[])];

  const [revenueResult, pkgResult] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('revenue_events').select('client_id').in('client_id', clientIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    packageIds.length > 0
      ? supabase.from('packages').select('package_id, title').in('package_id', packageIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const paidIds = new Set((revenueResult.data ?? []).map((r: Record<string, unknown>) => r.client_id as string));
  const pkgTitles: Record<string, string> = Object.fromEntries(
    (pkgResult.data ?? []).map((p: Record<string, unknown>) => [p.package_id as string, p.title as string])
  );

  const overview = await Promise.all(
    clients.map(async client => {
      const [tagsResult, noteCountResult] = await Promise.all([
        supabase
          .from('coach_client_tags')
          .select('tag')
          .eq('coach_id', coachId)
          .eq('client_id', client.clientId),
        supabase
          .from('coach_client_notes')
          .select('note_id', { count: 'exact', head: true })
          .eq('coach_id', coachId)
          .eq('client_id', client.clientId),
      ]);

      const tags   = tagsResult.data;
      const status = !client.enrollmentType ? 'prospect' : client.completedAt ? 'completed' : 'active';

      return {
        ...client,
        tags:              (tags ?? []).map((t: Record<string, unknown>) => t.tag as string),
        enrollmentStatus:  status,
        enrollmentType:    client.enrollmentType ?? null,
        noteCount:         noteCountResult.count ?? 0,
        lastSession:       null,
        completionPct:     0,
        packageTitle:      client.packageId ? (pkgTitles[client.packageId] ?? null) : null,
        paymentStatus:     paidIds.has(client.clientId) ? 'paid' : (client.packageId ? 'unpaid' : null),
        completedSections: client.responses.length,
      };
    })
  );

  return {
    active:    overview.filter(c => c.enrollmentStatus === 'active'),
    completed: overview.filter(c => c.enrollmentStatus === 'completed'),
    prospect:  overview.filter(c => c.enrollmentStatus === 'prospect'),
  };
}

export async function getDashboardStats(coachId: string) {
  const [enrollmentRows, revenueRows, sessionRows] = await Promise.all([
    supabase
      .from('client_profiles')
      .select('enrollment_type')
      .eq('coach_id', coachId)
      .not('enrollment_type', 'is', null)
      .is('completed_at', null)
      .then(r => r.data ?? []),

    supabase
      .from('revenue_events')
      .select('amount_usd, client_profiles!inner(enrollment_type, coach_id)')
      .eq('client_profiles.coach_id', coachId)
      .then(r => r.data ?? []),

    supabase
      .from('coaching_sessions')
      .select('duration_minutes, client_id, client_profiles(enrollment_type)')
      .eq('coach_id', coachId)
      .eq('status', 'completed')
      .then(r => r.data ?? []),
  ]);

  const clientCount  = enrollmentRows.filter((r: Record<string, unknown>) => r.enrollment_type === 'client').length;
  const traineeCount = enrollmentRows.filter((r: Record<string, unknown>) => r.enrollment_type === 'trainee').length;

  let clientRevenue = 0, traineeRevenue = 0;
  for (const row of revenueRows) {
    const type = (row.client_profiles as unknown as { enrollment_type: string } | null)?.enrollment_type;
    const amt  = (row.amount_usd as number) ?? 0;
    if (type === 'client')  clientRevenue  += amt;
    if (type === 'trainee') traineeRevenue += amt;
  }

  let clientMins = 0, traineeMins = 0;
  for (const s of sessionRows) {
    const type = (s.client_profiles as unknown as { enrollment_type: string } | null)?.enrollment_type;
    const mins = (s.duration_minutes as number) ?? 0;
    if (type === 'client')  clientMins  += mins;
    if (type === 'trainee') traineeMins += mins;
  }

  return {
    clientCount,
    traineeCount,
    clientRevenue,
    traineeRevenue,
    clientHours:  clientMins  / 60,
    traineeHours: traineeMins / 60,
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
