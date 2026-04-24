import { createAgentServer, AgentManifest, ContextRequest, ActionRequest } from '@coaching/sdk';
import { configureBridge, revokeModuleLicense, getAncestryChain, getRevenueByCoach } from '@coaching/tools';
import { licenseModuleToCoach, getLicenseDashboard } from '@coaching/skills';
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
  actions: [
    { name: 'get_license_dashboard',  description: 'Get licensing overview',        params: {} },
    { name: 'grant_license',          description: 'Grant module license',          params: { moduleId: { type: 'string', required: true, description: '' }, licenseeCoachId: { type: 'string', required: true, description: '' }, directCutPct: { type: 'number', required: true, description: '' }, derivativeCutPct: { type: 'number', required: true, description: '' }, propagateToDepth: { type: 'number', required: false, description: '' }, canSublicense: { type: 'boolean', required: false, description: '' } } },
    { name: 'revoke_license',         description: 'Revoke a module license',      params: { licenseId: { type: 'string', required: true, description: '' } } },
    { name: 'get_revenue_breakdown',  description: 'Get revenue breakdown',         params: { since: { type: 'string', required: false, description: '' }, groupBy: { type: 'string', required: false, description: '' } } },
    { name: 'get_ancestry',           description: 'Get module ancestry chain',     params: { moduleId: { type: 'string', required: true, description: '' } } },
    { name: 'update_license_depth',   description: 'Update license propagation',   params: { licenseId: { type: 'string', required: true, description: '' }, propagateToDepth: { type: 'number', required: true, description: '' } } },
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
app.listen(PORT, () => console.log(`[${AGENT_ID}] Running on port ${PORT}`));
