import { ClientProfile, ModuleSectionSpec, EnrollmentType } from '@coaching/sdk';
import {
  upsertClientProfile,
  createEnrollment,
  getEnrollmentWithProgress,
  submitResponse,
  advanceCurrentModule,
  completeEnrollment,
  getCoachEnrollmentStats,
  getAllModuleSections,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';
import { computeAndWriteRevenue } from './licensingSkill';
import { sendFromCoach } from './gmailTransport';

export async function enrollClient(
  packageId: string,
  coachId: string,
  clientData: Partial<ClientProfile>,
  type: EnrollmentType,
  options?: { customPriceUsd?: number; discountAmountUsd?: number }
): Promise<{ client: ClientProfile; portalUrl: string }> {
  const profile = await upsertClientProfile(coachId, clientData.email!, clientData);
  const client  = await createEnrollment(packageId, coachId, profile.clientId, type);

  // Persist per-client pricing overrides if provided
  if (options?.customPriceUsd != null || options?.discountAmountUsd != null) {
    const patch: Record<string, unknown> = {};
    if (options.customPriceUsd    != null) patch.custom_price_usd    = options.customPriceUsd;
    if (options.discountAmountUsd != null) patch.discount_amount_usd = options.discountAmountUsd;
    await supabase.from('client_profiles').update(patch).eq('client_id', client.clientId);
  }

  // Seed current_module_id with the first module of the package
  const { data: pkgData } = await supabase
    .from('packages')
    .select('programs, price_usd, title')
    .eq('package_id', packageId)
    .single();

  const programRefs = ((pkgData?.programs as Array<{ program_id: string; display_order: number }>) ?? [])
    .sort((a, b) => a.display_order - b.display_order);

  if (programRefs.length > 0) {
    const { data: progData } = await supabase
      .from('programs')
      .select('periods')
      .eq('program_id', programRefs[0].program_id)
      .single();

    const rawPeriods = ((progData?.periods as unknown[]) ?? []) as Array<{
      period_order: number;
      modules?: Array<{ module_id: string; display_order: number }>;
    }>;
    rawPeriods.sort((a, b) => a.period_order - b.period_order);
    const allMods = rawPeriods.flatMap(p =>
      (p.modules ?? []).sort((a, b) => a.display_order - b.display_order)
    );
    const firstModuleId = allMods[0]?.module_id;

    if (firstModuleId) {
      await advanceCurrentModule(client.clientId, firstModuleId);
      client.currentModuleId = firstModuleId;
    }
  }

  // Compute revenue using per-client price if set, otherwise package default
  const basePrice    = options?.customPriceUsd   ?? (pkgData?.price_usd as number | undefined);
  const discountAmt  = options?.discountAmountUsd ?? 0;
  const effectivePrice = basePrice != null ? Math.max(0, basePrice - discountAmt) : undefined;
  if (effectivePrice != null && effectivePrice > 0) {
    await computeAndWriteRevenue(client.clientId, effectivePrice);
  }

  const domain   = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const protocol = domain.startsWith('localhost') ? 'http' : 'https';
  const portalUrl = `${protocol}://${domain}/portal/${client.inviteToken}`;

  try {
    await sendFromCoach(coachId, {
      to:      client.email,
      subject: `You've been invited to ${pkgData?.title ?? 'a coaching program'}`,
      html:    `<p>Hi ${client.name},</p><p>Click <a href="${portalUrl}">here</a> to access your coaching program.</p>`,
    });
  } catch (emailErr) {
    process.stdout.write(`[enrollClient] email failed: ${String(emailErr)}\n`);
  }

  return { client, portalUrl };
}

export async function getModuleView(clientId: string, moduleId: string): Promise<ModuleSectionSpec[]> {
  await getEnrollmentWithProgress(clientId);
  return getAllModuleSections(moduleId);
}

export async function completeSection(
  clientId: string,
  sectionId: string,
  response?: Record<string, unknown>
): Promise<{ moduleComplete: boolean; programComplete: boolean; packageComplete: boolean }> {
  await submitResponse(clientId, sectionId, response ?? {});

  const { enrollment, completedSectionIds } = await getEnrollmentWithProgress(clientId);
  const currentModuleId = enrollment.currentModuleId;

  let moduleComplete  = false;
  let programComplete = false;
  let packageComplete = false;

  if (currentModuleId) {
    const allSections = await getAllModuleSections(currentModuleId);
    const allIds = allSections.map(s => s.sectionId);
    moduleComplete = allIds.every(id => completedSectionIds.includes(id) || id === sectionId);

    if (moduleComplete) {
      const { data: pkgRow } = await supabase
        .from('packages')
        .select('programs')
        .eq('package_id', enrollment.packageId)
        .single();

      const packagePrograms = ((pkgRow?.programs as Array<{ program_id: string; display_order: number }>) ?? [])
        .sort((a, b) => a.display_order - b.display_order);

      for (const pp of packagePrograms) {
        const { data: progData } = await supabase
          .from('programs')
          .select('periods')
          .eq('program_id', pp.program_id)
          .single();

        const rawPeriods = ((progData?.periods as unknown[]) ?? []) as Array<{
          period_order: number;
          modules?: Array<{ module_id: string; display_order: number }>;
        }>;
        rawPeriods.sort((a, b) => a.period_order - b.period_order);
        const modules = rawPeriods.flatMap(p =>
          (p.modules ?? []).sort((a, b) => a.display_order - b.display_order)
        );

        const idx = modules.findIndex(m => m.module_id === currentModuleId);
        if (idx !== -1) {
          if (idx + 1 < modules.length) {
            await advanceCurrentModule(clientId, modules[idx + 1].module_id);
          } else {
            programComplete = true;
          }
          break;
        }
      }
    }

    if (programComplete) {
      const totalModulesCompleted = completedSectionIds.length + 1;
      const { data: pkgRow2 } = await supabase
        .from('packages')
        .select('programs')
        .eq('package_id', enrollment.packageId)
        .single();

      const progIds = ((pkgRow2?.programs as Array<{ program_id: string }>) ?? []).map(p => p.program_id);
      const { data: allProgsData } = progIds.length > 0
        ? await supabase.from('programs').select('periods').in('program_id', progIds)
        : { data: [] as unknown[] };

      const totalModules = (allProgsData ?? []).reduce((acc: number, prog: unknown) => {
        const p = prog as { periods?: Array<{ modules?: unknown[] }> };
        const count = (p.periods ?? []).reduce((s, period) => s + (period.modules?.length ?? 0), 0);
        return acc + count;
      }, 0);

      if (totalModulesCompleted >= totalModules) {
        await completeEnrollment(clientId);
        packageComplete = true;
      }
    }
  }

  return { moduleComplete, programComplete, packageComplete };
}

export async function getCoachDashboard(coachId: string) {
  const { data } = await supabase
    .from('client_profiles')
    .select('client_id, name, packages(title), current_module_id, enrollment_type, completed_at')
    .eq('coach_id', coachId)
    .not('enrollment_type', 'is', null)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row: Record<string, unknown>) => ({
    clientId:       row.client_id,
    clientName:     row.name,
    packageTitle:   (row.packages as Record<string, unknown>)?.title,
    currentModule:  row.current_module_id,
    enrollmentType: row.enrollment_type,
    completedAt:    row.completed_at,
  }));
}

export { getCoachEnrollmentStats };
