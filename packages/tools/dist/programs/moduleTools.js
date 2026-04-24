"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModule = createModule;
exports.addSection = addSection;
exports.updateSection = updateSection;
exports.deleteSection = deleteSection;
exports.reorderSections = reorderSections;
exports.publishModule = publishModule;
exports.getModuleWithSections = getModuleWithSections;
exports.forkModule = forkModule;
const sdk_1 = require("@coaching/sdk");
async function createModule(coachId, title, category, derivedFromId) {
    const { data, error } = await sdk_1.supabase
        .from('modules')
        .insert({ creator_coach_id: coachId, title, category, derived_from_module_id: derivedFromId ?? null })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapModule(data);
}
async function addSection(moduleId, order, visibleTo, contentType, body) {
    const { data, error } = await sdk_1.supabase
        .from('module_sections')
        .insert({ module_id: moduleId, section_order: order, visible_to: visibleTo, content_type: contentType, body })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapSection(data);
}
async function updateSection(sectionId, patch) {
    const update = {};
    if (patch.visibleTo)
        update.visible_to = patch.visibleTo;
    if (patch.contentType)
        update.content_type = patch.contentType;
    if (patch.body)
        update.body = patch.body;
    if (patch.sectionOrder !== undefined)
        update.section_order = patch.sectionOrder;
    await sdk_1.supabase.from('module_sections').update(update).eq('section_id', sectionId);
}
async function deleteSection(sectionId) {
    await sdk_1.supabase.from('module_sections').delete().eq('section_id', sectionId);
}
async function reorderSections(moduleId, orderedSectionIds) {
    await Promise.all(orderedSectionIds.map((id, idx) => sdk_1.supabase.from('module_sections').update({ section_order: idx }).eq('section_id', id).eq('module_id', moduleId)));
}
async function publishModule(moduleId) {
    await sdk_1.supabase.from('modules').update({ is_published: true }).eq('module_id', moduleId);
}
async function getModuleWithSections(moduleId, viewType) {
    const { data: mod, error } = await sdk_1.supabase
        .from('modules')
        .select('*')
        .eq('module_id', moduleId)
        .single();
    if (error)
        throw new Error(error.message);
    const { data: sections } = await sdk_1.supabase
        .from('module_sections')
        .select('*')
        .eq('module_id', moduleId)
        .contains('visible_to', [viewType])
        .order('section_order');
    return { ...mapModule(mod), sections: (sections ?? []).map(mapSection) };
}
async function forkModule(originalModuleId, newCoachId) {
    const { data: orig, error: e1 } = await sdk_1.supabase
        .from('modules')
        .select('*')
        .eq('module_id', originalModuleId)
        .single();
    if (e1)
        throw new Error(e1.message);
    const { data: newMod, error: e2 } = await sdk_1.supabase
        .from('modules')
        .insert({
        creator_coach_id: newCoachId,
        title: orig.title,
        category: orig.category,
        derived_from_module_id: originalModuleId,
    })
        .select()
        .single();
    if (e2)
        throw new Error(e2.message);
    const { data: sections } = await sdk_1.supabase
        .from('module_sections')
        .select('*')
        .eq('module_id', originalModuleId);
    if (sections && sections.length > 0) {
        await sdk_1.supabase.from('module_sections').insert(sections.map((s) => ({
            module_id: newMod.module_id,
            section_order: s.section_order,
            visible_to: s.visible_to,
            content_type: s.content_type,
            body: s.body,
        })));
    }
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
function mapModule(row) {
    return {
        moduleId: row.module_id,
        creatorCoachId: row.creator_coach_id,
        title: row.title,
        category: (row.category ?? ''),
        version: row.version,
        derivedFromModuleId: row.derived_from_module_id,
        isPublished: row.is_published,
    };
}
function mapSection(row) {
    return {
        sectionId: row.section_id,
        sectionOrder: row.section_order,
        visibleTo: row.visible_to,
        contentType: row.content_type,
        body: row.body,
    };
}
//# sourceMappingURL=moduleTools.js.map