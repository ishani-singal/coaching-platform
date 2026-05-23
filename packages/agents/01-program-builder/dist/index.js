"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@coaching/sdk");
// v5 - getPackageDetail reads programs.periods JSONB (program_modules dropped in migration 025)
const tools_1 = require("@coaching/tools");
const skills_1 = require("@coaching/skills");
const skills_2 = require("@coaching/skills");
const skills_3 = require("@coaching/skills");
const skills_4 = require("@coaching/skills");
const sdk_2 = require("@coaching/sdk");
const PORT = parseInt(process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001', 10);
const AGENT_ID = 'coaching-program-builder';
(0, tools_1.configureBridge)({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });
const manifest = {
    agentId: AGENT_ID,
    name: 'Program Builder',
    version: '2.0.0',
    description: 'Build coaching modules, programs and packages with timeline support and inline module creation.',
    icon: '📚',
    domain: ['programs', 'coaching', 'content'],
    defaultScope: 'global',
    integrationTier: 1,
    uiSpec: { baseArchitecture: 'flow-wizard' },
    panelSpec: {
        layout: 'two-column',
        sections: [],
    },
    actions: [
        // Existing actions
        { name: 'create_module', description: 'Create a new standalone module',
            params: { title: { type: 'string', required: true, description: 'Module title' }, category: { type: 'string', required: true, description: 'Category' }, derivedFromModuleId: { type: 'string', required: false, description: 'Parent module ID' } } },
        { name: 'add_section', description: 'Add a new content section to a module',
            params: { moduleId: { type: 'string', required: true, description: 'Module to add section to' }, order: { type: 'number', required: true, description: '0-based section order' }, contentType: { type: 'string', required: true, description: 'text|video|long_form_qa|single_choice|multi_choice|match_following|rating|assignment' }, body: { type: 'object', required: true, description: 'Section body' } } },
        { name: 'update_section', description: 'Edit an existing section on a module',
            params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, sectionId: { type: 'string', required: true, description: 'Section ID' }, contentType: { type: 'string', required: true, description: '' }, body: { type: 'object', required: true, description: '' } } },
        { name: 'delete_section', description: 'Delete a section from a module',
            params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, sectionId: { type: 'string', required: true, description: 'Section ID' } } },
        { name: 'get_module_detail', description: 'Load all sections for a module (coach view, no visibility filter)',
            params: { moduleId: { type: 'string', required: true, description: 'Module ID' } } },
        { name: 'update_module', description: 'Edit a module title or category',
            params: { moduleId: { type: 'string', required: true, description: 'Module ID' }, title: { type: 'string', required: false, description: 'New title' }, category: { type: 'string', required: false, description: 'New category' } } },
        { name: 'fork_module', description: 'Fork a licensed module',
            params: { moduleId: { type: 'string', required: true, description: '' } } },
        { name: 'build_program', description: 'Build a flat program from existing modules',
            params: { title: { type: 'string', required: true, description: '' }, moduleIds: { type: 'array', required: true, description: '' } } },
        { name: 'assemble_package', description: 'Assemble a coaching package',
            params: { title: { type: 'string', required: true, description: '' }, programIds: { type: 'array', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' }, currencies: { type: 'array', required: false, description: '' }, totalSeats: { type: 'number', required: false, description: '' }, showSeatsFilled: { type: 'boolean', required: false, description: '' }, applyDeadline: { type: 'string', required: false, description: '' }, discountPrice: { type: 'number', required: false, description: '' }, discountUntil: { type: 'string', required: false, description: '' }, certificateUrl: { type: 'string', required: false, description: 'URL to a downloadable completion certificate' }, certificateTemplate: { type: 'object', required: false, description: 'Structured certificate template config (designVariant, title, coachName, accentColor, etc.)' }, includedProgramIds: { type: 'array', required: false, description: 'Program IDs to fork into trainee account on graduation (no-sublicense)' } } },
        { name: 'update_package', description: 'Update an existing package title, pricing, seats, deadlines and discount',
            params: { packageId: { type: 'string', required: true, description: '' }, title: { type: 'string', required: true, description: '' }, pricingModel: { type: 'string', required: true, description: '' }, priceUsd: { type: 'number', required: false, description: '' }, currencies: { type: 'array', required: false, description: '' }, totalSeats: { type: 'number', required: false, description: '' }, showSeatsFilled: { type: 'boolean', required: false, description: '' }, applyDeadline: { type: 'string', required: false, description: '' }, discountPrice: { type: 'number', required: false, description: '' }, discountUntil: { type: 'string', required: false, description: '' }, certificateUrl: { type: 'string', required: false, description: 'URL to a downloadable completion certificate' }, certificateTemplate: { type: 'object', required: false, description: 'Structured certificate template config (designVariant, title, coachName, accentColor, etc.)' }, includedProgramIds: { type: 'array', required: false, description: 'Program IDs to fork into trainee account on graduation (no-sublicense)' } } },
        { name: 'publish_package', description: 'Publish a package (validates all programs and modules are published)',
            params: { packageId: { type: 'string', required: true, description: '' } } },
        { name: 'unpublish_package', description: 'Unpublish a package (hides it from the public coach page)',
            params: { packageId: { type: 'string', required: true, description: '' } } },
        { name: 'preview_module', description: 'Preview module sections',
            params: { moduleId: { type: 'string', required: true, description: '' } } },
        { name: 'license_module', description: 'License a module to another coach',
            params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
        { name: 'update_license_depth', description: 'Update propagation depth on a license',
            params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
        // New: list helpers for UI dropdowns
        { name: 'list_modules', description: 'List all modules owned by this coach', params: {} },
        { name: 'list_programs', description: 'List all programs owned by this coach', params: {} },
        { name: 'list_packages', description: 'List all packages owned by this coach', params: {} },
        { name: 'get_package_detail', description: 'Get a package with its programs and modules',
            params: { packageId: { type: 'string', required: true, description: 'Package ID' } } },
        { name: 'delete_module', description: 'Delete a module owned by this coach',
            params: { moduleId: { type: 'string', required: true, description: 'Module ID' } } },
        { name: 'delete_program', description: 'Delete a program owned by this coach',
            params: { programId: { type: 'string', required: true, description: 'Program ID' } } },
        { name: 'delete_package', description: 'Delete a package owned by this coach',
            params: { packageId: { type: 'string', required: true, description: 'Package ID' } } },
        { name: 'get_program_detail', description: 'Load a program with all its modules and periods',
            params: { programId: { type: 'string', required: true, description: 'Program ID' } } },
        { name: 'remove_module_from_program', description: 'Remove a module from a program (module is not deleted, only its assignment to this program)',
            params: {
                programId: { type: 'string', required: true, description: 'Program ID' },
                moduleId: { type: 'string', required: true, description: 'Module ID' },
            } },
        { name: 'remove_module_from_period', description: 'Remove a module from a specific period only (module is not deleted)',
            params: {
                programId: { type: 'string', required: true, description: 'Program ID' },
                periodOrder: { type: 'number', required: true, description: 'Period order index' },
                moduleId: { type: 'string', required: true, description: 'Module ID' },
            } },
        // New: timeline programs
        { name: 'build_program_with_periods', description: 'Build a timeline program (weeks/months/etc.) with modules per period',
            params: {
                title: { type: 'string', required: true, description: 'Program title' },
                description: { type: 'string', required: false, description: 'Program description' },
                periods: { type: 'array', required: true, description: 'Array of {label, periodType, moduleIds[]}' },
            } },
        { name: 'create_program_period', description: 'Add a period to an existing program',
            params: {
                programId: { type: 'string', required: true, description: 'Program ID' },
                periodOrder: { type: 'number', required: true, description: '0-based display order' },
                label: { type: 'string', required: true, description: 'e.g. "Week 1"' },
                periodType: { type: 'string', required: true, description: 'week|day|month|quarter|custom', enum: ['week', 'day', 'month', 'quarter', 'custom'] },
            } },
        { name: 'create_inline_module', description: 'Create a module inline within a program period (module is saved to the module library and reusable)',
            params: {
                programId: { type: 'string', required: true, description: 'Program the module belongs to' },
                periodOrder: { type: 'number', required: false, description: 'Period order index to assign to (defaults to 0)' },
                title: { type: 'string', required: true, description: 'Module title' },
                category: { type: 'string', required: true, description: 'Module category' },
                displayOrder: { type: 'number', required: true, description: 'Order within period or program' },
            } },
        // Period & module management on existing programs
        { name: 'add_module_to_period', description: 'Assign an existing module to a period',
            params: {
                programId: { type: 'string', required: true, description: 'Program ID' },
                moduleId: { type: 'string', required: true, description: 'Module ID to add' },
                periodOrder: { type: 'number', required: true, description: 'Period order index' },
                displayOrder: { type: 'number', required: true, description: 'Position in period' },
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
async function onContext(req) {
    const userId = req.userId;
    const [{ data: packages }, { data: modules }, { data: licenses }, { data: programs }] = await Promise.all([
        sdk_2.supabase.from('packages').select('package_id, title, is_published').eq('coach_id', userId),
        sdk_2.supabase.from('modules').select('module_id, title, category').eq('creator_coach_id', userId),
        sdk_2.supabase.from('module_licenses').select('license_id').eq('licensor_coach_id', userId),
        sdk_2.supabase.from('programs').select('program_id, title').eq('creator_coach_id', userId),
    ]);
    const published = (packages ?? []).filter((p) => p.is_published).length;
    return {
        snapshot: {
            agentId: AGENT_ID,
            agentName: manifest.name,
            domain: manifest.domain,
            summary: `${published} published package(s) · ${(modules ?? []).length} modules · ${(licenses ?? []).length} active license(s)`,
            keyEntities: (packages ?? []).slice(0, 5).map((p) => ({ id: p.package_id, type: 'package', label: p.title, attributes: {} })),
            recentEvents: [],
            pendingActions: [],
            rawContext: {
                modules: (modules ?? []).map((m) => ({ module_id: m.module_id, title: m.title, category: m.category ?? '' })),
                programs: (programs ?? []).map((p) => ({ program_id: p.program_id, title: p.title })),
                packages: (packages ?? []).map((p) => ({ package_id: p.package_id, title: p.title, is_published: p.is_published ? 'published' : 'draft' })),
            },
        },
    };
}
async function onAction(req) {
    const uid = req.userId;
    const p = req.params;
    switch (req.action) {
        // ── Existing actions ──────────────────────────────────────────────────────
        case 'create_module':
            await (0, tools_1.ensureCoachProfile)(uid);
            return { success: true, message: 'Module created',
                data: await (0, skills_1.scaffoldModule)(uid, p.title, p.category) };
        case 'add_section': {
            const sec = await (0, tools_1.addSection)(p.moduleId, p.order ?? 0, p.contentType, p.body);
            return { success: true, message: 'Section added', data: sec };
        }
        case 'update_section':
            await (0, tools_1.updateSection)(p.moduleId, p.sectionId, {
                contentType: p.contentType,
                body: p.body,
            });
            return { success: true, message: 'Section updated' };
        case 'delete_section':
            await (0, tools_1.deleteSection)(p.moduleId, p.sectionId);
            return { success: true, message: 'Section deleted' };
        case 'get_module_detail':
            return { success: true, message: 'Loaded',
                data: { sections: await (0, tools_1.getAllModuleSections)(p.moduleId) } };
        case 'update_module':
            await (0, tools_1.updateModule)(p.moduleId, { title: p.title, category: p.category });
            return { success: true, message: 'Module updated' };
        case 'fork_module':
            return { success: true, message: 'Module forked',
                data: await (0, skills_1.forkModule)(p.moduleId, uid) };
        case 'build_program':
            await (0, tools_1.ensureCoachProfile)(uid);
            return { success: true, message: 'Program built',
                data: await (0, skills_2.buildProgram)(uid, p.title, p.moduleIds) };
        case 'assemble_package':
            await (0, tools_1.ensureCoachProfile)(uid);
            try {
                return { success: true, message: 'Package assembled',
                    data: await (0, skills_3.assemblePackage)(uid, p.title, p.programIds, {
                        model: p.pricingModel,
                        priceUsd: p.priceUsd,
                        currencies: p.currencies,
                        totalSeats: p.totalSeats,
                        showSeatsFilled: p.showSeatsFilled,
                        applyDeadline: p.applyDeadline,
                        discountPrice: p.discountPrice,
                        discountUntil: p.discountUntil,
                        certificateUrl: p.certificateUrl,
                        certificateTemplate: p.certificateTemplate,
                        includedProgramIds: p.includedProgramIds,
                    }) };
            }
            catch (e) {
                return { success: false, message: e.message };
            }
        case 'update_package': {
            try {
                await (0, tools_1.updatePackage)(p.packageId, uid, p.title, p.pricingModel, {
                    priceUsd: p.priceUsd,
                    currencies: p.currencies,
                    totalSeats: p.totalSeats,
                    showSeatsFilled: p.showSeatsFilled,
                    applyDeadline: p.applyDeadline,
                    discountPrice: p.discountPrice,
                    discountUntil: p.discountUntil,
                    certificateUrl: p.certificateUrl,
                    certificateTemplate: p.certificateTemplate,
                    includedProgramIds: p.includedProgramIds,
                });
                const programIds = p.programIds;
                if (programIds && programIds.length > 0) {
                    await (0, tools_1.relinkPackagePrograms)(p.packageId, programIds);
                }
                return { success: true, message: 'Package updated' };
            }
            catch (e) {
                return { success: false, message: e.message };
            }
        }
        case 'publish_package':
            try {
                await (0, skills_3.publishPackage)(p.packageId);
                return { success: true, message: 'Package published' };
            }
            catch (e) {
                return { success: false, message: e.message };
            }
        case 'unpublish_package':
            try {
                await (0, skills_3.unpublishPackage)(p.packageId);
                return { success: true, message: 'Package unpublished' };
            }
            catch (e) {
                return { success: false, message: e.message };
            }
        case 'preview_module':
            return { success: true, message: 'Preview',
                data: { sections: await (0, skills_1.previewModule)(p.moduleId) } };
        case 'license_module':
            await (0, skills_4.licenseModuleToCoach)(uid, p.licenseeCoachId, p.moduleId, {
                directCutPct: p.directCutPct,
                derivativeCutPct: p.derivativeCutPct,
                propagateToDepth: p.propagateToDepth ?? null,
                canSublicense: p.canSublicense ?? false,
            });
            return { success: true, message: 'License created' };
        case 'update_license_depth':
            await sdk_2.supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
            return { success: true, message: 'License updated' };
        // ── New: list helpers ─────────────────────────────────────────────────────
        case 'list_modules':
            return { success: true, message: 'Modules loaded',
                data: { modules: await (0, tools_1.listModulesForCoach)(uid) } };
        case 'list_programs':
            return { success: true, message: 'Programs loaded',
                data: { programs: await (0, tools_1.listProgramsForCoach)(uid) } };
        case 'list_packages':
            return { success: true, message: 'Packages loaded',
                data: { packages: await (0, tools_1.getAllPackagesForCoach)(uid) } };
        case 'get_package_detail':
            return { success: true, message: 'Package detail loaded',
                data: await (0, tools_1.getPackageDetail)(p.packageId) };
        case 'delete_module':
            await (0, tools_1.deleteModule)(p.moduleId, uid);
            return { success: true, message: 'Module deleted' };
        case 'delete_program':
            await (0, tools_1.deleteProgram)(p.programId, uid);
            return { success: true, message: 'Program deleted' };
        case 'delete_package':
            await (0, tools_1.deletePackage)(p.packageId, uid);
            return { success: true, message: 'Package deleted' };
        case 'get_program_detail':
            return { success: true, message: 'Loaded',
                data: await (0, tools_1.getProgramWithPeriods)(p.programId) };
        case 'remove_module_from_program':
            await (0, tools_1.removeModuleFromProgram)(p.programId, p.moduleId);
            return { success: true, message: 'Module removed from program' };
        case 'remove_module_from_period':
            await (0, tools_1.removeModuleFromPeriod)(p.programId, p.periodOrder, p.moduleId);
            return { success: true, message: 'Module removed from period' };
        // ── New: timeline programs ────────────────────────────────────────────────
        case 'build_program_with_periods':
            await (0, tools_1.ensureCoachProfile)(uid);
            return { success: true, message: 'Program built',
                data: await (0, skills_2.buildProgramWithPeriods)(uid, p.title, p.description, p.periods) };
        case 'create_program_period':
            return { success: true, message: 'Period created',
                data: await (0, tools_1.createProgramPeriod)(p.programId, p.periodOrder, p.label, p.periodType) };
        case 'create_inline_module':
            return { success: true, message: 'Module created',
                data: await (0, skills_2.createInlineModule)(uid, p.programId, p.periodOrder, p.title, p.category, p.displayOrder) };
        case 'add_module_to_period':
            await (0, tools_1.addModuleToPeriodByOrder)(p.programId, p.periodOrder, p.moduleId, p.displayOrder);
            return { success: true, message: 'Module added' };
        case 'delete_program_period':
            await (0, tools_1.deleteProgramPeriod)(p.programId, p.periodOrder);
            return { success: true, message: 'Period deleted' };
        case 'rename_program_period':
            await (0, tools_1.updateProgramPeriod)(p.programId, p.periodOrder, { label: p.label });
            return { success: true, message: 'Period renamed' };
        // ── Program editing ───────────────────────────────────────────────────────
        case 'update_program':
            await (0, tools_1.updateProgram)(p.programId, uid, { title: p.title, description: p.description, coverImageUrl: p.coverImageUrl });
            return { success: true, message: 'Program updated' };
        // ── YouTube channel connector ─────────────────────────────────────────────
        case 'save_youtube_channel':
            await (0, tools_1.ensureCoachProfile)(uid);
            await (0, tools_1.saveCoachYouTubeChannel)(uid, p.channelUrl);
            return { success: true, message: 'YouTube channel saved' };
        case 'get_youtube_channel': {
            const channelUrl = await (0, tools_1.getCoachYouTubeChannel)(uid);
            return { success: true, message: 'Loaded', data: { channelUrl } };
        }
        case 'list_my_youtube_videos': {
            const channelUrl = await (0, tools_1.getCoachYouTubeChannel)(uid);
            if (!channelUrl)
                return { success: false, message: 'No YouTube channel connected. Go to Settings to connect one.' };
            const videos = await (0, tools_1.fetchChannelVideos)(channelUrl);
            return { success: true, message: 'Videos loaded', data: { videos } };
        }
        case 'load_all': {
            const [modules, programs, packages] = await Promise.all([
                (0, tools_1.listModulesForCoach)(uid),
                (0, tools_1.listProgramsForCoach)(uid),
                (0, tools_1.getAllPackagesForCoach)(uid),
            ]);
            return { success: true, message: 'Loaded', data: { modules, programs, packages } };
        }
        case 'get_module_by_name': {
            const modules = (await (0, tools_1.listModulesForCoach)(uid));
            const needle = p.name.toLowerCase();
            const match = modules.find(m => String(m.title ?? '').toLowerCase().includes(needle));
            if (!match)
                return { success: false, message: `No module found matching "${p.name}"` };
            const sections = await (0, tools_1.getAllModuleSections)(match.moduleId);
            return { success: true, message: 'Module found', data: { ...match, sections } };
        }
        case 'get_program_by_name': {
            const programs = (await (0, tools_1.listProgramsForCoach)(uid));
            const needle = p.name.toLowerCase();
            const match = programs.find(pr => String(pr.title ?? '').toLowerCase().includes(needle));
            if (!match)
                return { success: false, message: `No program found matching "${p.name}"` };
            const detail = await (0, tools_1.getProgramWithPeriods)(match.programId);
            return { success: true, message: 'Program found', data: detail };
        }
        case 'get_package_by_name': {
            const packages = (await (0, tools_1.getAllPackagesForCoach)(uid));
            const needle = p.name.toLowerCase();
            const match = packages.find(pk => String(pk.title ?? '').toLowerCase().includes(needle));
            if (!match)
                return { success: false, message: `No package found matching "${p.name}"` };
            const detail = await (0, tools_1.getPackageDetail)(match.packageId);
            return { success: true, message: 'Package found', data: detail };
        }
        default:
            return { success: false, message: `Unknown action: ${req.action}` };
    }
}
const app = (0, sdk_1.createAgentServer)(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
//# sourceMappingURL=index.js.map