import Anthropic from '@anthropic-ai/sdk';
import { LibraryItem, CoachingPackage, ClientProfile, PersonaSnapshot, ScoredItem, PersonaRecommendation } from '@coaching/sdk';

export function scoreLibraryItemsForClient(items: LibraryItem[], profile: ClientProfile): ScoredItem[] {
  const focusAreas = profile.preferences.focusAreas ?? [];
  const goalWords  = (profile.goals ?? '').toLowerCase().split(/\s+/);

  return items.map(item => {
    const tagOverlap   = item.tags.filter(t => focusAreas.includes(t)).length;
    const descWords    = (item.description ?? '').toLowerCase().split(/\s+/);
    const keywordMatch = goalWords.filter(w => w.length > 3 && descWords.includes(w)).length;
    const score        = tagOverlap * 2 + keywordMatch;
    return { item, score, matchedGoals: item.tags.filter(t => focusAreas.includes(t)) };
  }).sort((a, b) => b.score - a.score);
}

export function scorePackagesForClient(packages: CoachingPackage[], profile: ClientProfile): ScoredItem[] {
  const focusAreas = profile.preferences.focusAreas ?? [];
  const goalWords  = (profile.goals ?? '').toLowerCase().split(/\s+/);

  return packages.map(pkg => {
    const descWords    = ((pkg.description ?? '') + ' ' + pkg.title).toLowerCase().split(/\s+/);
    const keywordMatch = goalWords.filter(w => w.length > 3 && descWords.includes(w)).length;
    return { item: pkg, score: keywordMatch, matchedGoals: focusAreas };
  }).sort((a, b) => b.score - a.score);
}

export async function formatRecommendationInPersona(
  items: ScoredItem[],
  snapshot: PersonaSnapshot,
  query: string
): Promise<string> {
  const client = new Anthropic();
  const context = items.slice(0, 5).map(s => {
    const item = s.item as LibraryItem;
    return `- ${item.title}: ${item.description ?? ''}`;
  }).join('\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `You are ${snapshot.summary}. Tone: ${snapshot.tone}. Style: ${snapshot.style}. Respond in first person as the coach.`,
    messages: [{ role: 'user', content: `${query}\n\nRelevant resources:\n${context}` }],
  });
  return (msg.content[0] as { text: string }).text;
}

export async function* streamChatInPersona(
  snapshot: PersonaSnapshot,
  clientProfile: ClientProfile | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  message: string
): AsyncGenerator<string> {
  const client = new Anthropic();
  const systemPrompt = [
    `You are ${snapshot.summary}.`,
    `Tone: ${snapshot.tone}. Style: ${snapshot.style}.`,
    clientProfile
      ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
      : 'You are speaking with a prospective client.',
  ].join('\n');

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: message },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

export function toPersonaRecommendations(scored: ScoredItem[]): PersonaRecommendation[] {
  return scored.slice(0, 5).map(s => {
    const item = s.item as LibraryItem;
    const type: PersonaRecommendation['type'] =
      item.itemType === 'youtube' ? 'video' :
      item.itemType === 'book'    ? 'book'  :
      item.itemType === 'article' ? 'article' : 'module';
    return {
      type,
      title:       item.title,
      description: item.description ?? '',
      url:         item.url,
      score:       s.score,
      reasoning:   `Matched: ${s.matchedGoals.join(', ')}`,
    };
  });
}
