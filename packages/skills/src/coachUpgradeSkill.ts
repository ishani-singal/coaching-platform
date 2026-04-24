import { GoogleGenerativeAI } from '@google/generative-ai';
import { CoachProfile } from '@coaching/sdk';
import { upgradeToCoach as upgradeCoachTool, checkSlugAvailable, addPersonaSource, savePersonaSnapshot, setPersonaSnapshot } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function upgradeToCoach(
  userId: string,
  slug: string,
  displayName: string
): Promise<{ coachProfile: CoachProfile; subdomainUrl: string }> {
  const coachProfile = await upgradeCoachTool(userId, slug, displayName);

  // Seed an empty draft package
  await supabase.from('coaching_packages').insert({
    coach_id:      userId,
    title:         'My First Package',
    pricing_model: 'free',
    is_published:  false,
  });

  // Add a welcome persona source
  const source = await addPersonaSource(
    userId,
    'text',
    `I am ${displayName}, a coach passionate about helping people reach their goals.`
  );

  // Build initial persona snapshot via LLM
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-04-17',
    systemInstruction: 'Extract tone, style, and a one-sentence summary from this coach intro. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "summary": "..." }',
  });
  const result = await model.generateContent(source.content ?? '');
  const rawText = result.response.text().trim().replace(/^```json\s*|```$/g, '');

  let tone = 'encouraging', style = 'conversational', summary = `I am ${displayName}.`;
  try {
    const parsed = JSON.parse(rawText);
    tone    = parsed.tone    ?? tone;
    style   = parsed.style   ?? style;
    summary = parsed.summary ?? summary;
  } catch { /* use defaults */ }

  const snapshot = await savePersonaSnapshot(userId, tone, style, summary, {});
  await setPersonaSnapshot(userId, snapshot.id);

  const subdomainUrl = `https://${slug}.${process.env.PLATFORM_DOMAIN}`;
  return { coachProfile: { ...coachProfile, personaSnapshotId: snapshot.id }, subdomainUrl };
}

export { checkSlugAvailable };
