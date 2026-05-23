import { ModuleRecord, ModuleSectionSpec, ContentType } from '@coaching/sdk';
import { createModule, getModuleWithSections, updateSection, forkModule as forkModuleTool } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function scaffoldModule(
  coachId: string,
  title: string,
  category: string
): Promise<ModuleRecord> {
  const mod = await createModule(coachId, title, category, undefined);
  return mod;
}

export async function addContentToSection(
  moduleId: string,
  sectionId: string,
  contentType: ContentType,
  body: Record<string, unknown>
): Promise<void> {
  await updateSection(moduleId, sectionId, { contentType, body });
}

export async function forkModule(originalModuleId: string, newCoachId: string): Promise<ModuleRecord> {
  // Verify license
  const { data: license } = await supabase
    .from('module_licenses')
    .select('license_id, can_sublicense')
    .eq('module_id', originalModuleId)
    .eq('licensee_coach_id', newCoachId)
    .maybeSingle();

  const { data: mod } = await supabase.from('modules').select('creator_coach_id').eq('module_id', originalModuleId).single();
  const isOwner = mod?.creator_coach_id === newCoachId;

  if (!isOwner && !license) throw new Error('Not licensed to fork this module');

  return forkModuleTool(originalModuleId, newCoachId);
}

export async function previewModule(moduleId: string): Promise<ModuleSectionSpec[]> {
  const mod = await getModuleWithSections(moduleId);
  return mod.sections ?? [];
}
