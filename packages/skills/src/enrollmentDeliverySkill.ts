import { Resend } from 'resend';
import { EnrollmentRecord, ClientProfile, ModuleSectionSpec, EnrollmentType } from '@coaching/sdk';
import {
  upsertClientProfile,
  createEnrollment,
  linkClientToEnrollment,
  getEnrollmentWithProgress,
  submitResponse,
  advanceCurrentModule,
  completeEnrollment,
  getCoachEnrollmentStats,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';
import { computeAndWriteRevenue } from './licensingSkill';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder');
  return _resend;
}

export async function enrollClient(
  packageId: string,
  coachId: string,
  clientData: Partial<ClientProfile>,
  type: EnrollmentType
): Promise<{ enrollment: EnrollmentRecord; portalUrl: string }> {
  const client = await upsertClientProfile(coachId, clientData.email!, clientData);
  const enrollment = await createEnrollment(packageId, coachId, client.clientId, type);
  await linkClientToEnrollment(client.clientId, enrollment.enrollmentId);

  // Compute revenue if paid package
  const { data: pkg } = await supabase
    .from('coaching_packages')
    .select('price_usd, title')
    .eq('package_id', packageId)
    .single();

  if (pkg?.price_usd) {
    await computeAndWriteRevenue(enrollment.enrollmentId, pkg.price_usd as number);
  }

  const portalUrl = `https://${process.env.PLATFORM_DOMAIN}/portal/${enrollment.inviteToken}`;

  await getResend().emails.send({
    from:    process.env.FROM_EMAIL ?? 'noreply@coachplatform.com',
    to:      client.email,
    subject: `You've been invited to ${pkg?.title ?? 'a coaching program'}`,
    html:    `<p>Hi ${client.name},</p><p>Click <a href="${portalUrl}">here</a> to access your program.</p>`,
  });

  return { enrollment, portalUrl };
}

export async function getModuleView(enrollmentId: string, moduleId: string): Promise<ModuleSectionSpec[]> {
  const { enrollment } = await getEnrollmentWithProgress(enrollmentId);

  const viewFilter = enrollment.enrollmentType === 'trainee'
    ? ['client', 'trainee']
    : ['client'];

  const { data } = await supabase
    .from('module_sections')
    .select('*')
    .eq('module_id', moduleId)
    .order('section_order');

  return (data ?? [])
    .filter((s: Record<string, unknown>) => {
      const visibleTo = s.visible_to as string[];
      return viewFilter.some(v => visibleTo.includes(v));
    })
    .map((s: Record<string, unknown>) => ({
      sectionId:    s.section_id as string,
      sectionOrder: s.section_order as number,
      visibleTo:    s.visible_to as ModuleSectionSpec['visibleTo'],
      contentType:  s.content_type as ModuleSectionSpec['contentType'],
      body:         s.body as Record<string, unknown>,
    }));
}

export async function completeSection(
  enrollmentId: string,
  sectionId: string,
  response?: Record<string, unknown>
): Promise<{ moduleComplete: boolean; programComplete: boolean; packageComplete: boolean }> {
  await submitResponse(enrollmentId, sectionId, response ?? {});

  const { enrollment, completedSectionIds } = await getEnrollmentWithProgress(enrollmentId);
  const currentModuleId = enrollment.currentModuleId;

  let moduleComplete = false;
  let programComplete = false;
  let packageComplete = false;

  if (currentModuleId) {
    const { data: allSections } = await supabase
      .from('module_sections')
      .select('section_id')
      .eq('module_id', currentModuleId);

    const allIds = (allSections ?? []).map((s: Record<string, unknown>) => s.section_id as string);
    moduleComplete = allIds.every(id => completedSectionIds.includes(id) || id === sectionId);

    if (moduleComplete) {
      // Find next module in program
      const { data: pm } = await supabase
        .from('enrollments')
        .select('package_id')
        .eq('enrollment_id', enrollmentId)
        .single();

      const { data: packagePrograms } = await supabase
        .from('package_programs')
        .select('program_id')
        .eq('package_id', pm?.package_id)
        .order('display_order');

      for (const pp of packagePrograms ?? []) {
        const { data: modules } = await supabase
          .from('program_modules')
          .select('module_id, display_order')
          .eq('program_id', pp.program_id)
          .order('display_order');

        const idx = (modules ?? []).findIndex((m: Record<string, unknown>) => m.module_id === currentModuleId);
        if (idx !== -1) {
          if (idx + 1 < (modules ?? []).length) {
            const next = (modules ?? [])[idx + 1] as Record<string, unknown>;
            await advanceCurrentModule(enrollmentId, next.module_id as string);
          } else {
            programComplete = true;
          }
          break;
        }
      }
    }

    if (programComplete) {
      const totalModulesCompleted = completedSectionIds.length + 1;
      const { data: allPkgModules } = await supabase
        .from('package_programs')
        .select('programs(program_modules(module_id))')
        .eq('package_id', enrollment.packageId);

      const totalModules = (allPkgModules ?? []).reduce((acc: number, pp: Record<string, unknown>) => {
        const prog = pp.programs as { program_modules: unknown[] };
        return acc + (prog.program_modules?.length ?? 0);
      }, 0);

      if (totalModulesCompleted >= totalModules) {
        await completeEnrollment(enrollmentId);
        packageComplete = true;
      }
    }
  }

  return { moduleComplete, programComplete, packageComplete };
}

export async function getCoachDashboard(coachId: string) {
  const { data } = await supabase
    .from('enrollments')
    .select('*, client_profiles(name), coaching_packages(title), current_module_id')
    .eq('installing_coach_id', coachId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row: Record<string, unknown>) => ({
    enrollmentId:   row.enrollment_id,
    clientName:     (row.client_profiles as Record<string, unknown>)?.name,
    packageTitle:   (row.coaching_packages as Record<string, unknown>)?.title,
    currentModule:  row.current_module_id,
    enrollmentType: row.enrollment_type,
    completedAt:    row.completed_at,
  }));
}

export { getCoachEnrollmentStats };
