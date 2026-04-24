import { EnrollmentRecord, ClientProfile, ModuleSectionSpec, EnrollmentType } from '@coaching/sdk';
import { getCoachEnrollmentStats } from '@coaching/tools';
export declare function enrollClient(packageId: string, coachId: string, clientData: Partial<ClientProfile>, type: EnrollmentType): Promise<{
    enrollment: EnrollmentRecord;
    portalUrl: string;
}>;
export declare function getModuleView(enrollmentId: string, moduleId: string): Promise<ModuleSectionSpec[]>;
export declare function completeSection(enrollmentId: string, sectionId: string, response?: Record<string, unknown>): Promise<{
    moduleComplete: boolean;
    programComplete: boolean;
    packageComplete: boolean;
}>;
export declare function getCoachDashboard(coachId: string): Promise<{
    enrollmentId: unknown;
    clientName: unknown;
    packageTitle: unknown;
    currentModule: unknown;
    enrollmentType: unknown;
    completedAt: unknown;
}[]>;
export { getCoachEnrollmentStats };
//# sourceMappingURL=enrollmentDeliverySkill.d.ts.map