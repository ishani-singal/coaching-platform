import { LicenseTerms, AncestryRow, RevenueAllocation } from '@coaching/sdk';
export declare function createModuleLicense(licensorId: string, licenseeId: string, moduleId: string, terms: LicenseTerms): Promise<void>;
export declare function createProgramLicense(licensorId: string, licenseeId: string, programId: string, terms: LicenseTerms): Promise<{
    inviteToken: string;
    licenseId: string;
}>;
export declare function getPendingLicenseByToken(token: string): Promise<Record<string, unknown> | null>;
export declare function activateProgramLicenseById(licenseId: string): Promise<{
    programId: string;
    licenseeCoachId: string;
}>;
export declare function revokeModuleLicense(licenseId: string): Promise<void>;
export declare function getAncestryChain(moduleId: string): Promise<AncestryRow[]>;
export declare function calculateRevenueSplit(priceUsd: number, ancestry: AncestryRow[]): RevenueAllocation[];
export declare function writeRevenueEvents(clientId: string, allocations: RevenueAllocation[]): Promise<void>;
export declare function getLicensesGrantedByCoach(coachId: string): Promise<any[]>;
export declare function getLicensesHeldByCoach(coachId: string): Promise<any[]>;
export declare function getRevenueByCoach(coachId: string, since?: string): Promise<{
    totalUsd: number;
    byModule: {};
    byLicensee: {};
}>;
//# sourceMappingURL=licenseTools.d.ts.map