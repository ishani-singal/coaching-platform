import { ProgramRecord, ModuleRecord, ModuleSectionSpec, ViewType, PeriodType } from '@coaching/sdk';
import {
  createProgram,
  addModuleToProgram,
  getProgramWithModules,
  getModuleWithSections,
  createProgramPeriod,
  addModuleToPeriod,
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
  for (let i = 0; i < moduleIds.length; i++) {
    await addModuleToProgram(program.programId, moduleIds[i], i);
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
    const period = await createProgramPeriod(program.programId, pi, p.label, p.periodType);
    for (let mi = 0; mi < p.moduleIds.length; mi++) {
      await addModuleToPeriod(program.programId, p.moduleIds[mi], period.periodId, mi);
    }
  }

  return getProgramWithPeriods(program.programId);
}

export async function createInlineModule(
  coachId: string,
  programId: string,
  periodId: string | undefined,
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

  const mod = await scaffoldModule(coachId, title, category, programId);

  if (periodId) {
    await addModuleToPeriod(programId, mod.moduleId, periodId, displayOrder);
  } else {
    await addModuleToProgram(programId, mod.moduleId, displayOrder);
  }

  return mod;
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
