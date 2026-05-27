import { supabase } from '@coaching/sdk';
import { ProgramRecord, ProgramPeriod, PeriodType, ModuleRecord } from '@coaching/sdk';

export async function createProgram(coachId: string, title: string, description?: string): Promise<ProgramRecord> {
  const programId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('programs')
    .insert({ program_id: programId, creator_coach_id: coachId, title, description });
  if (insertError) throw new Error(insertError.message);
  // Select by explicit PK — avoids PGRST116 race from filter-based selects after insert.
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  if (error) throw new Error(error.message);
  return mapProgram(data);
}

export async function addModuleToPeriodByOrder(
  programId: string,
  periodOrder: number,
  moduleId: string,
  displayOrder: number
): Promise<void> {
  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);
  const periods = (prog.periods as unknown[]) ?? [];
  const updated = periods.map((p: unknown) => {
    const period = p as Record<string, unknown>;
    if ((period.period_order as number) !== periodOrder) return period;
    const mods = (period.modules as Array<{ module_id: string; display_order: number }>) ?? [];
    return { ...period, modules: [...mods, { module_id: moduleId, display_order: displayOrder }] };
  });
  const { error } = await supabase
    .from('programs').update({ periods: updated }).eq('program_id', programId);
  if (error) throw new Error(error.message);
}

export async function removeModuleFromPeriod(
  programId: string,
  periodOrder: number,
  moduleId: string
): Promise<void> {
  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);
  const periods = (prog.periods as unknown[]) ?? [];
  const updated = periods.map((p: unknown) => {
    const period = p as Record<string, unknown>;
    if ((period.period_order as number) !== periodOrder) return period;
    const mods = (period.modules as Array<{ module_id: string }> ?? []).filter(m => m.module_id !== moduleId);
    return { ...period, modules: mods };
  });
  const { error } = await supabase
    .from('programs').update({ periods: updated }).eq('program_id', programId);
  if (error) throw new Error(error.message);
}

export async function removeModuleFromProgram(programId: string, moduleId: string): Promise<void> {
  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);
  const periods = (prog.periods as unknown[]) ?? [];
  const updated = periods.map((p: unknown) => {
    const period = p as Record<string, unknown>;
    const mods = (period.modules as Array<{ module_id: string }> ?? []).filter(m => m.module_id !== moduleId);
    return { ...period, modules: mods };
  });
  const { error } = await supabase
    .from('programs').update({ periods: updated }).eq('program_id', programId);
  if (error) throw new Error(error.message);
}

export async function updateProgram(
  programId: string,
  coachId: string,
  patch: { title?: string; description?: string; coverImageUrl?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined)           update.title             = patch.title;
  if (patch.description !== undefined)     update.description       = patch.description;
  if (patch.coverImageUrl !== undefined)   update.cover_image_url   = patch.coverImageUrl;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from('programs')
    .update(update)
    .eq('program_id', programId)
    .eq('creator_coach_id', coachId);
  if (error) throw new Error(error.message);
}

export async function deleteProgram(programId: string, coachId: string): Promise<void> {
  // Remove this program from any package that references it in the programs JSONB column
  const { data: affectedPackages } = await supabase
    .from('packages')
    .select('package_id, programs')
    .contains('programs', JSON.stringify([{ program_id: programId }]));
  for (const pkg of affectedPackages ?? []) {
    const updated = ((pkg.programs as Array<{ program_id: string }>) ?? [])
      .filter(p => p.program_id !== programId);
    await supabase.from('packages').update({ programs: updated }).eq('package_id', pkg.package_id);
  }
  await supabase.from('program_licenses').delete().eq('program_id', programId);
  // Null out inline-creation back-reference on modules

  const { error } = await supabase.from('programs').delete()
    .eq('program_id', programId)
    .eq('creator_coach_id', coachId);
  if (error) throw new Error(error.message);
}

export async function getProgramWithModules(programId: string): Promise<ProgramRecord> {
  const { data: prog, error } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  if (error) throw new Error(error.message);

  const rawPeriods = ((prog.periods as unknown[]) ?? []) as Array<{
    period_order: number;
    modules?: Array<{ module_id: string; display_order: number }>;
  }>;
  rawPeriods.sort((a, b) => a.period_order - b.period_order);
  const allModuleRefs = rawPeriods.flatMap(p =>
    (p.modules ?? []).sort((a, b) => a.display_order - b.display_order)
  );
  const moduleIds = allModuleRefs.map(m => m.module_id);
  const modMap = await fetchModuleMap(moduleIds);

  return {
    ...mapProgram(prog),
    modules: moduleIds
      .map(id => modMap.get(id))
      .filter((m): m is ModuleRecord => !!m),
  };
}

