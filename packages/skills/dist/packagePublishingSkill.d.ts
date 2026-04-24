import { CoachingPackage, PricingModel } from '@coaching/sdk';
import { getPackageWithPrograms } from '@coaching/tools';
export declare function assemblePackage(coachId: string, personaSnapshotId: string, title: string, programIds: string[], pricing: {
    model: PricingModel;
    priceUsd?: number;
}): Promise<CoachingPackage>;
export declare function publishPackage(packageId: string): Promise<void>;
export declare function unpublishPackage(packageId: string): Promise<void>;
export { getPackageWithPrograms };
//# sourceMappingURL=packagePublishingSkill.d.ts.map