import { ClientProfile, PersonaRecommendation } from '@coaching/sdk';
import {
  getLatestPersonaSnapshot,
  getLibraryByCoach,
  getPublishedPackagesForCoach,
  scoreLibraryItemsForClient,
  scorePackagesForClient,
  formatRecommendationInPersona,
  streamChatInPersona,
  toPersonaRecommendations,
} from '@coaching/tools';

export async function getRecommendations(
  coachId: string,
  clientProfile: ClientProfile,
  query: string
): Promise<PersonaRecommendation[]> {
  const [snapshot, library, packages] = await Promise.all([
    getLatestPersonaSnapshot(coachId),
    getLibraryByCoach(coachId),
    getPublishedPackagesForCoach(coachId),
  ]);

  if (!snapshot) return [];

  const scoredItems    = scoreLibraryItemsForClient(library, clientProfile);
  const scoredPackages = scorePackagesForClient(packages, clientProfile);

  const top = [...scoredItems, ...scoredPackages]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  await formatRecommendationInPersona(top, snapshot, query);
  return toPersonaRecommendations(top);
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