export async function listModulesForCoach(coachId: string): Promise<ModuleRecord[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('module_id, title, category')
    .eq('creator_coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapModuleRow);
}

export async function listProgramsForCoach(coachId: string): Promise<ProgramRecord[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('program_id, title, periods')
    .eq('creator_coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProgram);
}

export async function createProgramPeriod(
  programId: string,
  periodOrder: number,
  label: string,
  periodType: PeriodType
): Promise<ProgramPeriod> {
  const newEntry = { period_order: periodOrder, label, period_type: periodType, modules: [] };

  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await supabase
    .from('programs')
    .update({ periods: [...((prog.periods as unknown[]) ?? []), newEntry] })
    .eq('program_id', programId);
  if (error) throw new Error(error.message);

  return { programId, periodOrder, label, periodType };
}

export async function deleteProgramPeriod(programId: string, periodOrder: number): Promise<void> {
  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);

  const allPeriods = ((prog.periods as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const target = allPeriods.find(p => (p.period_order as number) === periodOrder);
  const orphanedModules = (target?.modules as Array<{ module_id: string; display_order: number }>) ?? [];
  const remaining = allPeriods.filter(p => (p.period_order as number) !== periodOrder);

  let updated: Array<Record<string, unknown>>;
  if (orphanedModules.length === 0) {
    updated = remaining;
  } else if (remaining.length === 0) {
    // No periods left: create implicit period with orphaned modules
    updated = [{ period_order: 0, label: '', period_type: 'custom', modules: orphanedModules }];
  } else {
    // Move orphaned modules to the lowest-order remaining period
    const minOrder = Math.min(...remaining.map(p => p.period_order as number));
    updated = remaining.map(p => {
      if ((p.period_order as number) !== minOrder) return p;
      const existingMods = (p.modules as Array<{ module_id: string; display_order: number }>) ?? [];
      return { ...p, modules: [...existingMods, ...orphanedModules] };
    });
  }

  const { error } = await supabase
    .from('programs').update({ periods: updated }).eq('program_id', programId);
  if (error) throw new Error(error.message);
}

export async function updateProgramPeriod(
  programId: string,
  periodOrder: number,
  patch: { label?: string }
): Promise<void> {
  const { data: prog, error: fetchErr } = await supabase
    .from('programs').select('periods').eq('program_id', programId).single();
  if (fetchErr) throw new Error(fetchErr.message);

  const updated = ((prog.periods as unknown[]) ?? []).map((p: unknown) => {
    const period = p as Record<string, unknown>;
    if ((period.period_order as number) !== periodOrder) return period;
    return { ...period, ...(patch.label !== undefined ? { label: patch.label } : {}) };
  });

  const { error } = await supabase
    .from('programs').update({ periods: updated }).eq('program_id', programId);
  if (error) throw new Error(error.message);
}

export async function getProgramWithPeriods(programId: string): Promise<ProgramRecord> {
  const { data: prog, error } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  if (error) throw new Error(error.message);

  const rawPeriods = ((prog.periods as unknown[]) ?? []) as Array<{
    period_order: number;
    label: string;
    period_type: string;
    modules?: Array<{ module_id: string; display_order: number }>;
  }>;
  rawPeriods.sort((a, b) => a.period_order - b.period_order);

  const allModuleIds = [...new Set(
    rawPeriods.flatMap(p => (p.modules ?? []).map(m => m.module_id))
  )];
  const modMap = await fetchModuleMap(allModuleIds);

  return {
    ...mapProgram(prog),
    periods: rawPeriods.map(rawPeriod => ({
      programId,
      periodOrder: rawPeriod.period_order,
      label:       rawPeriod.label,
      periodType:  rawPeriod.period_type as PeriodType,
      modules: (rawPeriod.modules ?? [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(m => modMap.get(m.module_id))
        .filter((m): m is ModuleRecord => !!m),
    })),
  };
}

function mapPeriodJson(row: Record<string, unknown>, programId: string): ProgramPeriod {
  return {
    programId,
    periodOrder: row.period_order as number,
    label:       row.label        as string,
    periodType:  row.period_type  as PeriodType,
    modules:     ((row.modules as unknown[]) ?? []) as ModuleRecord[],
  };
}

function mapModuleRow(m: Record<string, unknown>): ModuleRecord {
  return {
    moduleId:            m.module_id as string,
    creatorCoachId:      m.creator_coach_id as string,
    title:               m.title as string,
    category:            (m.category ?? '') as string,
    version:             m.version as number,
    derivedFromModuleId: m.derived_from_module_id as string | undefined,
    noSublicense:        (m.no_sublicense as boolean) ?? false,
  };
}

function mapProgram(row: Record<string, unknown>): ProgramRecord {
  const programId = row.program_id as string;
  return {
    programId,
    creatorCoachId:  row.creator_coach_id as string,
    title:           row.title as string,
    description:     row.description as string | undefined,
    coverImageUrl:   row.cover_image_url as string | undefined,
    periods:         ((row.periods as unknown[]) ?? []).map(
      p => mapPeriodJson(p as Record<string, unknown>, programId)
    ),
  };
}

async function fetchModuleMap(moduleIds: string[]): Promise<Map<string, ModuleRecord>> {
  if (moduleIds.length === 0) return new Map();
  const { data } = await supabase.from('modules').select('*').in('module_id', moduleIds);
  const map = new Map<string, ModuleRecord>();
  for (const row of data ?? []) {
    const m = mapModuleRow(row as Record<string, unknown>);
    map.set(m.moduleId, m);
  }
  return map;
}
