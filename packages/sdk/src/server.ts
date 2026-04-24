import express, { Express } from 'express';
import cors from 'cors';
import { AgentManifest, ContextRequest, ActionRequest } from './types';

export function createAgentServer(
  manifest: AgentManifest,
  handlers: {
    context: (req: ContextRequest) => Promise<unknown>;
    action:  (req: ActionRequest)  => Promise<unknown>;
  }
): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health',   (_req, res) => res.json({ status: 'ok', agentId: manifest.agentId }));
  app.get('/manifest', (_req, res) => res.json(manifest));

  app.post('/context', async (req, res) => {
    try   { res.json(await handlers.context(req.body)); }
    catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post('/action', async (req, res) => {
    try   { res.json(await handlers.action(req.body)); }
    catch (e: unknown) { res.status(500).json({ success: false, message: (e as Error).message }); }
  });

  return app;
}
