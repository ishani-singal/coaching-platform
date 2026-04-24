import { ModuleRecord, ModuleSectionSpec, ViewType, ContentType } from '@coaching/sdk';
import { createModule, addSection, getModuleWithSections, forkModule as forkModuleTool } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function scaffoldModule(coachId: string, title: string, category: string): Promise<ModuleRecord> {
  const mod = await createModule(coachId, title, category);

  // Create placeholder section for each view type
  await Promise.all([
    addSection(mod.moduleId, 0, ['client'],   'text', { content: '' }),
    addSection(mod.moduleId, 1, ['trainee'],  'text', { content: '' }),
    addSection(mod.moduleId, 2, ['delivery'], 'facilitation_guide', { content: '' }),
  ]);

  return mod;
}

export async function addContentToSection(
  sectionId: string,
  contentType: ContentType,
  body: Record<string, unknown>,
  visibleTo: ViewType[]
): Promise<void> {
  if (!visibleTo.length) throw new Error('visibleTo must not be empty');
  const validViews = new Set<ViewType>(['client', 'trainee', 'delivery']);
  for (const v of visibleTo) {
    if (!validViews.has(v)) throw new Error(`Invalid viewType: ${v}`);
  }
  await supabase
    .from('module_sections')
    .update({ content_type: contentType, body, visible_to: visibleTo })
    .eq('section_id', sectionId);
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

export async function previewModule(moduleId: string, viewType: ViewType): Promise<ModuleSectionSpec[]> {
  const mod = await getModuleWithSections(moduleId, viewType);
  return mod.sections ?? [];
}
