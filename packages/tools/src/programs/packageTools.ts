import { supabase } from '@coaching/sdk';
import { CoachingPackage, CertificateTemplate, PricingModel } from '@coaching/sdk';

export async function createPackage(
  coachId: string,
  title: string,
  pricingModel: PricingModel,
  opts?: {
    priceUsd?: number;
    currencies?: string[];
    totalSeats?: number;
    showSeatsFilled?: boolean;
    applyDeadline?: string;
    discountPrice?: number;
    discountUntil?: string;
    certificateUrl?: string;
    certificateTemplate?: CertificateTemplate;
    includedProgramIds?: string[];
  }
): Promise<CoachingPackage> {
  const { data, error } = await supabase
    .from('packages')
    .insert({
      coach_id:             coachId,
      title,
      pricing_model:        pricingModel,
      price_usd:            opts?.priceUsd            ?? null,
      currencies:           opts?.currencies           ?? ['INR'],
      total_seats:          opts?.totalSeats           ?? null,
      show_seats_filled:    opts?.showSeatsFilled      ?? false,
      apply_deadline:       opts?.applyDeadline        ?? null,
      discount_price:       opts?.discountPrice        ?? null,
      discount_until:       opts?.discountUntil        ?? null,
      certificate_url:      opts?.certificateUrl       ?? null,
      certificate_template: opts?.certificateTemplate  ?? null,
      included_program_ids: opts?.includedProgramIds   ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data);
}

export async function updatePackage(
  packageId: string,
  coachId: string,
  title: string,
  pricingModel: PricingModel,
  opts?: {
    priceUsd?: number;
    currencies?: string[];
    totalSeats?: number;
    showSeatsFilled?: boolean;
    applyDeadline?: string;
    discountPrice?: number;
    discountUntil?: string;
    certificateUrl?: string;
    certificateTemplate?: CertificateTemplate;
    includedProgramIds?: string[];
  }
): Promise<CoachingPackage> {
  const { data, error } = await supabase
    .from('packages')
    .update({
      title,
      pricing_model:        pricingModel,
      price_usd:            opts?.priceUsd            ?? null,
      currencies:           opts?.currencies           ?? ['INR'],
      total_seats:          opts?.totalSeats           ?? null,
      show_seats_filled:    opts?.showSeatsFilled      ?? false,
      apply_deadline:       opts?.applyDeadline        ?? null,
      discount_price:       opts?.discountPrice        ?? null,
      discount_until:       opts?.discountUntil        ?? null,
      certificate_url:      opts?.certificateUrl       ?? null,
      certificate_template: opts?.certificateTemplate  ?? null,
      included_program_ids: opts?.includedProgramIds   ?? [],
    })
    .eq('package_id', packageId)
    .eq('coach_id', coachId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data);
}

export async function addProgramToPackage(packageId: string, programId: string, order: number): Promise<void> {
  const { data: pkg, error: fetchErr } = await supabase
    .from('packages')
    .select('programs')
    .eq('package_id', packageId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  const current = (pkg.programs as Array<{ program_id: string; display_order: number }>) ?? [];
  const { error } = await supabase
    .from('packages')
    .update({ programs: [...current, { program_id: programId, display_order: order }] })
    .eq('package_id', packageId);
  if (error) throw new Error(error.message);
}

export async function relinkPackagePrograms(packageId: string, programIds: string[]): Promise<void> {
  const programs = programIds.map((id, i) => ({ program_id: id, display_order: i }));
  const { error } = await supabase
    .from('packages')
    .update({ programs })
    .eq('package_id', packageId);
  if (error) throw new Error(error.message);
}

export async function publishPackage(packageId: string): Promise<void> {
  const { data: pkg } = await supabase
    .from('packages')
    .select('programs')
    .eq('package_id', packageId)
    .single();

  if (!pkg || ((pkg.programs as unknown[]) ?? []).length === 0) throw new Error('No programs linked');

  await supabase.from('packages').update({ is_published: true }).eq('package_id', packageId);
}

export async function unpublishPackage(packageId: string): Promise<void> {
  await supabase.from('packages').update({ is_published: false }).eq('package_id', packageId);
}

export async function getPackageWithPrograms(packageId: string): Promise<CoachingPackage> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('package_id', packageId)
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data);
}

