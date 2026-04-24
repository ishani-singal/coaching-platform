import { Express } from 'express';
import { AgentManifest, ContextRequest, ActionRequest } from './types';
export declare function createAgentServer(manifest: AgentManifest, handlers: {
    context: (req: ContextRequest) => Promise<unknown>;
    action: (req: ActionRequest) => Promise<unknown>;
}): Express;
//# sourceMappingURL=server.d.ts.map