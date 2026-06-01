import { BridgeMode, ActionRequest, ActionResponse, ContextResponse } from '@coaching/sdk';

let _mode: BridgeMode | null = null;

export function configureBridge(mode: BridgeMode): void {
  _mode = mode;
}

export async function callAgentAction(
  agentId: string,
  userId: string,
  action: string,
  params: Record<string, unknown>
): Promise<ActionResponse> {
  if (!_mode) throw new Error('Bridge not configured. Call configureBridge() at agent startup.');

  if (_mode.mode === 'http') {
    const url = resolveAgentUrl(agentId);
    const res = await fetch(`${url}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(_mode.authToken ? { Authorization: `Bearer ${_mode.authToken}` } : {}),
      },
      body: JSON.stringify({ userId, config: {}, action, params } satisfies ActionRequest),
    });
    if (!res.ok) throw new Error(`Agent ${agentId} action '${action}' failed: ${res.status}`);
    return res.json() as Promise<ActionResponse>;
  }

  if (_mode.mode === 'direct') {
    const key = `${agentId}.${action}`;
    const fn = _mode.skillMap[key];
    if (!fn) throw new Error(`No direct skill registered for ${key}`);
    const result = await fn(userId, params);
    return { success: true, message: 'ok', data: result as Record<string, unknown> };
  }

  throw new Error('Unknown bridge mode');
}

export async function callAgentContext(agentId: string, userId: string): Promise<ContextResponse> {
  if (!_mode) throw new Error('Bridge not configured.');

  if (_mode.mode === 'http') {
    const url = resolveAgentUrl(agentId);
    const res = await fetch(`${url}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {} }),
    });
    return res.json() as Promise<ContextResponse>;
  }

  if (_mode.mode === 'direct') {
    const fn = _mode.skillMap[`${agentId}.context`];
    if (!fn) throw new Error(`No direct context fn for ${agentId}`);
    return fn(userId, {}) as Promise<ContextResponse>;
  }

  throw new Error('Unknown bridge mode');
}

function resolveAgentUrl(agentId: string): string {
  // Multi-agent mode: all agents behind a single base URL with route prefixes
  if (process.env.MULTI_AGENT_MODE === 'true') {
    const baseUrl = process.env.MULTI_AGENT_BASE_URL || process.env.SKILLZ_MULTI_AGENT_URL;
    if (!baseUrl) {
      throw new Error(
        'MULTI_AGENT_MODE is enabled but no base URL configured. ' +
        'Set MULTI_AGENT_BASE_URL or SKILLZ_MULTI_AGENT_URL in .env'
      );
    }
    // Map agent IDs to their route prefixes
    const routePrefix = getAgentRoutePrefix(agentId);
    return `${baseUrl.replace(/\/$/, '')}/${routePrefix}`;
  }

  // Single-agent mode: each agent has its own URL
  const envKey = `SKILLZ_AGENT_${agentId.toUpperCase().replace(/-/g, '_')}_URL`;
  const url = process.env[envKey];
  if (url) return url;
  throw new Error(`No URL configured for agent '${agentId}'. Set ${envKey} in .env`);
}

function getAgentRoutePrefix(agentId: string): string {
  // Map agent IDs to their route prefixes (matches multi-agent-server.ts mounting)
  const prefixMap: Record<string, string> = {
    'program-builder': 'program-builder',
    'program-runner': 'program-runner',
    'coach-library': 'coach-library',
    'persona-chat': 'persona-chat',
    'crm': 'crm',
    'licensing': 'licensing',
    'payment': 'payment',
  };

  const prefix = prefixMap[agentId];
  if (!prefix) {
    throw new Error(
      `Unknown agent ID '${agentId}'. Valid IDs: ${Object.keys(prefixMap).join(', ')}`
    );
  }
  return prefix;
}
