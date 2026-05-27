import { getLLMClient } from '@coaching/tools';
import { CoachProfile } from '@coaching/sdk';
import { upgradeToCoach as upgradeCoachTool, checkSlugAvailable, savePersonaSnapshot, setPersonaSnapshot, getProgramWithPeriods, createProgram, createProgramPeriod, addModuleToPeriodByOrder, forkModule as forkModuleTool } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function upgradeToCoach(
  userId: string,
  slug: string,
  displayName: string,
  includedProgramIds?: string[]
): Promise<{ coachProfile: CoachProfile; subdomainUrl: string }> {
  let step = 'upsertProfile';
  try {
    const coachProfile = await upgradeCoachTool(userId, slug, displayName);

    // Seed an empty draft package
    step = 'seedPackage';
    const { error: pkgError } = await supabase.from('packages').insert({
      coach_id:      userId,
      title:         'My First Package',
      pricing_model: 'free',
      is_published:  false,
    });
    if (pkgError) throw new Error(pkgError.message);

    // Build initial persona snapshot from display name
    step = 'generatePersona';
    const introText = `I am ${displayName}, a coach passionate about helping people reach their goals.`;
    const llm = getLLMClient();
    const systemInstruction = 'Extract tone, style, and a one-sentence summary from this coach intro. Reply as JSON only, no markdown: { "tone": "...", "style": "...", "summary": "..." }';
    const rawText = (await llm.generateText(systemInstruction, introText)).trim().replace(/^```json\s*|```$/g, '');

    let tone = 'encouraging', style = 'conversational', summary = `I am ${displayName}.`;
    try {
      const parsed = JSON.parse(rawText);
      tone    = parsed.tone    ?? tone;
      style   = parsed.style   ?? style;
      summary = parsed.summary ?? summary;
    } catch { /* use defaults */ }

    step = 'savePersonaSnapshot';
    const snapshot = await savePersonaSnapshot(userId, tone, style, summary, {});

    step = 'setPersonaSnapshot';
    await setPersonaSnapshot(userId, snapshot.id);

    if (includedProgramIds && includedProgramIds.length > 0) {
      for (const programId of includedProgramIds) {
        step = `forkProgram:${programId}`;
        await forkProgramForNewCoach(programId, userId);
      }
    }

    const subdomainUrl = `https://${slug}.${process.env.PLATFORM_DOMAIN}`;
    return { coachProfile: { ...coachProfile, personaSnapshotId: snapshot.id }, subdomainUrl };
  } catch (e: unknown) {
    throw new Error(`${step}: ${(e as Error).message}`);
  }
}

export { checkSlugAvailable };

async function forkProgramForNewCoach(originalProgramId: string, newCoachId: string): Promise<void> {
  let forkStep = 'getProgramWithPeriods';
  try {
    const orig = await getProgramWithPeriods(originalProgramId);

    forkStep = 'createProgram';
    const newProg = await createProgram(newCoachId, orig.title, orig.description);

    if (orig.periods && orig.periods.length > 0) {
      for (let pi = 0; pi < orig.periods.length; pi++) {
        const period = orig.periods[pi];
        forkStep = `createProgramPeriod[${pi}]`;
        await createProgramPeriod(newProg.programId, pi, period.label, period.periodType);
        const mods = period.modules ?? [];
        for (let mi = 0; mi < mods.length; mi++) {
          forkStep = `forkModule[${pi}][${mi}]:${mods[mi].moduleId}`;
          const forked = await forkModuleTool(mods[mi].moduleId, newCoachId, { noSublicense: true });
          forkStep = `addModuleToPeriod[${pi}][${mi}]`;
          await addModuleToPeriodByOrder(newProg.programId, pi, forked.moduleId, mi);
        }
      }
    } else {
      forkStep = 'createProgramPeriod[implicit]';
      await createProgramPeriod(newProg.programId, 0, '', 'custom');
      const mods = orig.modules ?? [];
      for (let mi = 0; mi < mods.length; mi++) {
        forkStep = `forkModule[implicit][${mi}]:${mods[mi].moduleId}`;
        const forked = await forkModuleTool(mods[mi].moduleId, newCoachId, { noSublicense: true });
        forkStep = `addModuleToPeriod[implicit][${mi}]`;
        await addModuleToPeriodByOrder(newProg.programId, 0, forked.moduleId, mi);
      }
    }
  } catch (e: unknown) {
    throw new Error(`${forkStep}: ${(e as Error).message}`);
  }
}
