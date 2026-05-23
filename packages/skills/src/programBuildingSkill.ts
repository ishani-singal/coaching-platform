import { ProgramRecord, ModuleRecord, ModuleSectionSpec, PeriodType } from '@coaching/sdk';
import {
  createProgram,
  createModule,
  addModuleToPeriodByOrder,
  getProgramWithModules,
  getModuleWithSections,
  createProgramPeriod,
  getProgramWithPeriods,
} from '@coaching/tools';
import { scaffoldModule } from './moduleAuthoringSkill';
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
  const period = await createProgramPeriod(program.programId, 0, '', 'custom');
  for (let i = 0; i < moduleIds.length; i++) {
    await addModuleToPeriodByOrder(program.programId, period.periodOrder, moduleIds[i], i);
  }
  return program;
}

export async function buildProgramWithPeriods(
  coachId: string,
  title: string,
  description: string | undefined,
  periods: Array<{ label: string; periodType: PeriodType; moduleIds: string[] }>
): Promise<ProgramRecord> {
  // Collect all module IDs across periods for upfront auth check
  const allModuleIds = periods.flatMap(p => p.moduleIds);
  for (const moduleId of allModuleIds) {
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

  const program = await createProgram(coachId, title, description);

  for (let pi = 0; pi < periods.length; pi++) {
    const p = periods[pi];
    await createProgramPeriod(program.programId, pi, p.label, p.periodType);
    for (let mi = 0; mi < p.moduleIds.length; mi++) {
      await addModuleToPeriodByOrder(program.programId, pi, p.moduleIds[mi], mi);
    }
  }

  return getProgramWithPeriods(program.programId);
}

export async function createInlineModule(
  coachId: string,
  programId: string,
  periodOrder: number | undefined,
  title: string,
  category: string,
  displayOrder: number
): Promise<ModuleRecord> {
  const { data: prog } = await supabase
    .from('programs')
    .select('creator_coach_id')
    .eq('program_id', programId)
    .single();
  if (prog?.creator_coach_id !== coachId) throw new Error('Not authorized to add modules to this program');

  // Use createModule directly — scaffoldModule adds 3 empty placeholder sections
  // which can fail and prevent the module from appearing in the Modules tab.
  const mod = await createModule(coachId, title, category);

  const targetPeriodOrder = periodOrder ?? 0;
  await addModuleToPeriodByOrder(programId, targetPeriodOrder, mod.moduleId, displayOrder);

  return mod;
}

export async function previewProgram(programId: string): Promise<ModuleSectionSpec[]> {
  const prog = await getProgramWithModules(programId);
  const allSections: ModuleSectionSpec[] = [];
  for (const mod of prog.modules ?? []) {
    const full = await getModuleWithSections(mod.moduleId);
    allSections.push(...(full.sections ?? []));
  }
  return allSections;
}
