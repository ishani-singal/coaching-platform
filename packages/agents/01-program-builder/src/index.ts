import { createAgentServer, AgentManifest, ContextRequest, ActionRequest, PeriodType, CertificateTemplate } from '@coaching/sdk';
// v5 - getPackageDetail reads programs.periods JSONB (program_modules dropped in migration 025)
import { configureBridge, createProgramPeriod, listModulesForCoach, listProgramsForCoach, removeModuleFromProgram, removeModuleFromPeriod, getProgramWithPeriods, addSection, updateSection, deleteSection, updateModule, getAllModuleSections, ensureCoachProfile, getAllPackagesForCoach, getPackageDetail, deleteModule, deleteProgram, deletePackage, updatePackage, relinkPackagePrograms, updateProgram, saveCoachYouTubeChannel, getCoachYouTubeChannel, fetchChannelVideos, addModuleToPeriodByOrder, deleteProgramPeriod, updateProgramPeriod } from '@coaching/tools';
import {
  scaffoldModule, addContentToSection, forkModule, previewModule,
} from '@coaching/skills';
import {
  buildProgram, buildProgramWithPeriods, createInlineModule,
} from '@coaching/skills';
import {
  assemblePackage, publishPackage, unpublishPackage,
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
  version:         '2.0.0',
  description:     'Build coaching modules, programs and packages with timeline support and inline module creation.',
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
      params: { moduleId: { type: 'string', required: true, description: 'Module to add section to' }, order: { type: 'number', required: true, description: '0-based section order' }, contentType: { type: 'string', required: true, description: 'text|video|long_form_qa|single_choice|multi_choice|match_following|rating|assignment' }, body: { type: 'object', required: true, description: 'Section body' } } },
    { name: 'update_section',  description: 'Edit an existing section on a module',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, sectionId: { type: 'string', required: true, description: 'Section ID' }, contentType: { type: 'string', required: true, description: '' }, body: { type: 'object', required: true, description: '' } } },
    { name: 'delete_section',  description: 'Delete a section from a module',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, sectionId: { type: 'string', required: true, description: 'Section ID' } } },
    { name: 'get_module_detail', description: 'Load all sections for a module (coach view, no visibility filter)',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' } } },
    { name: 'update_module',   description: 'Edit a module title or category',
      params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, title: { type: 'string', required: false, description: 'New title' }, category: { type: 'string', required: false, description: 'New category' } } },
    { name: 'fork_module',     description: 'Fork a licensed module',
      params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'build_program',   description: 'Build a flat program from existing modules',
      params: { title: { type: 'string', required: true, description: '' }, moduleIds: { type: 'array', required: true, description: '' } } },
    { name: 'assemble_package', description: 'Assemble a coaching package',
      params: { title: { type: 'string', required: true, description: '' }, programIds: { type: 'array', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' }, currencies: { type: 'array', required: false, description: '' }, totalSeats: { type: 'number', required: false, description: '' }, showSeatsFilled: { type: 'boolean', required: false, description: '' }, applyDeadline: { type: 'string', required: false, description: '' }, discountPrice: { type: 'number', required: false, description: '' }, discountUntil: { type: 'string', required: false, description: '' }, certificateUrl: { type: 'string', required: false, description: 'URL to a downloadable completion certificate' }, certificateTemplate: { type: 'object', required: false, description: 'Structured certificate template config (designVariant, title, coachName, accentColor, etc.)' }, includedProgramIds: { type: 'array', required: false, description: 'Program IDs to fork into trainee account on graduation (no-sublicense)' } } },
    { name: 'update_package', description: 'Update an existing package title, pricing, seats, deadlines and discount',
      params: { packageId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' }, currencies: { type: 'array', required: false, description: '' }, totalSeats: { type: 'number', required: false, description: '' }, showSeatsFilled: { type: 'boolean', required: false, description: '' }, applyDeadline: { type: 'string', required: false, description: '' }, discountPrice: { type: 'number', required: false, description: '' }, discountUntil: { type: 'string', required: false, description: '' }, certificateUrl: { type: 'string', required: false, description: 'URL to a downloadable completion certificate' }, certificateTemplate: { type: 'object', required: false, description: 'Structured certificate template config (designVariant, title, coachName, accentColor, etc.)' }, includedProgramIds: { type: 'array', required: false, description: 'Program IDs to fork into trainee account on graduation (no-sublicense)' } } },
    { name: 'publish_package', description: 'Publish a package (validates all programs and modules are published)',
      params: { packageId: { type: 'string', required: true, description: '' } } },
    { name: 'unpublish_package', description: 'Unpublish a package (hides it from the public coach page)',
      params: { packageId: { type: 'string', required: true, description: '' } } },
    { name: 'preview_module',  description: 'Preview module sections',
      params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'license_module',  description: 'License a module to another coach',
      params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
    { name: 'update_license_depth', description: 'Update propagation depth on a license',
      params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },

    // New: list helpers for UI dropdowns
    { name: 'list_modules',   description: 'List all modules owned by this coach',  params: {} },
    { name: 'list_programs',  description: 'List all programs owned by this coach', params: {} },
    { name: 'list_packages',      description: 'List all packages owned by this coach', params: {} },
    { name: 'get_package_detail', description: 'Get a package with its programs and modules',
      params: { packageId: { type: 'string', required: true, description: 'Package ID' } } },
    { name: 'delete_module',  description: 'Delete a module owned by this coach',
      params: { moduleId:  { type: 'string', required: true, description: 'Module ID'  } } },
    { name: 'delete_program', description: 'Delete a program owned by this coach',
      params: { programId: { type: 'string', required: true, description: 'Program ID' } } },
    { name: 'delete_package', description: 'Delete a package owned by this coach',
      params: { packageId: { type: 'string', required: true, description: 'Package ID' } } },
    { name: 'get_program_detail', description: 'Load a program with all its modules and periods',
      params: { programId: { type: 'string', required: true, description: 'Program ID' } } },
    { name: 'remove_module_from_program', description: 'Remove a module from a program (module is not deleted, only its assignment to this program)',
      params: {
        programId: { type: 'string', required: true, description: 'Program ID' },
        moduleId:  { type: 'string', required: true, description: 'Module ID' },
      } },
    { name: 'remove_module_from_period', description: 'Remove a module from a specific period only (module is not deleted)',
      params: {
        programId:   { type: 'string', required: true, description: 'Program ID' },
        periodOrder: { type: 'number', required: true, description: 'Period order index' },
        moduleId:    { type: 'string', required: true, description: 'Module ID' },
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
        periodOrder:  { type: 'number', required: false, description: 'Period order index to assign to (defaults to 0)' },
        title:        { type: 'string', required: true,  description: 'Module title' },
        category:     { type: 'string', required: true,  description: 'Module category' },
        displayOrder: { type: 'number', required: true,  description: 'Order within period or program' },
      } },

    // Period & module management on existing programs
    { name: 'add_module_to_period', description: 'Assign an existing module to a period',
      params: {
        programId:    { type: 'string', required: true,  description: 'Program ID' },
        moduleId:     { type: 'string', required: true,  description: 'Module ID to add' },
        periodOrder:  { type: 'number', required: true,  description: 'Period order index' },
        displayOrder: { type: 'number', required: true,  description: 'Position in period' },
      } },
    { name: 'delete_program_period', description: 'Delete a period from a program (modules are moved to the lowest-order remaining period)',
      params: { programId: { type: 'string', required: true, description: 'Program ID' }, periodOrder: { type: 'number', required: true, description: 'Period order index' } } },
    { name: 'rename_program_period', description: 'Rename a program period label',
      params: { programId: { type: 'string', required: true, description: 'Program ID' }, periodOrder: { type: 'number', required: true, description: 'Period order index' }, label: { type: 'string', required: true, description: 'New label' } } },

    // Program editing
    { name: 'update_program', description: 'Edit a program title, description, or cover image',
      params: { programId: { type: 'string', required: true, description: 'Program ID' }, title: { type: 'string', required: false, description: 'New title' }, description: { type: 'string', required: false, description: 'New description' }, coverImageUrl: { type: 'string', required: false, description: 'Cover image URL or CSS gradient string' } } },

    // YouTube channel connector
    { name: 'save_youtube_channel', description: 'Save the coach\'s YouTube channel URL',
      params: { channelUrl: { type: 'string', required: true, description: 'YouTube channel URL' } } },
    { name: 'get_youtube_channel', description: 'Get the coach\'s saved YouTube channel URL',
      params: {} },
    { name: 'list_my_youtube_videos', description: 'List videos from the coach\'s connected YouTube channel',
      params: {} },
    { name: 'load_all', description: 'Load modules, programs, and packages in a single call',
      params: {} },
  ],
};

async function onContext(req: ContextRequest) {
  const userId = req.userId;
  const [{ data: packages }, { data: modules }, { data: licenses }, { data: programs }] = await Promise.all([
    supabase.from('packages').select('package_id, title, is_published').eq('coach_id', userId),
    supabase.from('modules').select('module_id, title, category').eq('creator_coach_id', userId),
    supabase.from('module_licenses').select('license_id').eq('licensor_coach_id', userId),
    supabase.from('programs').select('program_id, title').eq('creator_coach_id', userId),
  ]);

  const published = (packages ?? []).filter((p: Record<string, unknown>) => p.is_published).length;

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${published} published package(s) · ${(modules ?? []).length} modules · ${(licenses ?? []).length} active license(s)`,
      keyEntities: (packages ?? []).slice(0, 5).map((p: Record<string, unknown>) => ({ id: p.package_id as string, type: 'package', label: p.title as string, attributes: {} })),
      recentEvents: [],
      pendingActions: [],
      rawContext: {
        modules:  (modules ?? []).map((m: Record<string, unknown>) => ({ module_id: m.module_id, title: m.title, category: m.category ?? '' })),
        programs: (programs ?? []).map((p: Record<string, unknown>) => ({ program_id: p.program_id, title: p.title })),
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
      await ensureCoachProfile(uid);
      return { success: true, message: 'Module created',
        data: await scaffoldModule(uid, p.title as string, p.category as string) as unknown as Record<string, unknown> };

    case 'add_section': {
      const sec = await addSection(
        p.moduleId as string,
        p.order as number ?? 0,
        p.contentType as never,
        p.body as Record<string, unknown>
      );
      return { success: true, message: 'Section added', data: sec as unknown as Record<string, unknown> };
    }

    case 'update_section':
      await updateSection(p.moduleId as string, p.sectionId as string, {
        contentType: p.contentType as never,
        body:        p.body as Record<string, unknown>,
      });
      return { success: true, message: 'Section updated' };

    case 'delete_section':
      await deleteSection(p.moduleId as string, p.sectionId as string);
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
      await ensureCoachProfile(uid);
      return { success: true, message: 'Program built',
        data: await buildProgram(uid, p.title as string, p.moduleIds as string[]) as unknown as Record<string, unknown> };

    case 'assemble_package':
      await ensureCoachProfile(uid);
      try {
        return { success: true, message: 'Package assembled',
          data: await assemblePackage(uid, p.title as string, p.programIds as string[], {
            model:               p.pricingModel       as never,
            priceUsd:            p.priceUsd           as number             | undefined,
            currencies:          p.currencies         as string[]           | undefined,
            totalSeats:          p.totalSeats         as number             | undefined,
            showSeatsFilled:     p.showSeatsFilled    as boolean            | undefined,
            applyDeadline:       p.applyDeadline      as string             | undefined,
            discountPrice:       p.discountPrice      as number             | undefined,
            discountUntil:       p.discountUntil      as string             | undefined,
            certificateUrl:      p.certificateUrl     as string             | undefined,
            certificateTemplate: p.certificateTemplate as CertificateTemplate | undefined,
            includedProgramIds:  p.includedProgramIds as string[]           | undefined,
          }) as unknown as Record<string, unknown> };
      } catch (e: unknown) {
        return { success: false, message: (e as Error).message };
      }

    case 'update_package': {
      try {
        await updatePackage(p.packageId as string, uid, p.title as string, p.pricingModel as never, {
          priceUsd:            p.priceUsd           as number             | undefined,
          currencies:          p.currencies         as string[]           | undefined,
          totalSeats:          p.totalSeats         as number             | undefined,
          showSeatsFilled:     p.showSeatsFilled    as boolean            | undefined,
          applyDeadline:       p.applyDeadline      as string             | undefined,
          discountPrice:       p.discountPrice      as number             | undefined,
          discountUntil:       p.discountUntil      as string             | undefined,
          certificateUrl:      p.certificateUrl     as string             | undefined,
          certificateTemplate: p.certificateTemplate as CertificateTemplate | undefined,
          includedProgramIds:  p.includedProgramIds as string[]           | undefined,
        });
        const programIds = p.programIds as string[] | undefined;
        if (programIds && programIds.length > 0) {
          await relinkPackagePrograms(p.packageId as string, programIds);
        }
        return { success: true, message: 'Package updated' };
      } catch (e: unknown) {
        return { success: false, message: (e as Error).message };
      }
    }

    case 'publish_package':
      try {
        await publishPackage(p.packageId as string);
        return { success: true, message: 'Package published' };
      } catch (e: unknown) {
        return { success: false, message: (e as Error).message };
      }

    case 'unpublish_package':
      try {
        await unpublishPackage(p.packageId as string);
        return { success: true, message: 'Package unpublished' };
      } catch (e: unknown) {
        return { success: false, message: (e as Error).message };
      }

    case 'preview_module':
      return { success: true, message: 'Preview',
        data: { sections: await previewModule(p.moduleId as string) } };

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

    case 'list_packages':
      return { success: true, message: 'Packages loaded',
        data: { packages: await getAllPackagesForCoach(uid) } };

    case 'get_package_detail':
      return { success: true, message: 'Package detail loaded',
        data: await getPackageDetail(p.packageId as string) as unknown as Record<string, unknown> };

    case 'delete_module':
      await deleteModule(p.moduleId as string, uid);
      return { success: true, message: 'Module deleted' };

    case 'delete_program':
      await deleteProgram(p.programId as string, uid);
      return { success: true, message: 'Program deleted' };

    case 'delete_package':
      await deletePackage(p.packageId as string, uid);
      return { success: true, message: 'Package deleted' };

    case 'get_program_detail':
      return { success: true, message: 'Loaded',
        data: await getProgramWithPeriods(p.programId as string) as unknown as Record<string, unknown> };

    case 'remove_module_from_program':
      await removeModuleFromProgram(p.programId as string, p.moduleId as string);
      return { success: true, message: 'Module removed from program' };

    case 'remove_module_from_period':
      await removeModuleFromPeriod(p.programId as string, p.periodOrder as number, p.moduleId as string);
      return { success: true, message: 'Module removed from period' };

    // ── New: timeline programs ────────────────────────────────────────────────

    case 'build_program_with_periods':
      await ensureCoachProfile(uid);
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
          p.periodOrder as number | undefined,
          p.title as string,
          p.category as string,
          p.displayOrder as number
        ) as unknown as Record<string, unknown> };

    case 'add_module_to_period':
      await addModuleToPeriodByOrder(p.programId as string, p.periodOrder as number, p.moduleId as string, p.displayOrder as number);
      return { success: true, message: 'Module added' };

    case 'delete_program_period':
      await deleteProgramPeriod(p.programId as string, p.periodOrder as number);
      return { success: true, message: 'Period deleted' };

    case 'rename_program_period':
      await updateProgramPeriod(p.programId as string, p.periodOrder as number, { label: p.label as string });
      return { success: true, message: 'Period renamed' };

    // ── Program editing ───────────────────────────────────────────────────────

    case 'update_program':
      await updateProgram(p.programId as string, uid, { title: p.title as string | undefined, description: p.description as string | undefined, coverImageUrl: p.coverImageUrl as string | undefined });
      return { success: true, message: 'Program updated' };

    // ── YouTube channel connector ─────────────────────────────────────────────

    case 'save_youtube_channel':
      await ensureCoachProfile(uid);
      await saveCoachYouTubeChannel(uid, p.channelUrl as string);
      return { success: true, message: 'YouTube channel saved' };

    case 'get_youtube_channel': {
      const channelUrl = await getCoachYouTubeChannel(uid);
      return { success: true, message: 'Loaded', data: { channelUrl } };
    }

    case 'list_my_youtube_videos': {
      const channelUrl = await getCoachYouTubeChannel(uid);
      if (!channelUrl) return { success: false, message: 'No YouTube channel connected. Go to Settings to connect one.' };
      const videos = await fetchChannelVideos(channelUrl);
      return { success: true, message: 'Videos loaded', data: { videos } };
    }

    case 'load_all': {
      const [modules, programs, packages] = await Promise.all([
        listModulesForCoach(uid),
        listProgramsForCoach(uid),
        getAllPackagesForCoach(uid),
      ]);
      return { success: true, message: 'Loaded', data: { modules, programs, packages } };
    }

    case 'get_module_by_name': {
      const modules = (await listModulesForCoach(uid)) as unknown as Array<Record<string, unknown>>;
      const needle  = (p.name as string).toLowerCase();
      const match   = modules.find(m => String(m.title ?? '').toLowerCase().includes(needle));
      if (!match) return { success: false, message: `No module found matching "${p.name}"` };
      const sections = await getAllModuleSections(match.moduleId as string);
      return { success: true, message: 'Module found', data: { ...match, sections } };
    }

    case 'get_program_by_name': {
      const programs = (await listProgramsForCoach(uid)) as unknown as Array<Record<string, unknown>>;
      const needle   = (p.name as string).toLowerCase();
      const match    = programs.find(pr => String(pr.title ?? '').toLowerCase().includes(needle));
      if (!match) return { success: false, message: `No program found matching "${p.name}"` };
      const detail = await getProgramWithPeriods(match.programId as string);
      return { success: true, message: 'Program found', data: detail as unknown as Record<string, unknown> };
    }

    case 'get_package_by_name': {
      const packages = (await getAllPackagesForCoach(uid)) as unknown as Array<Record<string, unknown>>;
      const needle   = (p.name as string).toLowerCase();
      const match    = packages.find(pk => String(pk.title ?? '').toLowerCase().includes(needle));
      if (!match) return { success: false, message: `No package found matching "${p.name}"` };
      const detail = await getPackageDetail(match.packageId as string);
      return { success: true, message: 'Package found', data: detail as unknown as Record<string, unknown> };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// Multi-agent mode: export app for mounting by parent server
if (process.env.MULTI_AGENT_MODE === 'true') {
  export { app as programBuilderApp };
  console.log(`[${AGENT_ID}] Exported for multi-agent mode`);
} else {
  // Standalone mode: start server
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}