export async function getPackageDetail(packageId: string): Promise<{
  packageId: string;
  title: string;
  programs: { programId: string; title: string; periodType?: string; periodCount: number; modules: { moduleId: string; title: string; category: string }[] }[];
}> {
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('package_id, title, programs')
    .eq('package_id', packageId)
    .single();
  if (error) throw new Error(error.message);

  const programRefs = ((pkg.programs as Array<{ program_id: string; display_order: number }>) ?? [])
    .sort((a, b) => a.display_order - b.display_order);

  if (programRefs.length === 0) {
    return { packageId: pkg.package_id as string, title: pkg.title as string, programs: [] };
  }

  // programs.periods is a JSONB column — program_modules was dropped in migration 025
  const { data: progRows, error: progErr } = await supabase
    .from('programs')
    .select('program_id, title, periods')
    .in('program_id', programRefs.map(p => p.program_id));
  if (progErr) throw new Error(progErr.message);

  // Collect all module IDs across every period of every program
  const rows = ((progRows ?? []) as Record<string, unknown>[]);
  const allModuleIds = [...new Set(
    rows.flatMap(prog => {
      const periods = (prog.periods as Array<{ modules?: Array<{ module_id: string; display_order: number }> }>) ?? [];
      return periods.flatMap(period => (period.modules ?? []).map(m => m.module_id));
    })
  )];

  // Batch-fetch module details
  const moduleMap = new Map<string, { moduleId: string; title: string; category: string }>();
  if (allModuleIds.length > 0) {
    const { data: modRows } = await supabase
      .from('modules')
      .select('module_id, title, category')
      .in('module_id', allModuleIds);
    for (const m of modRows ?? []) {
      const mod = m as Record<string, unknown>;
      moduleMap.set(mod.module_id as string, {
        moduleId: mod.module_id as string,
        title:    mod.title as string,
        category: (mod.category ?? '') as string,
      });
    }
  }

  const orderMap = new Map(programRefs.map(p => [p.program_id, p.display_order]));
  const programs = rows
    .sort((a, b) => (orderMap.get(a.program_id as string) ?? 0) - (orderMap.get(b.program_id as string) ?? 0))
    .map(prog => {
      const periods = (prog.periods as Array<{ period_order: number; period_type?: string; modules?: Array<{ module_id: string; display_order: number }> }>) ?? [];
      const sortedPeriods = periods.sort((a, b) => a.period_order - b.period_order);
      const modulesOrdered = sortedPeriods
        .flatMap(period => (period.modules ?? []).sort((a, b) => a.display_order - b.display_order))
        .map(m => moduleMap.get(m.module_id))
        .filter((m): m is { moduleId: string; title: string; category: string } => !!m);
      return {
        programId:   prog.program_id as string,
        title:       prog.title as string,
        periodType:  sortedPeriods[0]?.period_type as string | undefined,
        periodCount: sortedPeriods.length,
        modules:     modulesOrdered,
      };
    });

  return { packageId: pkg.package_id as string, title: pkg.title as string, programs };
}

export async function getPublishedPackagesForCoach(coachId: string): Promise<CoachingPackage[]> {
  const { data } = await supabase
    .from('packages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapPackage);
}

export async function getAllPackagesForCoach(coachId: string): Promise<CoachingPackage[]> {
  const { data } = await supabase
    .from('packages')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapPackage);
}

export async function deletePackage(packageId: string, coachId: string): Promise<void> {
  // Clear enrollment fields on any clients enrolled in this package
  await supabase.from('client_profiles')
    .update({ package_id: null, enrollment_type: null, started_at: null, completed_at: null, current_module_id: null, responses: [] })
    .eq('package_id', packageId);
  const { error } = await supabase.from('packages').delete()
    .eq('package_id', packageId)
    .eq('coach_id', coachId);
  if (error) throw new Error(error.message);
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:           row.package_id as string,
    coachId:             row.coach_id as string,
    title:               row.title as string,
    description:         row.description as string | undefined,
    coverImageUrl:       row.cover_image_url as string | undefined,
    pricingModel:        row.pricing_model as PricingModel,
    priceUsd:            row.price_usd as number | undefined,
    currencies:          (row.currencies as string[] | undefined) ?? ['INR'],
    totalSeats:          row.total_seats as number | undefined,
    showSeatsFilled:     (row.show_seats_filled as boolean) ?? false,
    applyDeadline:       row.apply_deadline as string | undefined,
    discountPrice:       row.discount_price as number | undefined,
    discountUntil:       row.discount_until as string | undefined,
    isPublished:         row.is_published as boolean,
    certificateUrl:      row.certificate_url as string | undefined,
    certificateTemplate: row.certificate_template as CertificateTemplate | undefined,
    includedProgramIds:  (row.included_program_ids as string[] | undefined) ?? [],
  };
}
