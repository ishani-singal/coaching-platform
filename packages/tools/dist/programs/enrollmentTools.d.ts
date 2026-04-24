import { EnrollmentRecord, EnrollmentType, ClientProfile, CoachingPackage } from '@coaching/sdk';
export declare function createEnrollment(packageId: string, coachId: string, clientId: string, type: EnrollmentType): Promise<EnrollmentRecord>;
export declare function getEnrollmentByToken(token: string): Promise<EnrollmentRecord & {
    client: ClientProfile;
    pkg: CoachingPackage;
}>;
export declare function getEnrollmentWithProgress(enrollmentId: string): Promise<{
    enrollment: EnrollmentRecord;
    completedSectionIds: string[];
    responses: {
        section_id: any;
        response_data: any;
        submitted_at: any;
    }[];
}>;
export declare function submitResponse(enrollmentId: string, sectionId: string, responseData: Record<string, unknown>): Promise<void>;
export declare function advanceCurrentModule(enrollmentId: string, nextModuleId: string): Promise<void>;
export declare function completeEnrollment(enrollmentId: string): Promise<void>;
export declare function getCoachEnrollmentStats(coachId: string, packageId?: string): Promise<{
    totalEnrollments: number;
    activeEnrollments: number;
    completionRate: number;
    avgModuleReached: number;
}>;
//# sourceMappingURL=enrollmentTools.d.ts.map