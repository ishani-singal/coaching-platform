"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureBridge = configureBridge;
exports.callAgentAction = callAgentAction;
exports.callAgentContext = callAgentContext;
let _mode = null;
function configureBridge(mode) {
    _mode = mode;
}
async function callAgentAction(agentId, userId, action, params) {
    if (!_mode)
        throw new Error('Bridge not configured. Call configureBridge() at agent startup.');
    if (_mode.mode === 'http') {
        const url = resolveAgentUrl(agentId);
        const res = await fetch(`${url}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(_mode.authToken ? { Authorization: `Bearer ${_mode.authToken}` } : {}),
            },
            body: JSON.stringify({ userId, config: {}, action, params }),
        });
        if (!res.ok)
            throw new Error(`Skillz agent ${agentId} action '${action}' failed: ${res.status}`);
        return res.json();
    }
    if (_mode.mode === 'direct') {
        const key = `${agentId}.${action}`;
        const fn = _mode.skillMap[key];
        if (!fn)
            throw new Error(`No direct skill registered for ${key}`);
        const result = await fn(userId, params);
        return { success: true, message: 'ok', data: result };
    }
    throw new Error('Unknown bridge mode');
}
async function callAgentContext(agentId, userId) {
    if (!_mode)
        throw new Error('Bridge not configured.');
    if (_mode.mode === 'http') {
        const url = resolveAgentUrl(agentId);
        const res = await fetch(`${url}/context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, config: {} }),
        });
        return res.json();
    }
    if (_mode.mode === 'direct') {
        const fn = _mode.skillMap[`${agentId}.context`];
        if (!fn)
            throw new Error(`No direct context fn for ${agentId}`);
        return fn(userId, {});
    }
    throw new Error('Unknown bridge mode');
}
function resolveAgentUrl(agentId) {
    const envKey = `SKILLZ_AGENT_${agentId.toUpperCase().replace(/-/g, '_')}_URL`;
    const url = process.env[envKey];
    if (url)
        return url;
    throw new Error(`No URL configured for skillz agent '${agentId}'. Set ${envKey} in .env`);
}
//# sourceMappingURL=agentBridge.js.map