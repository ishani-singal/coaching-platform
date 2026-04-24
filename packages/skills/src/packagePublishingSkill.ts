import { CoachingPackage, PricingModel } from '@coaching/sdk';
import { createPackage, addProgramToPackage, publishPackage as publishPkgTool, getPackageWithPrograms } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function assemblePackage(
  coachId: string,
  personaSnapshotId: string,
  title: string,
  programIds: string[],
  pricing: { model: PricingModel; priceUsd?: number }
): Promise<CoachingPackage> {
  const pkg = await createPackage(coachId, personaSnapshotId, title, pricing.model, pricing.priceUsd);
  for (let i = 0; i < programIds.length; i++) {
    await addProgramToPackage(pkg.packageId, programIds[i], i);
  }
  return pkg;
}

export async function publishPackage(packageId: string): Promise<void> {
  await publishPkgTool(packageId);
}

export async function unpublishPackage(packageId: string): Promise<void> {
  await supabase.from('coaching_packages').update({ is_published: false }).eq('package_id', packageId);
}

export { getPackageWithPrograms };
