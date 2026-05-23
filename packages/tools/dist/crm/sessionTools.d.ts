import { CoachingSession, SessionStatus } from '@coaching/sdk';
export declare function recordSession(coachId: string, clientId: string, bookingRef: string, paymentRef: string | null, scheduledAt: Date, durationMins?: number): Promise<CoachingSession>;
export declare function updateSessionStatus(sessionId: string, status: SessionStatus, notes?: string): Promise<void>;
export declare function getSessionHistory(coachId: string, clientId?: string): Promise<CoachingSession[]>;
export declare function getUpcomingSessions(coachId: string): Promise<CoachingSession[]>;
//# sourceMappingURL=sessionTools.d.ts.map