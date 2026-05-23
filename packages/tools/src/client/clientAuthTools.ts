import { supabase } from '@coaching/sdk';
import { ClientProfile } from '@coaching/sdk';

/**
 * Links a Supabase auth account (userId) to an existing client_profile.
 * Called after a client signs up via the invite flow.
 * The clientId must match the invite token the user received.
 */
export async function linkClientAccount(clientId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('client_profiles')
    .update({ user_id: userId })
    .eq('client_id', clientId)
    .is('user_id', null); // only link once
  if (error) throw new Error(error.message);
}

/**
 * Links a client by invite token instead of clientId.
 * Useful when the client signs up and we only have the token from the URL.
 */
export async function linkClientAccountByToken(inviteToken: string, userId: string): Promise<ClientProfile | null> {
  const { data, error } = await supabase
    .from('client_profiles')
    .update({ user_id: userId })
    .eq('invite_token', inviteToken)
    .is('user_id', null)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapClientProfile(data) : null;
}

/**
 * Returns all client_profiles for a given auth user (across all coaches).
 * A user can be a client of multiple coaches simultaneously.
 */
export async function getClientProfilesByUser(userId: string): Promise<ClientProfile[]> {
  const { data, error } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClientProfile);
}

/**
 * Gets the specific client_profile for this auth user at a given coach's site.
 * Used on page load to restore session context in persona-chat.
 */
export async function resolveClientContext(
  userId: string,
  coachId: string
): Promise<ClientProfile | null> {
  const { data } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('coach_id', coachId)
    .maybeSingle();
  return data ? mapClientProfile(data) : null;
}

function mapClientProfile(row: Record<string, unknown>): ClientProfile {
  return {
    clientId:     row.client_id as string,
    coachId:      row.coach_id as string,
    inviteToken:  row.invite_token as string | undefined,
    userId:       row.user_id as string | undefined,
    name:         row.name as string,
    email:        row.email as string,
    phone:        row.phone as string | undefined,
    goals:        row.goals as string ?? '',
    background:   row.background as string ?? '',
    preferences:  (row.preferences as ClientProfile['preferences']) ?? {},
    responses:    (row.responses as ClientProfile['responses']) ?? [],
  };
}
