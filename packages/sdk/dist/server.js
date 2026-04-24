"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireShellToken = requireShellToken;
exports.createAgentServer = createAgentServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
function requireShellToken(req, res, next) {
    const expected = process.env.SHELL_INTERNAL_TOKEN;
    if (!expected) {
        next();
        return;
    }
    if (req.headers['authorization'] !== `Bearer ${expected}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
}
function createAgentServer(manifest, handlers) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.get('/health', (_req, res) => res.json({ status: 'ok', agentId: manifest.agentId }));
    app.get('/manifest', (_req, res) => res.json(manifest));
    app.post('/context', requireShellToken, async (req, res) => {
        try {
            res.json(await handlers.context(req.body));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/action', requireShellToken, async (req, res) => {
        try {
            res.json(await handlers.action(req.body));
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
    return app;
}
//# sourceMappingURL=server.js.map