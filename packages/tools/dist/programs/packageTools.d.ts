import { CoachingPackage, CertificateTemplate, PricingModel } from '@coaching/sdk';
export declare function createPackage(coachId: string, title: string, pricingModel: PricingModel, opts?: {
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
}): Promise<CoachingPackage>;
export declare function updatePackage(packageId: string, coachId: string, title: string, pricingModel: PricingModel, opts?: {
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
}): Promise<CoachingPackage>;
export declare function addProgramToPackage(packageId: string, programId: string, order: number): Promise<void>;
export declare function relinkPackagePrograms(packageId: string, programIds: string[]): Promise<void>;
export declare function publishPackage(packageId: string): Promise<void>;
export declare function unpublishPackage(packageId: string): Promise<void>;
export declare function getPackageWithPrograms(packageId: string): Promise<CoachingPackage>;
export declare function getPackageDetail(packageId: string): Promise<{
    packageId: string;
    title: string;
    programs: {
        programId: string;
        title: string;
        periodType?: string;
        periodCount: number;
        modules: {
            moduleId: string;
            title: string;
            category: string;
        }[];
    }[];
}>;
export declare function getPublishedPackagesForCoach(coachId: string): Promise<CoachingPackage[]>;
export declare function getAllPackagesForCoach(coachId: string): Promise<CoachingPackage[]>;
export declare function deletePackage(packageId: string, coachId: string): Promise<void>;
//# sourceMappingURL=packageTools.d.ts.map