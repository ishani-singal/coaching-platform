import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge, revokeModuleLicense, getAncestryChain, getRevenueByCoach } from '@coaching/tools';
import { licenseModuleToCoach, getLicenseDashboard, sendLicenseInvitation, activateProgramLicense, getPendingLicenseByToken } from '@coaching/skills';
import { supabase } from '@coaching/sdk';

const PORT = parseInt(process.env.AGENT_LICENSING_PORT ?? '3006', 10);
const AGENT_ID = 'coaching-licensing';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const manifest: AgentManifest = {
  agentId:         AGENT_ID,
  name:            'Licensing & Revenue',
  version:         '1.0.0',
  description:     'License your modules to other coaches with per-module revenue terms and full chain attribution.',
  icon:            '💰',
  domain:          ['licensing', 'revenue', 'coaching'],
  defaultScope:    'global',
  integrationTier: 1,
  uiSpec:          { baseArchitecture: 'dashboard' },
  panelSpec: {
    layout: 'two-column',
    sections: [
      { type: 'text-summary', id: 'lic-summary', title: 'Licensing Overview',  dataKey: 'summary' },
      { type: 'table',        id: 'lic-granted',  title: 'Licenses Granted',    dataKey: 'granted',
        columns: [
          { key: 'module_title',   label: 'Module',   type: 'text' },
          { key: 'licensee_name',  label: 'Licensee', type: 'text' },
          { key: 'direct_cut_pct', label: 'Cut %',    type: 'text' },
          { key: 'expires_at',     label: 'Expires',  type: 'date' },
        ],
      },
      { type: 'table',       id: 'lic-held',     title: 'Licenses Held',       dataKey: 'held',
        columns: [
          { key: 'module_title',  label: 'Module',  type: 'text' },
          { key: 'licensor_name', label: 'From',    type: 'text' },
          { key: 'expires_at',    label: 'Expires', type: 'date' },
        ],
      },
      { type: 'action-form', id: 'lic-grant',    title: 'Grant License',       action: 'grant_license', submitLabel: 'Grant',
        fields: [
          { name: 'moduleId',         label: 'Module ID',        inputType: 'text',   required: true },
          { name: 'licenseeCoachId',  label: 'Licensee Coach ID',inputType: 'text',   required: true },
          { name: 'directCutPct',     label: 'Direct Cut %',     inputType: 'number', required: true },
          { name: 'derivativeCutPct', label: 'Derivative Cut %', inputType: 'number', required: true },
        ],
      },
    ],
  },
  actions: [
    { name: 'get_license_dashboard',    description: 'Get licensing overview',            params: {} },
    { name: 'grant_license',            description: 'Grant module license',              params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
    { name: 'send_license_invitation',  description: 'Send program license invitation by email', params: { programId: { type: 'string', required: true, description: '' }, licenseeEmail: { type: 'string', required: true, description: '' }, licenseFeeAmount: { type: 'number', required: true, description: '' }, licenseFeeCurrency: { type: 'string', required: true, description: '' } } },
    { name: 'get_pending_license',      description: 'Get pending license by invite token', params: { inviteToken: { type: 'string', required: true, description: '' } } },
    { name: 'activate_license',         description: 'Activate a pending program license',  params: { licenseId: { type: 'string', required: true, description: '' } } },
    { name: 'revoke_license',           description: 'Revoke a module license',            params: { licenseId: { type: 'string', required: true, description: '' } } },
    { name: 'get_revenue_breakdown',    description: 'Get revenue breakdown',              params: { since: { type: 'string', required: false, description: '' }, groupBy: { type: 'string', required: false, description: '' } } },
    { name: 'get_ancestry',             description: 'Get module ancestry chain',          params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'update_license_depth',     description: 'Update license propagation',        params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
  ],
};

async function onContext(req: ContextRequest) {
  const dashboard = await getLicenseDashboard(req.userId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const revenue = await getRevenueByCoach(req.userId, startOfMonth);

  // Check expiring licenses
  const { data: expiring } = await supabase
    .from('module_licenses')
    .select('license_id, module_id, expires_at')
    .eq('licensor_coach_id', req.userId)
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  return {
    snapshot: {
      agentId:   AGENT_ID,
      agentName: manifest.name,
      domain:    manifest.domain,
      summary:   `${(dashboard.granted as unknown[]).length} license(s) granted · ${(dashboard.held as unknown[]).length} held · $${revenue.totalUsd.toFixed(2)} revenue this month`,
      keyEntities: [],
      recentEvents: [],
      pendingActions: (expiring ?? []).map((l: Record<string, unknown>) => ({
        type:     'expiring_license',
        label:    `License for module ${l.module_id} expires soon`,
        dueAt:    l.expires_at as string,
        priority: 'high' as const,
      })),
      rawContext: {
        granted: (dashboard.granted as Record<string, unknown>[]).map(l => ({
          module_title:   (l.module_title as string) ?? l.module_id,
          licensee_name:  (l.licensee_name as string) ?? l.licensee_coach_id,
          direct_cut_pct: `${l.direct_cut_pct}%`,
          expires_at:     (l.expires_at as string) ?? null,
        })),
        held: (dashboard.held as Record<string, unknown>[]).map(l => ({
          module_title:  (l.module_title as string) ?? l.module_id,
          licensor_name: (l.licensor_name as string) ?? l.licensor_coach_id,
          expires_at:    (l.expires_at as string) ?? null,
        })),
      },
    },
  };
}

async function onAction(req: ActionRequest) {
  const uid = req.userId;
  const p   = req.params as Record<string, unknown>;

  switch (req.action) {
    case 'get_license_dashboard':
      return { success: true, message: 'Dashboard', data: await getLicenseDashboard(uid) as unknown as Record<string, unknown> };

    case 'grant_license':
      await licenseModuleToCoach(uid, p.licenseeCoachId as string, p.moduleId as string, {
        directCutPct:     p.directCutPct as number,
        derivativeCutPct: p.derivativeCutPct as number,
        propagateToDepth: (p.propagateToDepth as number | null) ?? null,
        canSublicense:    (p.canSublicense as boolean) ?? false,
      });
      return { success: true, message: 'License granted' };

    case 'send_license_invitation': {
      const result = await sendLicenseInvitation(uid, {
        programId:          p.programId as string,
        licenseeEmail:      p.licenseeEmail as string,
        licenseFeeAmount:   (p.licenseFeeAmount as number) ?? 0,
        licenseFeeCurrency: (p.licenseFeeCurrency as string) ?? 'USD',
      });
      return { success: true, message: 'Invitation sent', data: result as unknown as Record<string, unknown> };
    }

    case 'get_pending_license': {
      const license = await getPendingLicenseByToken(p.inviteToken as string);
      if (!license) return { success: false, message: 'Invite not found or already used' };
      return { success: true, message: 'License found', data: license };
    }

    case 'activate_license': {
      await activateProgramLicense(p.licenseId as string);
      return { success: true, message: 'License activated — program forked to your account' };
    }

    case 'revoke_license':
      await revokeModuleLicense(p.licenseId as string);
      return { success: true, message: 'License revoked' };

    case 'get_revenue_breakdown':
      return { success: true, message: 'Revenue', data: await getRevenueByCoach(uid, p.since as string | undefined) as unknown as Record<string, unknown> };

    case 'get_ancestry':
      return { success: true, message: 'Ancestry', data: { ancestry: await getAncestryChain(p.moduleId as string) } };

    case 'update_license_depth':
      await supabase.from('module_licenses').update({ propagate_to_depth: p.propagateToDepth }).eq('license_id', p.licenseId);
      return { success: true, message: 'Updated' };

    default:
      return { success: false, message: `Unknown action: ${req.action}` };
  }
}

const app = createAgentServer(manifest, { context: onContext, action: onAction });

// Multi-agent mode: export app for mounting by parent server
if (process.env.MULTI_AGENT_MODE === 'true') {
  export { app as licensingApp };
  console.log(`[${AGENT_ID}] Exported for multi-agent mode`);
} else {
  // Standalone mode: start server
  app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
}
