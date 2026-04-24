import { ClientProfile } from '@coaching/sdk';
export declare function addNote(coachId: string, clientId: string, note: string): Promise<void>;
export declare function getNotes(coachId: string, clientId: string): Promise<any[]>;
export declare function deleteNote(noteId: string): Promise<void>;
export declare function addTag(coachId: string, clientId: string, tag: string): Promise<void>;
export declare function removeTag(coachId: string, clientId: string, tag: string): Promise<void>;
export declare function getClientsByTag(coachId: string, tag: string): Promise<ClientProfile[]>;
export declare function getAllTags(coachId: string): Promise<string[]>;
export declare function getClientSummary(coachId: string, clientId: string): Promise<{
    profile: ClientProfile | null;
    notes: any[];
    tags: string[];
    enrollment: null;
    upcomingSessions: never[];
}>;
//# sourceMappingURL=crmTools.d.ts.map