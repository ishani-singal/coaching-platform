import { ClientProfile, PersonaRecommendation } from '@coaching/sdk';
import {
  getLatestPersonaSnapshot,
  streamChatInPersona,
  semanticRecommendations,
} from '@coaching/tools';

export async function getRecommendations(
  coachId: string,
  clientProfile: ClientProfile,
  query: string,
  citedItemIds?: string[]
): Promise<PersonaRecommendation[]> {
  const snapshot = await getLatestPersonaSnapshot(coachId);
  if (!snapshot) return [];

  return semanticRecommendations(coachId, clientProfile, query, undefined, citedItemIds);
}

export async function* streamPersonaChat(
  coachId: string,
  clientProfile: ClientProfile | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  message: string
): AsyncGenerator<string> {
  const snapshot = await getLatestPersonaSnapshot(coachId);
  if (!snapshot) {
    yield 'Coach persona not yet configured.';
    return;
  }
  yield* streamChatInPersona(snapshot, clientProfile, history, message);
}
