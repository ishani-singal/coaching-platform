import { CalendarEvent } from '@coaching/sdk';
export declare function getUpcomingEvents(userId: string, days?: number): Promise<CalendarEvent[]>;
export declare function createCalendarEvent(userId: string, params: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    attendeeEmail?: string;
}): Promise<import("@coaching/sdk").ActionResponse>;
export declare function checkAvailability(userId: string, startTime: string, endTime: string): Promise<boolean>;
export declare function getCalendarContext(userId: string): Promise<import("@coaching/sdk").ContextResponse>;
//# sourceMappingURL=calendarBridge.d.ts.map