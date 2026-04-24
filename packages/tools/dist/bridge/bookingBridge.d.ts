import { BookingPage } from '@coaching/sdk';
export declare function createBookingPage(userId: string, params: {
    title: string;
    durationMins: number;
    description?: string;
    priceUsd?: number;
}): Promise<BookingPage>;
export declare function getBookingPages(userId: string): Promise<BookingPage[]>;
export declare function cancelBooking(userId: string, bookingRef: string, reason?: string): Promise<import("@coaching/sdk").ActionResponse>;
export declare function getBookingContext(userId: string): Promise<import("@coaching/sdk").ContextResponse>;
//# sourceMappingURL=bookingBridge.d.ts.map