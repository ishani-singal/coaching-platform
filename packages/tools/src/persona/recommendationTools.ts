import { GoogleGenerativeAI } from '@google/generative-ai';
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
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    systemInstruction: `You are ${snapshot.summary}. Tone: ${snapshot.tone}. Style: ${snapshot.style}. Respond in first person as the coach.`,
  });
  const context = items.slice(0, 5).map(s => {
    const item = s.item as LibraryItem;
    return `- ${item.title}: ${item.description ?? ''}`;
  }).join('\n');

  const result = await model.generateContent(`${query}\n\nRelevant resources:\n${context}`);
  return result.response.text();
}

export async function* streamChatInPersona(
  snapshot: PersonaSnapshot,
  clientProfile: ClientProfile | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  message: string
): AsyncGenerator<string> {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const systemPrompt = [
    `You are ${snapshot.summary}.`,
    `Tone: ${snapshot.tone}. Style: ${snapshot.style}.`,
    clientProfile
      ? `You are speaking with ${clientProfile.name}. Their goals: ${clientProfile.goals}.`
      : 'You are speaking with a prospective client.',
  ].join('\n');

  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({
    history: history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessageStream(message);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
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
