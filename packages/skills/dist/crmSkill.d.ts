export declare function getClientDashboard(coachId: string, clientId: string): Promise<{
    profile: import("@coaching/sdk").ClientProfile;
    notes: any[];
    tags: string[];
    enrollment: any;
    sessions: import("@coaching/sdk").CoachingSession[];
    nextSession: import("@coaching/sdk").CoachingSession | undefined;
}>;
export declare function getCoachCRMOverview(coachId: string): Promise<{
    active: {
        tags: string[];
        enrollmentStatus: string;
        lastSession: null;
        completionPct: number;
        clientId: string;
        coachId: string;
        enrollmentId?: string;
        inviteToken?: string;
        name: string;
        email: string;
        phone?: string;
        goals: string;
        background: string;
        preferences: {
            learningStyle?: string;
            availability?: string;
            focusAreas?: string[];
        };
    }[];
    completed: {
        tags: string[];
        enrollmentStatus: string;
        lastSession: null;
        completionPct: number;
        clientId: string;
        coachId: string;
        enrollmentId?: string;
        inviteToken?: string;
        name: string;
        email: string;
        phone?: string;
        goals: string;
        background: string;
        preferences: {
            learningStyle?: string;
            availability?: string;
            focusAreas?: string[];
        };
    }[];
    prospect: {
        tags: string[];
        enrollmentStatus: string;
        lastSession: null;
        completionPct: number;
        clientId: string;
        coachId: string;
        enrollmentId?: string;
        inviteToken?: string;
        name: string;
        email: string;
        phone?: string;
        goals: string;
        background: string;
        preferences: {
            learningStyle?: string;
            availability?: string;
            focusAreas?: string[];
        };
    }[];
}>;
export declare function getPipelineView(coachId: string): Promise<Record<string, import("@coaching/sdk").ClientProfile[]>>;
//# sourceMappingURL=crmSkill.d.ts.map