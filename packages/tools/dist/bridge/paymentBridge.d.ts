import { PaymentLink } from '@coaching/sdk';
export declare function createPaymentLink(userId: string, params: {
    amountUsd: number;
    description: string;
    redirectUrl?: string;
}): Promise<PaymentLink>;
export declare function getTransactions(userId: string, since?: string): Promise<{}>;
export declare function issueRefund(userId: string, paymentIntentId: string, reason?: string): Promise<import("@coaching/sdk").ActionResponse>;
export declare function getPaymentContext(userId: string): Promise<import("@coaching/sdk").ContextResponse>;
//# sourceMappingURL=paymentBridge.d.ts.map