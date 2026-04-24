import { BridgeMode, ActionResponse, ContextResponse } from '@coaching/sdk';
export declare function configureBridge(mode: BridgeMode): void;
export declare function callAgentAction(agentId: string, userId: string, action: string, params: Record<string, unknown>): Promise<ActionResponse>;
export declare function callAgentContext(agentId: string, userId: string): Promise<ContextResponse>;
//# sourceMappingURL=agentBridge.d.ts.map