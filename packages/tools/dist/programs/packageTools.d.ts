import { CoachingPackage, PricingModel } from '@coaching/sdk';
export declare function createPackage(coachId: string, personaSnapshotId: string, title: string, pricingModel: PricingModel, priceUsd?: number): Promise<CoachingPackage>;
export declare function addProgramToPackage(packageId: string, programId: string, order: number): Promise<void>;
export declare function publishPackage(packageId: string): Promise<void>;
export declare function getPackageWithPrograms(packageId: string): Promise<CoachingPackage>;
export declare function getPublishedPackagesForCoach(coachId: string): Promise<CoachingPackage[]>;
//# sourceMappingURL=packageTools.d.ts.map