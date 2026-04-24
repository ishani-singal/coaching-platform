import { supabase } from '@coaching/sdk';
import { CoachingPackage, PricingModel } from '@coaching/sdk';

export async function createPackage(
  coachId: string,
  personaSnapshotId: string,
  title: string,
  pricingModel: PricingModel,
  priceUsd?: number
): Promise<CoachingPackage> {
  const { data, error } = await supabase
    .from('coaching_packages')
    .insert({ coach_id: coachId, persona_snapshot_id: personaSnapshotId, title, pricing_model: pricingModel, price_usd: priceUsd })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data);
}

export async function addProgramToPackage(packageId: string, programId: string, order: number): Promise<void> {
  await supabase.from('package_programs').insert({ package_id: packageId, program_id: programId, display_order: order });
}

export async function publishPackage(packageId: string): Promise<void> {
  const { data: pkg } = await supabase
    .from('coaching_packages')
    .select('persona_snapshot_id')
    .eq('package_id', packageId)
    .single();

  if (!pkg?.persona_snapshot_id) throw new Error('No persona snapshot linked');

  const { data: programs } = await supabase
    .from('package_programs')
    .select('program_id, programs(is_published, program_modules(module_id, modules(is_published)))')
    .eq('package_id', packageId);

  if (!programs || programs.length === 0) throw new Error('No programs linked');

  for (const pp of programs) {
    const prog = pp.programs as Record<string, unknown>;
    if (!prog.is_published) throw new Error(`Program ${pp.program_id} is unpublished`);
    const pms = prog.program_modules as { module_id: string; modules: { is_published: boolean } }[];
    for (const pm of pms ?? []) {
      if (!pm.modules.is_published) throw new Error(`Module ${pm.module_id} in program ${pp.program_id} unpublished`);
    }
  }

  await supabase.from('coaching_packages').update({ is_published: true }).eq('package_id', packageId);
}

export async function getPackageWithPrograms(packageId: string): Promise<CoachingPackage> {
  const { data, error } = await supabase
    .from('coaching_packages')
    .select('*, package_programs(display_order, programs(*))')
    .eq('package_id', packageId)
    .single();
  if (error) throw new Error(error.message);
  return mapPackage(data);
}

export async function getPublishedPackagesForCoach(coachId: string): Promise<CoachingPackage[]> {
  const { data } = await supabase
    .from('coaching_packages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapPackage);
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:         row.package_id as string,
    coachId:           row.coach_id as string,
    personaSnapshotId: row.persona_snapshot_id as string,
    title:             row.title as string,
    description:       row.description as string | undefined,
    coverImageUrl:     row.cover_image_url as string | undefined,
    pricingModel:      row.pricing_model as PricingModel,
    priceUsd:          row.price_usd as number | undefined,
    isPublished:       row.is_published as boolean,
  };
}
