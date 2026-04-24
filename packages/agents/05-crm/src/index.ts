import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge, addNote, deleteNote, addTag, removeTag, getSessionHistory, updateClientProfile } from '@coaching/tools';
import { getClientDashboard, getCoachCRMOverview, getPipelineView } from '@coaching/skills';
import { syncBookingsToSessions } from '@coaching/skills';
import { getClientsByCoach } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_CRM_PORT ?? '3005', 10);
const AGENT_ID = 'coaching-crm';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Client CRM',
  version:         '1.0.0',
  description:     'Lightweight CRM for coaching clients: notes, tags, pipeline, session history.',
  icon:            '👥',
  domain:          ['crm', 'clients', 'coaching'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'table' },
  actions: [
    { name: 'get_client_list',   description: 'Get all clients with optional filter', params: { tag: { type: 'string', required: false, description: '' }, status: { type: 'string', required: false, description: '' } } },
    { name: 'get_client_detail', description: 'Get full client detail',              params: { clientId: { type: 'string', required: true, description: '' } } },
    { name: 'add_note',          description: 'Add note to client',                  params: { clientId: { type: 'string', required: true, description: '' }, note: { type: 'string', required: true, description: '' } } },
    { name: 'delete_note',       description: 'Delete a note',                       params: { noteId: { type: 'string', required: true, description: '' } } },
    { name: 'add_tag',           description: 'Tag a client',                        params: { clientId: { type: 'string', required: true, description: '' }, tag: { type: 'string', required: true, description: '' } } },
    { name: 'remove_tag',        description: 'Remove a tag from client',            params: { clientId: { type: 'string', required: true, description: '' }, tag: { type: 'string', required: true, description: '' } } },
    { name: 'get_pipeline',      description: 'Get CRM pipeline view',               params: {} },
    { name: 'update_client',     description: 'Update client profile',               params: { clientId: { type: 'string', required: true, description: '' }, patch: { type: 'object', required: true, description: '' } } },
    { name: 'get_sessions',      description: 'Get session history',                 params: { clientId: { type: 'string', required: false, description: '' } } },
    { name: 'sync_bookings',     description: 'Sync bookings to sessions',           params: {} },
  ],
};

async function onContext(req: ContextRequest) {
  const clients = await getClientsByCoach(req.userId);
  const { data: sessions } = await supabase
    .from('coaching_sessions')
    .select('session_id')
    .eq('coach_id', req.userId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString());

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${clients.length} client(s) · ${(sessions ?? []).length} upcoming session(s)`,
      keyEntities: clients.slice(0, 5).map(c => ({ id: c.clientId, type: 'client', label: c.name, attributes: { email: c.email } })),
      recentEvents: [],
      pendingActions: [],
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'get_client_list':
      return { success: true, message: 'Clients', data: await getCoachCRMOverview(uid) as unknown as Record<string, unknown> };

    case 'get_client_detail':
      return { success: true, message: 'Client detail', data: await getClientDashboard(uid, p.clientId as string) as unknown as Record<string, unknown> };

    case 'add_note':
      await addNote(uid, p.clientId as string, p.note as string);
      return { success: true, message: 'Note added' };

    case 'delete_note':
      await deleteNote(p.noteId as string);
      return { success: true, message: 'Note deleted' };

    case 'add_tag':
      await addTag(uid, p.clientId as string, p.tag as string);
      return { success: true, message: 'Tag added' };

    case 'remove_tag':
      await removeTag(uid, p.clientId as string, p.tag as string);
      return { success: true, message: 'Tag removed' };

    case 'get_pipeline':
      return { success: true, message: 'Pipeline', data: await getPipelineView(uid) as unknown as Record<string, unknown> };

    case 'update_client':
      await updateClientProfile(p.clientId as string, p.patch as Record<string, unknown>);
      return { success: true, message: 'Client updated' };

    case 'get_sessions':
      return { success: true, message: 'Sessions', data: { sessions: await getSessionHistory(uid, p.clientId as string | undefined) } };

    case 'sync_bookings':
      await syncBookingsToSessions(uid, uid);
      return { success: true, message: 'Bookings synced' };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
