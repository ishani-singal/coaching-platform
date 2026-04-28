import { CoachModuleClientData } from '@coaching/sdk';
import {
  upsertClientModuleData,
  getClientModuleData,
  getAllClientDataForModule,
} from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function saveClientModuleData(
  coachId: string,
  moduleId: string,
  clientId: string,
  data: Record<string, unknown>
): Promise<CoachModuleClientData> {
  // Application-layer guard: verify the client belongs to this coach.
  // The DB RLS INSERT policy enforces the same check at the DB layer.
  const { data: client } = await supabase
    .from('client_profiles')
    .select('coach_id')
    .eq('client_id', clientId)
    .single();
  if (client?.coach_id !== coachId) throw new Error('Not authorized: client does not belong to this coach');

  return upsertClientModuleData(coachId, moduleId, clientId, data);
}

export async function loadClientModuleData(
  coachId: string,
  moduleId: string,
  clientId: string
): Promise<CoachModuleClientData | null> {
  return getClientModuleData(coachId, moduleId, clientId);
}

export async function loadAllClientsForModule(
  coachId: string,
  moduleId: string
): Promise<CoachModuleClientData[]> {
  return getAllClientDataForModule(coachId, moduleId);
}
