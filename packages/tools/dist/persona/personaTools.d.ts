import { PersonaSnapshot, PersonaSource } from '@coaching/sdk';
export declare function addPersonaSource(coachId: string, sourceType: PersonaSource['sourceType'], content?: string, url?: string): Promise<PersonaSource>;
export declare function removePersonaSource(sourceId: string): Promise<void>;
export declare function getPersonaSources(coachId: string): Promise<PersonaSource[]>;
export declare function getLatestPersonaSnapshot(coachId: string): Promise<PersonaSnapshot | null>;
export declare function savePersonaSnapshot(coachId: string, tone: string, style: string, summary: string, raw: Record<string, unknown>): Promise<PersonaSnapshot>;
//# sourceMappingURL=personaTools.d.ts.map