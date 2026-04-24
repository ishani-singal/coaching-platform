import { BookingPage, PaymentLink } from '@coaching/sdk';
export declare function createSessionPage(userId: string, coachId: string, clientId: string | null, enrollmentId: string | null, config: {
    title: string;
    durationMins: number;
    description?: string;
    priceUsd?: number;
}): Promise<BookingPage>;
export declare function syncBookingsToSessions(userId: string, coachId: string): Promise<void>;
export declare function createPackagePaymentLink(userId: string, coachId: string, packageId: string): Promise<PaymentLink>;
//# sourceMappingURL=bookingSkill.d.ts.map