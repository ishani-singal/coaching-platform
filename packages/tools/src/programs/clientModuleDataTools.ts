import { supabase } from '@coaching/sdk';
import { CoachModuleClientData } from '@coaching/sdk';

export async function upsertClientModuleData(
  coachId: string,
  moduleId: string,
  clientId: string,
  data: Record<string, unknown>
): Promise<CoachModuleClientData> {
  const { data: row, error } = await supabase
    .from('coach_module_client_data')
    .upsert(
      { coach_id: coachId, module_id: moduleId, client_id: clientId, data },
      { onConflict: 'coach_id,module_id,client_id' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRecord(row);
}

export async function getClientModuleData(
  coachId: string,
  moduleId: string,
  clientId: string
): Promise<CoachModuleClientData | null> {
  const { data, error } = await supabase
    .from('coach_module_client_data')
    .select('*')
    .eq('coach_id', coachId)
    .eq('module_id', moduleId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRecord(data) : null;
}

export async function getAllClientDataForModule(
  coachId: string,
  moduleId: string
): Promise<CoachModuleClientData[]> {
  const { data, error } = await supabase
    .from('coach_module_client_data')
    .select('*')
    .eq('coach_id', coachId)
    .eq('module_id', moduleId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRecord);
}

export async function deleteClientModuleData(recordId: string): Promise<void> {
  await supabase.from('coach_module_client_data').delete().eq('record_id', recordId);
}

function mapRecord(row: Record<string, unknown>): CoachModuleClientData {
  return {
    recordId:  row.record_id as string,
    coachId:   row.coach_id as string,
    moduleId:  row.module_id as string,
    clientId:  row.client_id as string,
    data:      row.data as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
