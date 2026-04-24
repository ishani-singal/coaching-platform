import { LicenseTerms, RevenueAllocation } from '@coaching/sdk';
export declare function licenseModuleToCoach(licensorId: string, licenseeId: string, moduleId: string, terms: LicenseTerms): Promise<void>;
export declare function computeAndWriteRevenue(enrollmentId: string, priceUsd: number): Promise<RevenueAllocation[]>;
export declare function getLicenseDashboard(coachId: string): Promise<{
    granted: any[];
    held: any[];
    revenueThisMonth: number;
    topEarningModule: null;
}>;
//# sourceMappingURL=licensingSkill.d.ts.map