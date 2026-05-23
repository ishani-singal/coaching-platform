"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModule = createModule;
exports.addSection = addSection;
exports.updateSection = updateSection;
exports.deleteSection = deleteSection;
exports.deleteModule = deleteModule;
exports.reorderSections = reorderSections;
exports.getModuleWithSections = getModuleWithSections;
exports.forkModule = forkModule;
exports.updateModule = updateModule;
exports.getAllModuleSections = getAllModuleSections;
exports.pruneEmptySections = pruneEmptySections;
const sdk_1 = require("@coaching/sdk");
async function createModule(coachId, title, category, derivedFromId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .insert({
        creator_coach_id: coachId,
        title,
        category,
        derived_from_module_id: derivedFromId ?? null,
    })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapModule(data);
}
async function addSection(moduleId, order, contentType, body) {
    const { data, error } = await sdk_1.supabase.rpc('append_module_section', {
        p_module_id: moduleId,
        p_section_order: order,
        p_content_type: contentType,
        p_body: body,
    });
    if (error)
        throw new Error(error.message);
    return mapSection(data);
}
async function updateSection(moduleId, sectionId, patch) {
    const { error } = await sdk_1.supabase.rpc('update_module_section', {
        p_module_id: moduleId,
        p_section_id: sectionId,
        p_content_type: patch.contentType ?? null,
        p_body: patch.body ?? null,
        p_section_order: patch.sectionOrder ?? null,
    });
    if (error)
        throw new Error(error.message);
}
async function deleteSection(moduleId, sectionId) {
    const { error } = await sdk_1.supabase.rpc('delete_module_section', {
        p_module_id: moduleId,
        p_section_id: sectionId,
    });
    if (error)
        throw new Error(error.message);
}
async function deleteModule(moduleId, coachId) {
    // Remove all FK dependents first (none of these have ON DELETE CASCADE)
    await sdk_1.supabase.from('program_modules').delete().eq('module_id', moduleId);
    await sdk_1.supabase.from('module_licenses').delete().eq('module_id', moduleId);
    await sdk_1.supabase.from('module_ancestry').delete().or(`module_id.eq.${moduleId},ancestor_module_id.eq.${moduleId}`);
    // Null out any module that was derived from this one
    await sdk_1.supabase.from('modules').update({ derived_from_module_id: null }).eq('derived_from_module_id', moduleId);
    // Null out enrollment tracking pointer on any clients at this module
    await sdk_1.supabase.from('client_profiles').update({ current_module_id: null }).eq('current_module_id', moduleId);
    const { error } = await sdk_1.supabase.from('modules').delete()
        .eq('module_id', moduleId)
        .eq('creator_coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function reorderSections(moduleId, orderedSectionIds) {
    const { error } = await sdk_1.supabase.rpc('reorder_module_sections', {
        p_module_id: moduleId,
        p_ordered_ids: orderedSectionIds,
    });
    if (error)
        throw new Error(error.message);
}
async function getModuleWithSections(moduleId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .select('*')
        .eq('module_id', moduleId)
        .single();
    if (error)
        throw new Error(error.message);
    return mapModule(data);
}
async function forkModule(originalModuleId, newCoachId, opts) {
    const { data: orig, error: e1 } = await sdk_1.supabase
        .from('modules')
        .select('*')
        .eq('module_id', originalModuleId)
        .single();
    if (e1)
        throw new Error(e1.message);
    // Guard: no_sublicense modules cannot be forked by a different coach
    if (orig.no_sublicense && newCoachId !== orig.creator_coach_id) {
        throw new Error('This module cannot be forked');
    }
    const { data: newMod, error: e2 } = await sdk_1.supabase
        .from('modules')
        .insert({
        creator_coach_id: newCoachId,
        title: orig.title,
        category: orig.category,
        derived_from_module_id: originalModuleId,
        sections: orig.sections,
        no_sublicense: opts?.noSublicense ?? false,
    })
        .select()
        .single();
    if (e2)
        throw new Error(e2.message);
    // Load existing ancestry for the original module
    const { data: ancestry } = await sdk_1.supabase
        .from('module_ancestry')
        .select('*')
        .eq('module_id', originalModuleId);
    // Load license to get propagate_to_depth
    const { data: license } = await sdk_1.supabase
        .from('module_licenses')
        .select('propagate_to_depth, direct_cut_pct, licensor_coach_id')
        .eq('module_id', originalModuleId)
        .eq('licensee_coach_id', newCoachId)
        .maybeSingle();
    const propagateToDepth = license?.propagate_to_depth ?? null;
    const newAncestryRows = [];
    // Carry forward existing ancestors if within depth limit
    for (const row of ancestry ?? []) {
        const newDepth = row.depth + 1;
        if (propagateToDepth === null || newDepth <= propagateToDepth) {
            newAncestryRows.push({
                module_id: newMod.module_id,
                ancestor_module_id: row.ancestor_module_id,
                ancestor_coach_id: row.ancestor_coach_id,
                depth: newDepth,
                applicable_cut_pct: row.applicable_cut_pct,
            });
        }
    }
    // Add depth=1 row for direct parent
    newAncestryRows.push({
        module_id: newMod.module_id,
        ancestor_module_id: originalModuleId,
        ancestor_coach_id: orig.creator_coach_id,
        depth: 1,
        applicable_cut_pct: license?.direct_cut_pct ?? 0,
    });
    if (newAncestryRows.length > 0) {
        await sdk_1.supabase.from('module_ancestry').insert(newAncestryRows);
    }
    return mapModule(newMod);
}
async function updateModule(moduleId, patch) {
    const update = {};
    if (patch.title !== undefined)
        update.title = patch.title;
    if (patch.category !== undefined)
        update.category = patch.category;
    if (Object.keys(update).length === 0)
        return;
    const { error } = await sdk_1.supabase.from('modules').update(update).eq('module_id', moduleId);
    if (error)
        throw new Error(error.message);
}
async function getAllModuleSections(moduleId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .select('sections')
        .eq('module_id', moduleId)
        .single();
    if (error)
        throw new Error(error.message);
    const mapped = (data?.sections ?? []).map(mapSection);
    const seen = new Set();
    return mapped.filter(s => {
        if (seen.has(s.sectionId))
            return false;
        seen.add(s.sectionId);
        return true;
    });
}
function isSectionNonEmpty(contentType, body) {
    switch (contentType) {
        case 'text':
        case 'facilitation_guide':
            return typeof body.content === 'string' && body.content.trim() !== '';
        case 'video':
            return typeof body.embedUrl === 'string' && body.embedUrl.trim() !== '';
        case 'pdf':
            return typeof body.url === 'string' && body.url.trim() !== '';
        case 'task':
            return Array.isArray(body.items) && body.items.length > 0;
        case 'check_in':
        case 'rating':
            return typeof body.prompt === 'string' && body.prompt.trim() !== '';
        case 'quiz':
            return Array.isArray(body.questions) && body.questions.length > 0;
        case 'long_form_qa':
        case 'single_choice':
        case 'multi_choice':
            return typeof body.question === 'string' && body.question.trim() !== '';
        case 'match_following':
            return Array.isArray(body.pairs) && body.pairs.length > 0;
        case 'assignment':
            return [
                body.title, body.instructions,
            ].some(v => typeof v === 'string' && v.trim() !== '');
        default:
            return Object.values(body).some(v => v !== null && v !== undefined && v !== '');
    }
}
async function pruneEmptySections(moduleId) {
    const sections = await getAllModuleSections(moduleId);
    if (sections.length === 0)
        return;
    const emptyIds = sections
        .filter(s => !isSectionNonEmpty(s.contentType, s.body))
        .map(s => s.sectionId);
    if (emptyIds.length === 0)
        return;
    await Promise.all(emptyIds.map(id => deleteSection(moduleId, id)));
}
function mapModule(row) {
    return {
        moduleId: row.module_id,
        creatorCoachId: row.creator_coach_id,
        title: row.title,
        category: (row.category ?? ''),
        version: row.version,
        derivedFromModuleId: row.derived_from_module_id,
        noSublicense: row.no_sublicense ?? false,
        sections: (row.sections ?? []).map(mapSection),
    };
}
function mapSection(row) {
    return {
        sectionId: row.section_id,
        sectionOrder: row.section_order,
        contentType: row.content_type,
        body: row.body,
    };
}
//# sourceMappingURL=moduleTools.js.map