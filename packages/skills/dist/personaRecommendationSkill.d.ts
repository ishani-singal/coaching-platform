import { ClientProfile, PersonaRecommendation } from '@coaching/sdk';
export declare function getRecommendations(coachId: string, clientProfile: ClientProfile, query: string): Promise<PersonaRecommendation[]>;
export declare function streamPersonaChat(coachId: string, clientProfile: ClientProfile | null, history: {
    role: 'user' | 'assistant';
    content: string;
}[], message: string): AsyncGenerator<string>;
//# sourceMappingURL=personaRecommendationSkill.d.ts.map