import { createAgentServer, AgentManifest, ContextRequest, ActionRequest, PeriodType } from '@coaching/sdk';
import { configureBridge, createProgramPeriod, listModulesForCoach, listProgramsForCoach, removeModuleFromProgram, getProgramWithPeriods, addSection, updateSection, deleteSection, updateModule, getAllModuleSections } from '@coaching/tools';
import {
  scaffoldModule, addContentToSection, forkModule, previewModule,
} from '@coaching/skills';
import {
  buildProgram, buildProgramWithPeriods, createInlineModule,
} from '@coaching/skills';
import {
  assemblePackage, publishPackage,
} from '@coaching/skills';
import {
  licenseModuleToCoach,
} from '@coaching/skills';
import {
  saveClientModuleData, loadClientModuleData, loadAllClientsForModule,
} from '@coaching/skills';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001', 10);
const AGENT_ID = 'coaching-program-builder';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Program Builder',
  version:         '2.0.0',
  description:     'Build coaching modules, programs and packages with timeline support, inline module creation, and per-client data.',
  icon:            '📚',
  domain:          ['programs', 'coaching', 'content'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'flow-wizard' },
  panelSpec: {
    layout: 'two-column',
    sections: [],
  },
  actions: [
    // Existing actions
    { name: 'create_module',    description: 'Create a new standalone module',
      params: { title: { type: 'string', required: true, description: 'Module title' }, category: { type: 'string', required: true, description: 'Category' }, derivedFromModuleId: { type: 'string', required: false, description: 'Parent module ID' } } },
    { name: 'add_section',     description: 'Add a new content section to a module',
      params: { moduleId: { type: 'string', required: true, description: 'Module to add section to' }, order: { type: 'number', required: true, description: '0-based section order' }, contentType: { type: 'string', required: true, description: 'text|video|long_form_qa|single_choice|multi_choice|match_following|rating|assignment' }, body: { type: 'object', required: true, description: 'Section body' }, visibleTo: { type: 'array', required: true, description: 'client|trainee|delivery' } } },
    { name: 'update_section',  description: 'Edit an existing section on a module',
      params: { sectionId: { type: 'string', required: true, description: 'Section ID' }, contentType: { type: 'string', required: true, description: '' }, body: { type: 'object', required: true, description: '' }, visibleTo: { type: 'array', required: true, description: '' } } },
    { name: 'delete_section',  description: 'Delete a section from a module',
      params: { sectionId: { type: 'string', required: true, description: 'Section ID' } } },
    { name: 'get_module_detail', description: 'Load all sections for a module (coach view, no visibility filter)',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' } } },
    { name: 'update_module',   description: 'Edit a module title or category',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, title: { type: 'string', required: false, description: 'New title' }, category: { type: 'string', required: false, description: 'New category' } } },
    { name: 'fork_module',     description: 'Fork a licensed module',
      params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'build_program',   description: 'Build a flat program from existing modules',
      params: { title: { type: 'string', required: true, description: '' }, moduleIds: { type: 'array', required: true, description: '' } } },
    { name: 'assemble_package', description: 'Assemble a coaching package',
      params: { personaSnapshotId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: true, description: '' }, programIds: { type: 'array', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' } } },
    { name: 'publish_package', description: 'Publish a package (validates all programs and modules are published)',
      params: { packageId: { type: 'string', required: true, description: '' } } },
    { name: 'preview_module',  description: 'Preview module sections filtered by view type',
      params: { moduleId: { type: 'string', required: true, description: '' }, viewType: { type: 'string', required: true, description: 'client | trainee | delivery', enum: ['client', 'trainee', 'delivery'] } } },
    { name: 'license_module',  description: 'License a module to another coach',
      params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
    { name: 'update_license_depth', description: 'Update propagation depth on a license',
      params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },

    // New: list helpers for UI dropdowns
    { name: 'list_modules',  description: 'List all modules owned by this coach',  params: {} },
    { name: 'list_programs', description: 'List all programs owned by this coach', params: {} },
    { name: 'get_program_detail', description: 'Load a program with all its modules and periods',
      params: { programId: { type: 'string', required: true, description: 'Program ID' } } },
    { name: 'remove_module_from_program', description: 'Remove a module from a program (module is not deleted, only its assignment to this program)',
      params: {
        programId: { type: 'string', required: true, description: 'Program ID' },
        moduleId:  { type: 'string', required: true, description: 'Module ID' },
      } },

    // New: timeline programs
    { name: 'build_program_with_periods', description: 'Build a timeline program (weeks/months/etc.) with modules per period',
      params: {
        title:       { type: 'string', required: true,  description: 'Program title' },
        description: { type: 'string', required: false, description: 'Program description' },
        periods:     { type: 'array',  required: true,  description: 'Array of {label, periodType, moduleIds[]}' },
      } },
    { name: 'create_program_period', description: 'Add a period to an existing program',
      params: {
        programId:   { type: 'string', required: true,  description: 'Program ID' },
        periodOrder: { type: 'number', required: true,  description: '0-based display order' },
        label:       { type: 'string', required: true,  description: 'e.g. "Week 1"' },
        periodType:  { type: 'string', required: true,  description: 'week|day|month|quarter|custom', enum: ['week','day','month','quarter','custom'] },
      } },
    { name: 'create_inline_module', description: 'Create a module inline within a program period (module is saved to the module library and reusable)',
      params: {
        programId:    { type: 'string', required: true,  description: 'Program the module belongs to' },
        periodId:     { type: 'string', required: false, description: 'Period to assign to (optional)' },
        title:        { type: 'string', required: true,  description: 'Module title' },
        category:     { type: 'string', required: true,  description: 'Module category' },
        displayOrder: { type: 'number', required: true,  description: 'Order within period or program' },
      } },

    // New: per-module client data (high privacy)
    { name: 'save_client_module_data', description: 'Save private coaching notes/observations for a specific client on a module (visible only to this coach)',
      params: {
        moduleId: { type: 'string', required: true,  description: 'Module ID' },
        clientId: { type: 'string', required: true,  description: 'Client ID' },
        data:     { type: 'object', required: true,  description: '{notes?, observations?, customFields?}' },
      } },
    { name: 'load_client_module_data', description: 'Load this coach\'s private data for a client+module pair',
      params: {
        moduleId: { type: 'string', required: true,  description: 'Module ID' },
        clientId: { type: 'string', required: true,  description: 'Client ID' },
      } },
    { name: 'load_all_clients_for_module', description: 'Load this coach\'s private data for all their clients on a module',
      params: {
        moduleId: { type: 'string', required: true, description: 'Module ID' },
      } },
  ],
};

async function onContext(req: ContextRequest) {
  const userId = req.userId;
  const [{ data: packages }, { data: modules }, { data: licenses }] = await Promise.all([
    supabase.from('coaching_packages').select('package_id, title, is_published').eq('coach_id', userId),
    supabase.from('modules').select('module_id, title, is_published').eq('creator_coach_id', userId),
    supabase.from('module_licenses').select('license_id').eq('licensor_coach_id', userId),
  ]);

  const published = (packages ?? []).filter((p: Record<string, unknown>) => p.is_published).length;
  const drafts    = (modules ?? []).filter((m: Record<string, unknown>) => !m.is_published);

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${published} published package(s) · ${(modules ?? []).length} modules · ${(licenses ?? []).length} active license(s)`,
      keyEntities: (packages ?? []).slice(0, 5).map((p: Record<string, unknown>) => ({ id: p.package_id as string, type: 'package', label: p.title as string, attributes: {} })),
      recentEvents: [],
      pendingActions: drafts.slice(0, 3).map((m: Record<string, unknown>) => ({ type: 'draft_module', label: `Module "${m.title}" is unpublished`, priority: 'medium' as const })),
      rawContext: {
        modules:  (modules ?? []).map((m: Record<string, unknown>) => ({ module_id: m.module_id, title: m.title, category: m.category ?? '', is_published: m.is_published ? 'published' : 'draft' })),
        packages: (packages ?? []).map((p: Record<string, unknown>) => ({ package_id: p.package_id, title: p.title, is_published: p.is_published ? 'published' : 'draft' })),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {

    // ── Existing actions ──────────────────────────────────────────────────────

    case 'create_module':
      return { success: true, message: 'Module created',
        data: await scaffoldModule(uid, p.title as string, p.category as string) as unknown as Record<string, unknown> };

    case 'add_section': {
      const sec = await addSection(
        p.moduleId as string,
        p.order as number ?? 0,
        p.visibleTo as never,
        p.contentType as never,
        p.body as Record<string, unknown>
      );
      return { success: true, message: 'Section added', data: sec as unknown as Record<string, unknown> };
    }

    case 'update_section':
      await updateSection(p.sectionId as string, {
        contentType: p.contentType as never,
        body:        p.body as Record<string, unknown>,
        visibleTo:   p.visibleTo as never,
      });
      return { success: true, message: 'Section updated' };

    case 'delete_section':
      await deleteSection(p.sectionId as string);
      return { success: true, message: 'Section deleted' };

    case 'get_module_detail':
      return { success: true, message: 'Loaded',
        data: { sections: await getAllModuleSections(p.moduleId as string) } };

    case 'update_module':
      await updateModule(p.moduleId as string, { title: p.title as string | undefined, category: p.category as string | undefined });
      return { success: true, message: 'Module updated' };

    case 'fork_module':
      return { success: true, message: 'Module forked',
        data: await forkModule(p.moduleId as string, uid) as unknown as Record<string, unknown> };

    case 'build_program':
      return { success: true, message: 'Program built',
        data: await buildProgram(uid, p.title as string, p.moduleIds as string[]) as unknown as Record<string, unknown> };

    case 'assemble_package':
      return { success: true, message: 'Package assembled',
        data: await assemblePackage(uid, p.personaSnapshotId as string, p.title as string, p.programIds as string[], { model: p.pricingModel as never, priceUsd: p.priceUsd as number | undefined }) as unknown as Record<string, unknown> };

    case 'publish_package':
      await publishPackage(p.packageId as string);
      return { success: true, message: 'Package published' };

    case 'preview_module':
      return { success: true, message: 'Preview',
        data: { sections: await previewModule(p.moduleId as string, p.viewType as never) } };

    case 'license_module':
      await licenseModuleToCoach(uid, p.licenseeCoachId as string, p.moduleId as string, {
        directCutPct:     p.directCutPct as number,
        derivativeCutPct: p.derivativeCutPct as number,
        propagateToDepth: (p.propagateToDepth as number | null) ?? null,
        canSublicense:    (p.canSublicense as boolean) ?? false,
      });
      return { success: true, message: 'License created' };

    case 'update_license_depth':
      await supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
      return { success: true, message: 'License updated' };

    // ── New: list helpers ─────────────────────────────────────────────────────

    case 'list_modules':
      return { success: true, message: 'Modules loaded',
        data: { modules: await listModulesForCoach(uid) } };

    case 'list_programs':
      return { success: true, message: 'Programs loaded',
        data: { programs: await listProgramsForCoach(uid) } };

    case 'get_program_detail':
      return { success: true, message: 'Loaded',
        data: await getProgramWithPeriods(p.programId as string) as unknown as Record<string, unknown> };

    case 'remove_module_from_program':
      await removeModuleFromProgram(p.programId as string, p.moduleId as string);
      return { success: true, message: 'Module removed from program' };

    // ── New: timeline programs ────────────────────────────────────────────────

    case 'build_program_with_periods':
      return { success: true, message: 'Program built',
        data: await buildProgramWithPeriods(
          uid,
          p.title as string,
          p.description as string | undefined,
          p.periods as Array<{ label: string; periodType: PeriodType; moduleIds: string[] }>
        ) as unknown as Record<string, unknown> };

    case 'create_program_period':
      return { success: true, message: 'Period created',
        data: await createProgramPeriod(
          p.programId as string,
          p.periodOrder as number,
          p.label as string,
          p.periodType as PeriodType
        ) as unknown as Record<string, unknown> };

    case 'create_inline_module':
      return { success: true, message: 'Module created',
        data: await createInlineModule(
          uid,
          p.programId as string,
          p.periodId as string | undefined,
          p.title as string,
          p.category as string,
          p.displayOrder as number
        ) as unknown as Record<string, unknown> };

    // ── New: per-module client data ───────────────────────────────────────────
    // coachId is always taken from uid (session), never from params.

    case 'save_client_module_data':
      return { success: true, message: 'Client data saved',
        data: await saveClientModuleData(uid, p.moduleId as string, p.clientId as string, p.data as Record<string, unknown>) as unknown as Record<string, unknown> };

    case 'load_client_module_data':
      return { success: true, message: 'Loaded',
        data: (await loadClientModuleData(uid, p.moduleId as string, p.clientId as string)) as unknown as Record<string, unknown> };

    case 'load_all_clients_for_module':
      return { success: true, message: 'Loaded',
        data: { records: await loadAllClientsForModule(uid, p.moduleId as string) } };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
