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
    if (!res.ok) throw new Error(`Skillz agent ${agentId} action '${action}' failed: ${res.status}`);
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
  const envKey = `SKILLZ_AGENT_${agentId.toUpperCase().replace(/-/g, '_')}_URL`;
  const url = process.env[envKey];
  if (url) return url;
  throw new Error(`No URL configured for skillz agent '${agentId}'. Set ${envKey} in .env`);
}
