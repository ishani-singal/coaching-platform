import { supabase } from '@coaching/sdk';
import { ProgramRecord, ProgramPeriod, PeriodType, ModuleRecord } from '@coaching/sdk';

export async function createProgram(coachId: string, title: string, description?: string): Promise<ProgramRecord> {
  const { data, error } = await supabase
    .from('programs')
    .insert({ creator_coach_id: coachId, title, description })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapProgram(data);
}

export async function addModuleToProgram(programId: string, moduleId: string, order: number): Promise<void> {
  const { error } = await supabase
    .from('program_modules')
    .insert({ program_id: programId, module_id: moduleId, display_order: order });
  if (error) throw new Error(error.message);
}

export async function removeModuleFromProgram(programId: string, moduleId: string): Promise<void> {
  await supabase.from('program_modules').delete().eq('program_id', programId).eq('module_id', moduleId);
}

export async function reorderModules(programId: string, orderedModuleIds: string[]): Promise<void> {
  await Promise.all(
    orderedModuleIds.map((id, idx) =>
      supabase.from('program_modules')
        .update({ display_order: idx })
        .eq('program_id', programId)
        .eq('module_id', id)
    )
  );
}

export async function publishProgram(programId: string): Promise<void> {
  await supabase.from('programs').update({ is_published: true }).eq('program_id', programId);
}

export async function getProgramWithModules(programId: string): Promise<ProgramRecord> {
  const { data: prog, error } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  if (error) throw new Error(error.message);

  const { data: pm } = await supabase
    .from('program_modules')
    .select('module_id, display_order, modules(*)')
    .eq('program_id', programId)
    .order('display_order');

  return {
    ...mapProgram(prog),
    modules: (pm ?? []).map((row: Record<string, unknown>) => {
      const m = row.modules as Record<string, unknown>;
      return {
        moduleId:       m.module_id as string,
        creatorCoachId: m.creator_coach_id as string,
        title:          m.title as string,
        category:       (m.category ?? '') as string,
        version:        m.version as number,
        isPublished:    m.is_published as boolean,
      };
    }),
  };
}

export async function listModulesForCoach(coachId: string): Promise<ModuleRecord[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('creator_coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapModuleRow);
}

export async function listProgramsForCoach(coachId: string): Promise<ProgramRecord[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
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
  const { data, error } = await supabase
    .from('program_periods')
    .insert({ program_id: programId, period_order: periodOrder, label, period_type: periodType })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapPeriod(data);
}

export async function addModuleToPeriod(
  programId: string,
  moduleId: string,
  periodId: string,
  displayOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('program_modules')
    .insert({ program_id: programId, module_id: moduleId, period_id: periodId, display_order: displayOrder });
  if (error) throw new Error(error.message);
}

export async function getProgramWithPeriods(programId: string): Promise<ProgramRecord> {
  const { data: prog, error } = await supabase
    .from('programs')
    .select('*')
    .eq('program_id', programId)
    .single();
  if (error) throw new Error(error.message);

  const { data: periodsRaw } = await supabase
    .from('program_periods')
    .select('*')
    .eq('program_id', programId)
    .order('period_order');

  const { data: pm } = await supabase
    .from('program_modules')
    .select('module_id, display_order, period_id, modules(*)')
    .eq('program_id', programId)
    .order('display_order');

  const flatModules: ModuleRecord[] = [];
  const periodMap = new Map<string, ModuleRecord[]>();

  for (const row of pm ?? []) {
    const r = row as Record<string, unknown>;
    const m = r.modules as Record<string, unknown>;
    const module = mapModuleRow(m);
    if (r.period_id) {
      const pid = r.period_id as string;
      if (!periodMap.has(pid)) periodMap.set(pid, []);
      periodMap.get(pid)!.push(module);
    } else {
      flatModules.push(module);
    }
  }

  const periods: ProgramPeriod[] = (periodsRaw ?? []).map((p: Record<string, unknown>) => ({
    ...mapPeriod(p),
    modules: periodMap.get(p.period_id as string) ?? [],
  }));

  return {
    ...mapProgram(prog),
    modules: flatModules,
    periods,
  };
}

function mapPeriod(row: Record<string, unknown>): ProgramPeriod {
  return {
    periodId:    row.period_id as string,
    programId:   row.program_id as string,
    periodOrder: row.period_order as number,
    label:       row.label as string,
    periodType:  row.period_type as PeriodType,
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
    sourceProgramId:     m.source_program_id as string | undefined,
    isPublished:         m.is_published as boolean,
  };
}

function mapProgram(row: Record<string, unknown>): ProgramRecord {
  return {
    programId:       row.program_id as string,
    creatorCoachId:  row.creator_coach_id as string,
    title:           row.title as string,
    description:     row.description as string | undefined,
    isPublished:     row.is_published as boolean,
  };
}
