import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge } from '@coaching/tools';
import {
  scaffoldModule, addContentToSection, forkModule, previewModule,
} from '@coaching/skills';
import {
  buildProgram,
} from '@coaching/skills';
import {
  assemblePackage, publishPackage,
} from '@coaching/skills';
import {
  licenseModuleToCoach,
} from '@coaching/skills';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001', 10);
const AGENT_ID = 'coaching-program-builder';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Program Builder',
  version:         '1.0.0',
  description:     'Build coaching modules, programs and packages with three-view content architecture.',
  icon:            '📚',
  domain:          ['programs', 'coaching', 'content'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'flow-wizard' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      { type: 'text-summary', id: 'pb-summary', title: 'Overview', dataKey: 'summary' },
      { type: 'card-list',    id: 'pb-modules',  title: 'My Modules',          dataKey: 'modules',  titleKey: 'title', subtitleKey: 'category', metaKey: 'is_published' },
      { type: 'action-form',  id: 'pb-create',   title: 'Create Module',       action: 'create_module', submitLabel: 'Create',
        fields: [
          { name: 'title',    label: 'Title',    inputType: 'text',   required: true },
          { name: 'category', label: 'Category', inputType: 'select', required: true, options: ['mindset', 'nutrition', 'fitness', 'business', 'leadership'] },
        ],
      },
      { type: 'action-form',  id: 'pb-program',  title: 'Build Program',       action: 'build_program', submitLabel: 'Build',
        fields: [
          { name: 'title',     label: 'Program Title',                  inputType: 'text',     required: true },
          { name: 'moduleIds', label: 'Module IDs (comma-separated)',   inputType: 'textarea', required: true },
        ],
      },
      { type: 'card-list',    id: 'pb-packages', title: 'Published Packages',  dataKey: 'packages', titleKey: 'title', subtitleKey: 'is_published' },
    ],
  },
  actions: [
    { name: 'create_module',         description: 'Create a new module',                    params: { title: { type: 'string', required: true, description: 'Module title' }, category: { type: 'string', required: true, description: 'Category' }, derivedFromModuleId: { type: 'string', required: false, description: 'Parent module ID' } } },
    { name: 'add_section',           description: 'Add content section to a module',        params: { moduleId: { type: 'string', required: true, description: '' }, contentType: { type: 'string', required: true, description: '' }, body: { type: 'object', required: true, description: '' }, visibleTo: { type: 'array', required: true, description: '' } } },
    { name: 'fork_module',           description: 'Fork a licensed module',                 params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'build_program',         description: 'Build a program from modules',           params: { title: { type: 'string', required: true, description: '' }, moduleIds: { type: 'array', required: true, description: '' } } },
    { name: 'assemble_package',      description: 'Assemble a coaching package',            params: { personaSnapshotId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: true, description: '' }, programIds: { type: 'array', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' } } },
    { name: 'publish_package',       description: 'Publish a package',                      params: { packageId: { type: 'string', required: true, description: '' } } },
    { name: 'preview_module',        description: 'Preview module sections by view type',   params: { moduleId: { type: 'string', required: true, description: '' }, viewType: { type: 'string', required: true, description: 'client | trainee | delivery', enum: ['client', 'trainee', 'delivery'] } } },
    { name: 'license_module',        description: 'License a module to another coach',      params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
    { name: 'update_license_depth',  description: 'Update propagation depth on a license', params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
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
    case 'create_module':
      return { success: true, message: 'Module created', data: await scaffoldModule(uid, p.title as string, p.category as string) as unknown as Record<string, unknown> };

    case 'add_section':
      await addContentToSection(p.sectionId as string, p.contentType as never, p.body as Record<string, unknown>, p.visibleTo as never);
      return { success: true, message: 'Section updated' };

    case 'fork_module':
      return { success: true, message: 'Module forked', data: await forkModule(p.moduleId as string, uid) as unknown as Record<string, unknown> };

    case 'build_program':
      return { success: true, message: 'Program built', data: await buildProgram(uid, p.title as string, p.moduleIds as string[]) as unknown as Record<string, unknown> };

    case 'assemble_package':
      return { success: true, message: 'Package assembled', data: await assemblePackage(uid, p.personaSnapshotId as string, p.title as string, p.programIds as string[], { model: p.pricingModel as never, priceUsd: p.priceUsd as number | undefined }) as unknown as Record<string, unknown> };

    case 'publish_package':
      await publishPackage(p.packageId as string);
      return { success: true, message: 'Package published' };

    case 'preview_module':
      return { success: true, message: 'Preview', data: { sections: await previewModule(p.moduleId as string, p.viewType as never) } };

    case 'license_module':
      await licenseModuleToCoach(uid, p.licenseeCoachId as string, p.moduleId as string, {
        directCutPct:      p.directCutPct as number,
        derivativeCutPct:  p.derivativeCutPct as number,
        propagateToDepth:  (p.propagateToDepth as number | null) ?? null,
        canSublicense:     (p.canSublicense as boolean) ?? false,
      });
      return { success: true, message: 'License created' };

    case 'update_license_depth':
      await supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
      return { success: true, message: 'License updated' };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
