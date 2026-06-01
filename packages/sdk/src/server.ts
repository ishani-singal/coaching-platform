import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AgentManifest, ContextRequest, ActionRequest } from './types';

export function requireShellToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.SHELL_INTERNAL_TOKEN;
  if (!expected) { next(); return; }
  if (req.headers['authorization'] !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  next();
}

export function createAgentServer(
  manifest: AgentManifest,
  handlers: {
    context: (req: ContextRequest) => Promise<unknown>;
    action:  (req: ActionRequest)  => Promise<unknown>;
  },
  options?: { basePath?: string }
): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }));

  const basePath = options?.basePath || '';
  const normalizePath = (p: string) => basePath + p;

  app.get(normalizePath('/health'),   (_req, res) => res.json({ status: 'ok', agentId: manifest.agentId }));
  app.get(normalizePath('/manifest'), (_req, res) => res.json(manifest));

  app.post(normalizePath('/context'), requireShellToken, async (req, res) => {
    try   { res.json(await handlers.context(req.body)); }
    catch (e: unknown) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post(normalizePath('/action'), requireShellToken, async (req, res) => {
    try   { res.json(await handlers.action(req.body)); }
    catch (e: unknown) {
      const msg = (e as Error).message ?? JSON.stringify(e);
      console.error('[agent] action error:', msg);
      res.status(500).json({ success: false, message: msg });
    }
  });

  return app;
}
