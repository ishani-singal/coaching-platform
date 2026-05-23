import { ClientProfile } from '@coaching/sdk';
export declare function createClientProfile(coachId: string, data: Partial<ClientProfile>): Promise<ClientProfile>;
export declare function upsertClientProfile(coachId: string, email: string, data: Partial<ClientProfile>): Promise<ClientProfile>;
export declare function getClientProfile(clientId: string): Promise<ClientProfile>;
export declare function getClientByInviteToken(token: string): Promise<ClientProfile>;
export declare function getClientsByCoach(coachId: string): Promise<ClientProfile[]>;
export declare function updateClientProfile(clientId: string, patch: Partial<ClientProfile>): Promise<void>;
//# sourceMappingURL=clientProfileTools.d.ts.map