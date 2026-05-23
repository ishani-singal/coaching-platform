import { LibraryItem, CoachingPackage, ClientProfile, PersonaSnapshot, ScoredItem, PersonaRecommendation, CoachRecommendationSettings } from '@coaching/sdk';
export declare function scoreLibraryItemsForClient(items: LibraryItem[], profile: ClientProfile): ScoredItem[];
export declare function scorePackagesForClient(packages: CoachingPackage[], profile: ClientProfile): ScoredItem[];
export declare function getRecommendationSettings(coachId: string): Promise<CoachRecommendationSettings>;
export declare function updateRecommendationSettings(coachId: string, patch: Partial<Omit<CoachRecommendationSettings, 'coachId'>>): Promise<void>;
export declare function semanticRecommendations(coachId: string, clientProfile: ClientProfile, query: string, settings?: CoachRecommendationSettings, citedItemIds?: string[]): Promise<PersonaRecommendation[]>;
export declare function formatRecommendationInPersona(items: ScoredItem[], snapshot: PersonaSnapshot, query: string): Promise<string>;
export declare function streamChatInPersona(snapshot: PersonaSnapshot, clientProfile: ClientProfile | null, history: {
    role: 'user' | 'assistant';
    content: string;
}[], message: string): AsyncGenerator<string>;
export declare function toPersonaRecommendations(scored: ScoredItem[]): PersonaRecommendation[];
//# sourceMappingURL=recommendationTools.d.ts.map