import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { getClientsByCoach, getCoachEnrollmentStats } from '@coaching/tools';
import {
  assignProgramToClient,
  saveClientModuleNotes,
  getClientModuleNotes,
  getAllClientNotesForModule,
  generateClientInsight,
  InsightMessage,
} from '@coaching/skills';
import { EnrollmentType } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_CLIENTS_PORT ?? '3008', 10);
const AGENT_ID = 'coaching-clients';

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Clients',
  version:         '1.0.0',
  description:     'Manage client program assignments, per-module coaching notes, and AI-powered client insights.',
  icon:            '👤',
  domain:          ['clients', 'enrollment', 'coaching'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'dashboard' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      {
        type: 'text-summary',
        id:   'cl-summary',
        title: 'Clients Overview',
        dataKey: 'summary',
      },
      {
        type: 'table',
        id:   'cl-clients',
        title: 'My Clients',
        dataKey: 'clients',
        columns: [
          { key: 'name',     label: 'Name',  type: 'text' },
          { key: 'email',    label: 'Email', type: 'text' },
        ],
      },
      {
        type: 'action-form',
        id:     'cl-assign-program',
        title:  'Assign Program to Client',
        action: 'assign_program',
        submitLabel: 'Assign',
        fields: [
          { name: 'clientId',       label: 'Client ID',       inputType: 'text',   required: true },
          { name: 'packageId',      label: 'Package ID',      inputType: 'text',   required: true },
          { name: 'enrollmentType', label: 'Enrollment Type', inputType: 'select', required: true, options: ['client', 'trainee'] },
        ],
      },
      {
        type: 'action-form',
        id:     'cl-save-notes',
        title:  'Save Module Notes for Client',
        action: 'save_module_notes',
        submitLabel: 'Save Notes',
        fields: [
          { name: 'clientId', label: 'Client ID', inputType: 'text',     required: true },
          { name: 'moduleId', label: 'Module ID', inputType: 'text',     required: true },
          { name: 'notes',    label: 'Notes',     inputType: 'textarea', required: true },
        ],
      },
      {
        type: 'action-form',
        id:     'cl-insight',
        title:  'Client AI Insight',
        action: 'client_insight',
        submitLabel: 'Ask',
        fields: [
          { name: 'clientId', label: 'Client ID',         inputType: 'text',     required: true },
          { name: 'question', label: 'Your question',     inputType: 'textarea', required: true },
          { name: 'moduleId', label: 'Module (optional)', inputType: 'text',     required: false },
        ],
      },
    ],
  },
  actions: [
    {
      name:        'list_clients',
      description: 'List all clients for this coach',
      params:      {},
    },
    {
      name:        'assign_program',
      description: 'Assign a coaching package to an existing client, creating an enrollment record',
      params: {
        clientId:       { type: 'string', required: true,  description: 'Client ID from client_profiles' },
        packageId:      { type: 'string', required: true,  description: 'Package ID to assign' },
        enrollmentType: { type: 'string', required: true,  description: 'client | trainee', enum: ['client', 'trainee'] },
      },
    },
    {
      name:        'save_module_notes',
      description: 'Save private coaching notes for a specific client on a module (visible only to this coach)',
      params: {
        clientId: { type: 'string', required: true,  description: 'Client ID' },
        moduleId: { type: 'string', required: true,  description: 'Module ID' },
        notes:    { type: 'object', required: true,  description: 'Freeform notes object, e.g. {observations, customFields}' },
      },
    },
    {
      name:        'get_module_notes',
      description: "Load this coach's private notes for a specific client+module pair",
      params: {
        clientId: { type: 'string', required: true, description: 'Client ID' },
        moduleId: { type: 'string', required: true, description: 'Module ID' },
      },
    },
    {
      name:        'get_all_notes_for_module',
      description: "Load this coach's private notes for all clients on a given module",
      params: {
        moduleId: { type: 'string', required: true, description: 'Module ID' },
      },
    },
    {
      name:        'client_insight',
      description: 'AI chatbot: ask questions about a client using their program responses and your private notes. Pass full conversation history for multi-turn.',
      params: {
        clientId: { type: 'string', required: true,  description: 'Client ID' },
        messages: { type: 'array',  required: true,  description: 'Full conversation history: [{role: "user"|"assistant", content: string}]. Last entry must be role: "user".' },
        moduleId: { type: 'string', required: false, description: 'Scope insight to a specific module (optional)' },
      },
    },
  ],
};

async function onContext(req: ContextRequest) {
  const [clients, stats] = await Promise.all([
    getClientsByCoach(req.userId),
    getCoachEnrollmentStats(req.userId),
  ]);

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${clients.length} client(s) · ${stats.activeEnrollments} active enrollment(s)`,
      keyEntities: clients.slice(0, 5).map(c => ({
        id:         c.clientId,
        type:       'client',
        label:      c.name,
        attributes: { email: c.email },
      })),
      recentEvents:   [],
      pendingActions: [],
      rawContext: {
        clients: clients.map(c => ({ clientId: c.clientId, name: c.name, email: c.email })),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {

    case 'list_clients':
      return {
        success: true,
        message: 'Clients loaded',
        data:    { clients: await getClientsByCoach(uid) },
      };

    case 'assign_program':
      return {
        success: true,
        message: 'Program assigned',
        data:    await assignProgramToClient(
          uid,
          p.clientId       as string,
          p.packageId      as string,
          p.enrollmentType as EnrollmentType
        ) as unknown as Record<string, unknown>,
      };

    case 'save_module_notes':
      return {
        success: true,
        message: 'Notes saved',
        data:    await saveClientModuleNotes(
          uid,
          p.clientId as string,
          p.moduleId as string,
          p.notes    as Record<string, unknown>
        ) as unknown as Record<string, unknown>,
      };

    case 'get_module_notes':
      return {
        success: true,
        message: 'Notes loaded',
        data:    (await getClientModuleNotes(
          uid,
          p.clientId as string,
          p.moduleId as string
        )) as unknown as Record<string, unknown>,
      };

    case 'get_all_notes_for_module':
      return {
        success: true,
        message: 'Notes loaded',
        data:    { records: await getAllClientNotesForModule(uid, p.moduleId as string) },
      };

    case 'client_insight': {
      const reply = await generateClientInsight(
        uid,
        p.clientId as string,
        {
          moduleId: p.moduleId as string | undefined,
          messages: p.messages as InsightMessage[],
        }
      );
      return { success: true, message: 'Insight generated', data: { reply } };
    }

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
