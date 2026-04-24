import { ProgramRecord, ModuleSectionSpec, ViewType } from '@coaching/sdk';
import { createProgram, addModuleToProgram, getProgramWithModules } from '@coaching/tools';
import { getModuleWithSections } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function buildProgram(coachId: string, title: string, moduleIds: string[]): Promise<ProgramRecord> {
  // Validate each module: owned or licensed
  for (const moduleId of moduleIds) {
    const { data: mod } = await supabase.from('modules').select('creator_coach_id').eq('module_id', moduleId).single();
    if (mod?.creator_coach_id !== coachId) {
      const { data: lic } = await supabase
        .from('module_licenses')
        .select('license_id')
        .eq('module_id', moduleId)
        .eq('licensee_coach_id', coachId)
        .maybeSingle();
      if (!lic) throw new Error(`Not authorized to use module ${moduleId}`);
    }
  }

  const program = await createProgram(coachId, title);
  for (let i = 0; i < moduleIds.length; i++) {
    await addModuleToProgram(program.programId, moduleIds[i], i);
  }
  return program;
}

export async function previewProgram(programId: string, viewType: ViewType): Promise<ModuleSectionSpec[]> {
  const prog = await getProgramWithModules(programId);
  const allSections: ModuleSectionSpec[] = [];
  for (const mod of prog.modules ?? []) {
    const full = await getModuleWithSections(mod.moduleId, viewType);
    allSections.push(...(full.sections ?? []));
  }
  return allSections;
}
