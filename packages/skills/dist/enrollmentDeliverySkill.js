"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoachEnrollmentStats = void 0;
exports.enrollClient = enrollClient;
exports.getModuleView = getModuleView;
exports.completeSection = completeSection;
exports.getCoachDashboard = getCoachDashboard;
const resend_1 = require("resend");
const tools_1 = require("@coaching/tools");
Object.defineProperty(exports, "getCoachEnrollmentStats", { enumerable: true, get: function () { return tools_1.getCoachEnrollmentStats; } });
const sdk_1 = require("@coaching/sdk");
const licensingSkill_1 = require("./licensingSkill");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
async function enrollClient(packageId, coachId, clientData, type) {
    const client = await (0, tools_1.upsertClientProfile)(coachId, clientData.email, clientData);
    const enrollment = await (0, tools_1.createEnrollment)(packageId, coachId, client.clientId, type);
    await (0, tools_1.linkClientToEnrollment)(client.clientId, enrollment.enrollmentId);
    // Compute revenue if paid package
    const { data: pkg } = await sdk_1.supabase
        .from('coaching_packages')
        .select('price_usd, title')
        .eq('package_id', packageId)
        .single();
    if (pkg?.price_usd) {
        await (0, licensingSkill_1.computeAndWriteRevenue)(enrollment.enrollmentId, pkg.price_usd);
    }
    const portalUrl = `https://${process.env.PLATFORM_DOMAIN}/portal/${enrollment.inviteToken}`;
    await resend.emails.send({
        from: process.env.FROM_EMAIL ?? 'noreply@coachplatform.com',
        to: client.email,
        subject: `You've been invited to ${pkg?.title ?? 'a coaching program'}`,
        html: `<p>Hi ${client.name},</p><p>Click <a href="${portalUrl}">here</a> to access your program.</p>`,
    });
    return { enrollment, portalUrl };
}
async function getModuleView(enrollmentId, moduleId) {
    const { enrollment } = await (0, tools_1.getEnrollmentWithProgress)(enrollmentId);
    const viewFilter = enrollment.enrollmentType === 'trainee'
        ? ['client', 'trainee']
        : ['client'];
    const { data } = await sdk_1.supabase
        .from('module_sections')
        .select('*')
        .eq('module_id', moduleId)
        .order('section_order');
    return (data ?? [])
        .filter((s) => {
        const visibleTo = s.visible_to;
        return viewFilter.some(v => visibleTo.includes(v));
    })
        .map((s) => ({
        sectionId: s.section_id,
        sectionOrder: s.section_order,
        visibleTo: s.visible_to,
        contentType: s.content_type,
        body: s.body,
    }));
}
async function completeSection(enrollmentId, sectionId, response) {
    await (0, tools_1.submitResponse)(enrollmentId, sectionId, response ?? {});
    const { enrollment, completedSectionIds } = await (0, tools_1.getEnrollmentWithProgress)(enrollmentId);
    const currentModuleId = enrollment.currentModuleId;
    let moduleComplete = false;
    let programComplete = false;
    let packageComplete = false;
    if (currentModuleId) {
        const { data: allSections } = await sdk_1.supabase
            .from('module_sections')
            .select('section_id')
            .eq('module_id', currentModuleId);
        const allIds = (allSections ?? []).map((s) => s.section_id);
        moduleComplete = allIds.every(id => completedSectionIds.includes(id) || id === sectionId);
        if (moduleComplete) {
            // Find next module in program
            const { data: pm } = await sdk_1.supabase
                .from('enrollments')
                .select('package_id')
                .eq('enrollment_id', enrollmentId)
                .single();
            const { data: packagePrograms } = await sdk_1.supabase
                .from('package_programs')
                .select('program_id')
                .eq('package_id', pm?.package_id)
                .order('display_order');
            for (const pp of packagePrograms ?? []) {
                const { data: modules } = await sdk_1.supabase
                    .from('program_modules')
                    .select('module_id, display_order')
                    .eq('program_id', pp.program_id)
                    .order('display_order');
                const idx = (modules ?? []).findIndex((m) => m.module_id === currentModuleId);
                if (idx !== -1) {
                    if (idx + 1 < (modules ?? []).length) {
                        const next = (modules ?? [])[idx + 1];
                        await (0, tools_1.advanceCurrentModule)(enrollmentId, next.module_id);
                    }
                    else {
                        programComplete = true;
                    }
                    break;
                }
            }
        }
        if (programComplete) {
            const totalModulesCompleted = completedSectionIds.length + 1;
            const { data: allPkgModules } = await sdk_1.supabase
                .from('package_programs')
                .select('programs(program_modules(module_id))')
                .eq('package_id', enrollment.packageId);
            const totalModules = (allPkgModules ?? []).reduce((acc, pp) => {
                const prog = pp.programs;
                return acc + (prog.program_modules?.length ?? 0);
            }, 0);
            if (totalModulesCompleted >= totalModules) {
                await (0, tools_1.completeEnrollment)(enrollmentId);
                packageComplete = true;
            }
        }
    }
    return { moduleComplete, programComplete, packageComplete };
}
async function getCoachDashboard(coachId) {
    const { data } = await sdk_1.supabase
        .from('enrollments')
        .select('*, client_profiles(name), coaching_packages(title), current_module_id')
        .eq('installing_coach_id', coachId)
        .order('created_at', { ascending: false });
    return (data ?? []).map((row) => ({
        enrollmentId: row.enrollment_id,
        clientName: row.client_profiles?.name,
        packageTitle: row.coaching_packages?.title,
        currentModule: row.current_module_id,
        enrollmentType: row.enrollment_type,
        completedAt: row.completed_at,
    }));
}
//# sourceMappingURL=enrollmentDeliverySkill.js.map