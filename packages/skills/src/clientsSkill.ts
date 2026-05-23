import OpenAI from 'openai';
import { CoachModuleClientData, ClientProfile, EnrollmentType } from '@coaching/sdk';
import { supabase } from '@coaching/sdk';
import { createEnrollment, getClientsByCoach } from '@coaching/tools';
import { saveClientModuleData, loadClientModuleData, loadAllClientsForModule } from './clientModuleDataSkill';

export { getClientsByCoach };

export async function assignProgramToClient(
  coachId: string,
  clientId: string,
  packageId: string,
  type: EnrollmentType
): Promise<ClientProfile> {
  const { data: client } = await supabase
    .from('client_profiles')
    .select('coach_id')
    .eq('client_id', clientId)
    .single();
  if (client?.coach_id !== coachId) throw new Error('Not authorized: client does not belong to this coach');

  const { data: pkg } = await supabase
    .from('packages')
    .select('coach_id')
    .eq('package_id', packageId)
    .single();
  if (pkg?.coach_id !== coachId) throw new Error('Not authorized: package does not belong to this coach');

  return createEnrollment(packageId, coachId, clientId, type);
}

export async function saveClientModuleNotes(
  coachId: string,
  clientId: string,
  moduleId: string,
  notes: Record<string, unknown>
): Promise<CoachModuleClientData> {
  return saveClientModuleData(coachId, moduleId, clientId, notes);
}

export async function getClientModuleNotes(
  coachId: string,
  clientId: string,
  moduleId: string
): Promise<CoachModuleClientData | null> {
  return loadClientModuleData(coachId, moduleId, clientId);
}

export async function getAllClientNotesForModule(
  coachId: string,
  moduleId: string
): Promise<CoachModuleClientData[]> {
  return loadAllClientsForModule(coachId, moduleId);
}

export interface InsightMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateClientInsight(
  coachId: string,
  clientId: string,
  options: { moduleId?: string; messages: InsightMessage[] }
): Promise<string> {
  const { data: clientRow } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('client_id', clientId)
    .single();
  if (clientRow?.coach_id !== coachId) throw new Error('Not authorized: client does not belong to this coach');

  const rawResponses = (clientRow.responses ?? []) as Array<{
    section_id: string; response_data: Record<string, unknown>; submitted_at: string;
  }>;

  const allResponses: Array<{ moduleId: string; contentType: string; prompt: string; response: string; submittedAt: string }> = [];
  if (rawResponses.length > 0) {
    const sectionIds = rawResponses.map(r => r.section_id);
    const { data: sections } = await supabase
      .from('module_sections')
      .select('section_id, content_type, body, module_id')
      .in('section_id', sectionIds);

    const sectionMap = new Map((sections ?? []).map((s: Record<string, unknown>) => [s.section_id as string, s]));

    for (const r of rawResponses) {
      const section = sectionMap.get(r.section_id);
      if (!section) continue;
      if (options.moduleId && section.module_id !== options.moduleId) continue;
      const body = section.body as Record<string, unknown>;
      const responseStr = JSON.stringify(r.response_data ?? {});
      allResponses.push({
        moduleId:    section.module_id as string,
        contentType: section.content_type as string,
        prompt:      (body.question ?? body.prompt ?? body.title ?? '') as string,
        response:    responseStr.length > 300 ? responseStr.slice(0, 300) + '…' : responseStr,
        submittedAt: r.submitted_at,
      });
    }
  }

  let noteRows: Array<Record<string, unknown>> = [];
  if (options.moduleId) {
    const note = await loadClientModuleData(coachId, options.moduleId, clientId);
    if (note) noteRows = [note as unknown as Record<string, unknown>];
  } else {
    const { data } = await supabase
      .from('coach_module_client_data')
      .select('*')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at');
    noteRows = data ?? [];
  }

  const enrollmentLine = clientRow.enrollment_type
    ? `  type=${clientRow.enrollment_type} started=${clientRow.started_at ?? 'not yet'} completed=${clientRow.completed_at ?? 'ongoing'}`
    : null;
  const enrollmentLines = enrollmentLine ?? '';

  const responsesLines = allResponses.map(r =>
    `  [${r.moduleId} / ${r.contentType}] Prompt: ${r.prompt} | Response: ${r.response}`
  ).join('\n');

  const notesLines = noteRows.map((n: Record<string, unknown>) =>
    `  [${n.module_id}] ${JSON.stringify(n.data)} (updated: ${n.updated_at})`
  ).join('\n');

  const systemPrompt = [
    'You are a coaching assistant helping a coach privately understand their client.',
    '',
    'CLIENT PROFILE:',
    `  Name: ${clientRow.name} | Email: ${clientRow.email}`,
    `  Goals: ${clientRow.goals ?? 'not set'}`,
    `  Background: ${clientRow.background ?? 'not set'}`,
    `  Preferences: ${JSON.stringify(clientRow.preferences ?? {})}`,
    '',
    'ENROLLMENT HISTORY:',
    enrollmentLines || '  (none)',
    '',
    'CLIENT MODULE RESPONSES:',
    responsesLines || '  (none)',
    '',
    'COACH PRIVATE NOTES:',
    notesLines || '  (none)',
    '',
    options.moduleId ? `Scope: Module ${options.moduleId} only.` : 'Scope: All modules.',
    'Answer the coach\'s questions concisely and actionably. This data is private to the coach — never suggest sharing it with the client.',
  ].join('\n');

  const openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: process.env.AZURE_OPENAI_ENDPOINT,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
  });
  const response = await openai.chat.completions.create({
    model:      process.env.AZURE_OPENAI_DEPLOYMENT ?? 'Phi-4-mini-reasoning-1',
    max_tokens: 1024,
    messages:   [
      { role: 'system', content: systemPrompt },
      ...options.messages,
    ],
  });

  return response.choices[0].message.content ?? '';
}
