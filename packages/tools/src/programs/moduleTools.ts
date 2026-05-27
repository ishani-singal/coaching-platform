import { supabase } from '@coaching/sdk';
import { ModuleRecord, ModuleSectionSpec, ContentType } from '@coaching/sdk';

export async function createModule(
  coachId: string,
  title: string,
  category: string,
  derivedFromId?: string
): Promise<ModuleRecord> {
  const moduleId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('modules')
    .insert({
      module_id:              moduleId,
      creator_coach_id:       coachId,
      title,
      category,
      derived_from_module_id: derivedFromId ?? null,
    });
  if (insertError) throw new Error(insertError.message);
  // Select by explicit PK — avoids PGRST116 race from filter-based selects after insert.
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', moduleId)
    .single();
  if (error) throw new Error(error.message);
  return mapModule(data);
}

export async function addSection(
  moduleId: string,
  order: number,
  contentType: ContentType,
  body: Record<string, unknown>
): Promise<ModuleSectionSpec> {
  const { data, error } = await supabase.rpc('append_module_section', {
    p_module_id:     moduleId,
    p_section_order: order,
    p_content_type:  contentType,
    p_body:          body,
  });
  if (error) throw new Error(error.message);
  return mapSection(data as Record<string, unknown>);
}

export async function updateSection(
  moduleId: string,
  sectionId: string,
  patch: Partial<ModuleSectionSpec>
): Promise<void> {
  const { error } = await supabase.rpc('update_module_section', {
    p_module_id:     moduleId,
    p_section_id:    sectionId,
    p_content_type:  patch.contentType  ?? null,
    p_body:          patch.body         ?? null,
    p_section_order: patch.sectionOrder ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSection(moduleId: string, sectionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_module_section', {
    p_module_id:  moduleId,
    p_section_id: sectionId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteModule(moduleId: string, coachId: string): Promise<void> {
  // Remove all FK dependents first (none of these have ON DELETE CASCADE)
  await supabase.from('program_modules').delete().eq('module_id', moduleId);
  await supabase.from('module_licenses').delete().eq('module_id', moduleId);
  await supabase.from('module_ancestry').delete().or(`module_id.eq.${moduleId},ancestor_module_id.eq.${moduleId}`);
  // Null out any module that was derived from this one
  await supabase.from('modules').update({ derived_from_module_id: null }).eq('derived_from_module_id', moduleId);
  // Null out enrollment tracking pointer on any clients at this module
  await supabase.from('client_profiles').update({ current_module_id: null }).eq('current_module_id', moduleId);
  const { error } = await supabase.from('modules').delete()
    .eq('module_id', moduleId)
    .eq('creator_coach_id', coachId);
  if (error) throw new Error(error.message);
}

export async function reorderSections(moduleId: string, orderedSectionIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_module_sections', {
    p_module_id:   moduleId,
    p_ordered_ids: orderedSectionIds,
  });
  if (error) throw new Error(error.message);
}

export async function getModuleWithSections(moduleId: string): Promise<ModuleRecord> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', moduleId)
    .single();
  if (error) throw new Error(error.message);
  return mapModule(data);
}

export async function forkModule(
  originalModuleId: string,
  newCoachId: string,
  opts?: { noSublicense?: boolean }
): Promise<ModuleRecord> {
  const { data: orig, error: e1 } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', originalModuleId)
    .single();
  if (e1) throw new Error(e1.message);

  // Guard: no_sublicense modules cannot be forked by a different coach
  if (orig.no_sublicense && newCoachId !== orig.creator_coach_id) {
    throw new Error('This module cannot be forked');
  }

  const newModuleId = crypto.randomUUID();
  const { error: e2 } = await supabase
    .from('modules')
    .insert({
      module_id:              newModuleId,
      creator_coach_id:       newCoachId,
      title:                  orig.title,
      category:               orig.category,
      derived_from_module_id: originalModuleId,
      sections:               orig.sections,
      no_sublicense:          opts?.noSublicense ?? false,
    });
  if (e2) throw new Error(e2.message);
  // Select by explicit PK — avoids PGRST116 race from filter-based selects after insert.
  const { data: newMod, error: e2b } = await supabase
    .from('modules')
    .select('*')
    .eq('module_id', newModuleId)
    .single();
  if (e2b) throw new Error(e2b.message);

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
    .from('modules')
    .select('sections')
    .eq('module_id', moduleId)
    .single();
  if (error) throw new Error(error.message);
  const mapped = ((data?.sections ?? []) as Record<string, unknown>[]).map(mapSection);
  const seen = new Set<string>();
  return mapped.filter(s => {
    if (seen.has(s.sectionId)) return false;
    seen.add(s.sectionId);
    return true;
  });
}

function isSectionNonEmpty(contentType: string, body: Record<string, unknown>): boolean {
  switch (contentType) {
    case 'text':
    case 'facilitation_guide':
      return typeof body.content === 'string' && body.content.trim() !== '';
    case 'video':
      return typeof body.embedUrl === 'string' && body.embedUrl.trim() !== '';
    case 'pdf':
      return typeof body.url === 'string' && body.url.trim() !== '';
    case 'task':
      return Array.isArray(body.items) && (body.items as unknown[]).length > 0;
    case 'check_in':
    case 'rating':
      return typeof body.prompt === 'string' && body.prompt.trim() !== '';
    case 'quiz':
      return Array.isArray(body.questions) && (body.questions as unknown[]).length > 0;
    case 'long_form_qa':
    case 'single_choice':
    case 'multi_choice':
      return typeof body.question === 'string' && body.question.trim() !== '';
    case 'match_following':
      return Array.isArray(body.pairs) && (body.pairs as unknown[]).length > 0;
    case 'assignment':
      return [
        body.title, body.instructions,
      ].some(v => typeof v === 'string' && v.trim() !== '');
    default:
      return Object.values(body).some(v => v !== null && v !== undefined && v !== '');
  }
}

export async function pruneEmptySections(moduleId: string): Promise<void> {
  const sections = await getAllModuleSections(moduleId);
  if (sections.length === 0) return;

  const emptyIds = sections
    .filter(s => !isSectionNonEmpty(s.contentType, s.body))
    .map(s => s.sectionId);

  if (emptyIds.length === 0) return;

  await Promise.all(emptyIds.map(id => deleteSection(moduleId, id)));
}

function mapModule(row: Record<string, unknown>): ModuleRecord {
  return {
    moduleId:            row.module_id as string,
    creatorCoachId:      row.creator_coach_id as string,
    title:               row.title as string,
    category:            (row.category ?? '') as string,
    version:             row.version as number,
    derivedFromModuleId: row.derived_from_module_id as string | undefined,
    noSublicense:        (row.no_sublicense as boolean) ?? false,
    sections:            ((row.sections ?? []) as Record<string, unknown>[]).map(mapSection),
  };
}

function mapSection(row: Record<string, unknown>): ModuleSectionSpec {
  return {
    sectionId:    row.section_id as string,
    sectionOrder: row.section_order as number,
    contentType:  row.content_type as ContentType,
    body:         row.body as Record<string, unknown>,
  };
}
