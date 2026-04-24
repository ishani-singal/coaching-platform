import { Express, Request, Response, NextFunction } from 'express';
import { AgentManifest, ContextRequest, ActionRequest } from './types';
export declare function requireShellToken(req: Request, res: Response, next: NextFunction): void;
export declare function createAgentServer(manifest: AgentManifest, handlers: {
    context: (req: ContextRequest) => Promise<unknown>;
    action: (req: ActionRequest) => Promise<unknown>;
}): Express;
//# sourceMappingURL=server.d.ts.map