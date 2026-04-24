import { supabase } from '@coaching/sdk';
import { ProgramRecord } from '@coaching/sdk';

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

function mapProgram(row: Record<string, unknown>): ProgramRecord {
  return {
    programId:       row.program_id as string,
    creatorCoachId:  row.creator_coach_id as string,
    title:           row.title as string,
    description:     row.description as string | undefined,
    isPublished:     row.is_published as boolean,
  };
}
