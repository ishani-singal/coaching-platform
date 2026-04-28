import { supabase } from '@coaching/sdk';
import { ModuleRecord, ModuleSectionSpec, ViewType, ContentType } from '@coaching/sdk';

export async function createModule(
  coachId: string,
  title: string,
  category: string,
  derivedFromId?: string,
  sourceProgramId?: string
): Promise<ModuleRecord> {
  const { data, error } = await supabase
    .from('modules')
    .insert({
      creator_coach_id:       coachId,
      title,
      category,
      derived_from_module_id: derivedFromId ?? null,
      source_program_id:      sourceProgramId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapModule(data);
}

export async function addSection(
  moduleId: string,
  order: number,
  visibleTo: ViewType[],
  contentType: ContentType,
  body: Record<string, unknown>
): Promise<ModuleSectionSpec> {
  const { data, error } = await supabase
    .from('module_sections')
    .insert({ module_id: moduleId, section_order: order, visible_to: visibleTo, content_type: contentType, body })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapSection(data);
}

export async function updateSection(sectionId: string, patch: Partial<ModuleSectionSpec>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.visibleTo)    update.visible_to    = patch.visibleTo;
  if (patch.contentType)  update.content_type  = patch.contentType;
  if (patch.body)         update.body          = patch.body;
  if (patch.sectionOrder !== undefined) update.section_order = patch.sectionOrder;
  await supabase.from('module_sections').update(update).eq('section_id', sectionId);
}

export async function deleteSection(sectionId: string): Promise<void> {
  await supabase.from('module_sections').delete().eq('section_id', sectionId);
}

export async function reorderSections(moduleId: string, orderedSectionIds: string[]): Promise<void> {
  await Promise.all(
    orderedSectionIds.map((id, idx) =>
      supabase.from('module_sections').update({ section_order: idx }).eq('section_id', id).eq('module_id', moduleId)
    )
  );
}

export async function publishModule(moduleId: string): Promise<void> {
  await supabase.from('modules').update({ is_published: true }).eq('module_id', moduleId);
}

export async function getModuleWithSections(moduleId: string, viewType: ViewType): Promise<ModuleRecord> {
  const { data: mod, error } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', moduleId)
    .single();
  if (error) throw new Error(error.message);

  const { data: sections } = await supabase
    .from('module_sections')
    .select('*')
    .eq('module_id', moduleId)
    .contains('visible_to', [viewType])
    .order('section_order');

  return { ...mapModule(mod), sections: (sections ?? []).map(mapSection) };
}

export async function forkModule(originalModuleId: string, newCoachId: string): Promise<ModuleRecord> {
  const { data: orig, error: e1 } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', originalModuleId)
    .single();
  if (e1) throw new Error(e1.message);

  const { data: newMod, error: e2 } = await supabase
    .from('modules')
    .insert({
      creator_coach_id:       newCoachId,
      title:                  orig.title,
      category:               orig.category,
      derived_from_module_id: originalModuleId,
    })
    .select()
    .single();
  if (e2) throw new Error(e2.message);

  const { data: sections } = await supabase
    .from('module_sections')
    .select('*')
    .eq('module_id', originalModuleId);

  if (sections && sections.length > 0) {
    await supabase.from('module_sections').insert(
      sections.map((s: Record<string, unknown>) => ({
        module_id:     newMod.module_id,
        section_order: s.section_order,
        visible_to:    s.visible_to,
        content_type:  s.content_type,
        body:          s.body,
      }))
    );
  }

  // Load existing ancestry for the original module
  const { data: ancestry } = await supabase
    .from('module_ancestry')
    .select('*')
    .eq('module_id', originalModuleId);

  // Load license to get propagate_to_depth
  const { data: license } = await supabase
    .from('module_licenses')
    .select('propagate_to_depth, direct_cut_pct, licensor_coach_id')
    .eq('module_id', originalModuleId)
    .eq('licensee_coach_id', newCoachId)
    .maybeSingle();

  const propagateToDepth: number | null = license?.propagate_to_depth ?? null;

  const newAncestryRows: Record<string, unknown>[] = [];

  // Carry forward existing ancestors if within depth limit
  for (const row of ancestry ?? []) {
    const newDepth = (row.depth as number) + 1;
    if (propagateToDepth === null || newDepth <= propagateToDepth) {
      newAncestryRows.push({
        module_id:          newMod.module_id,
        ancestor_module_id: row.ancestor_module_id,
        ancestor_coach_id:  row.ancestor_coach_id,
        depth:              newDepth,
        applicable_cut_pct: row.applicable_cut_pct,
      });
    }
  }

  // Add depth=1 row for direct parent
  newAncestryRows.push({
    module_id:          newMod.module_id,
    ancestor_module_id: originalModuleId,
    ancestor_coach_id:  orig.creator_coach_id,
    depth:              1,
    applicable_cut_pct: license?.direct_cut_pct ?? 0,
  });

  if (newAncestryRows.length > 0) {
    await supabase.from('module_ancestry').insert(newAncestryRows);
  }

  return mapModule(newMod);
}

export async function updateModule(
  moduleId: string,
  patch: { title?: string; category?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.title    !== undefined) update.title    = patch.title;
  if (patch.category !== undefined) update.category = patch.category;
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from('modules').update(update).eq('module_id', moduleId);
  if (error) throw new Error(error.message);
}

export async function getAllModuleSections(moduleId: string): Promise<ModuleSectionSpec[]> {
  const { data, error } = await supabase
    .from('module_sections')
    .select('*')
    .eq('module_id', moduleId)
    .order('section_order');
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSection);
}

function mapModule(row: Record<string, unknown>): ModuleRecord {
  return {
    moduleId:            row.module_id as string,
    creatorCoachId:      row.creator_coach_id as string,
    title:               row.title as string,
    category:            (row.category ?? '') as string,
    version:             row.version as number,
    derivedFromModuleId: row.derived_from_module_id as string | undefined,
    sourceProgramId:     row.source_program_id as string | undefined,
    isPublished:         row.is_published as boolean,
  };
}

function mapSection(row: Record<string, unknown>): ModuleSectionSpec {
  return {
    sectionId:    row.section_id as string,
    sectionOrder: row.section_order as number,
    visibleTo:    row.visible_to as ViewType[],
    contentType:  row.content_type as ContentType,
    body:         row.body as Record<string, unknown>,
  };
}
