import { EnrollmentType, ClientProfile, CoachingPackage } from '@coaching/sdk';
export declare function createEnrollment(packageId: string, coachId: string, clientId: string, type: EnrollmentType): Promise<ClientProfile>;
export declare function getEnrollmentByToken(token: string): Promise<ClientProfile & {
    pkg: CoachingPackage;
}>;
export declare function getEnrollmentWithProgress(clientId: string): Promise<{
    enrollment: ClientProfile;
    completedSectionIds: string[];
    responses: {
        section_id: string;
        response_data: Record<string, unknown>;
        submitted_at: string;
    }[];
}>;
export declare function submitResponse(clientId: string, sectionId: string, responseData: Record<string, unknown>): Promise<void>;
export declare function advanceCurrentModule(clientId: string, nextModuleId: string): Promise<void>;
export declare function completeEnrollment(clientId: string): Promise<void>;
export declare function getCoachEnrollmentStats(coachId: string, packageId?: string): Promise<{
    totalEnrollments: number;
    activeEnrollments: number;
    completionRate: number;
    avgModuleReached: number;
}>;
//# sourceMappingURL=enrollmentTools.d.ts.map