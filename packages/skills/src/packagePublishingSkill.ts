import { CoachingPackage, CertificateTemplate, PricingModel } from '@coaching/sdk';
import { createPackage, addProgramToPackage, publishPackage as publishPkgTool, unpublishPackage as unpublishPkgTool, getPackageWithPrograms } from '@coaching/tools';

export async function assemblePackage(
  coachId: string,
  title: string,
  programIds: string[],
  pricing: {
    model: PricingModel;
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
  const pkg = await createPackage(coachId, title, pricing.model, {
    priceUsd:            pricing.priceUsd,
    currencies:          pricing.currencies,
    totalSeats:          pricing.totalSeats,
    showSeatsFilled:     pricing.showSeatsFilled,
    applyDeadline:       pricing.applyDeadline,
    discountPrice:       pricing.discountPrice,
    discountUntil:       pricing.discountUntil,
    certificateUrl:      pricing.certificateUrl,
    certificateTemplate: pricing.certificateTemplate,
    includedProgramIds:  pricing.includedProgramIds,
  });
  for (let i = 0; i < programIds.length; i++) {
    await addProgramToPackage(pkg.packageId, programIds[i], i);
  }
  return pkg;
}

export async function publishPackage(packageId: string): Promise<void> {
  await publishPkgTool(packageId);
}

export async function unpublishPackage(packageId: string): Promise<void> {
  await unpublishPkgTool(packageId);
}

export { getPackageWithPrograms };
