import { PaymentLink, CreatePaymentLinkParams } from '@coaching/sdk';
export declare function createPaymentLink(userId: string, params: CreatePaymentLinkParams): Promise<PaymentLink>;
export declare function getTransactions(userId: string, since?: string): Promise<{}>;
export declare function issueRefund(userId: string, externalId: string, options?: {
    provider?: string;
    amountSmallestUnit?: number;
    reason?: string;
}): Promise<import("@coaching/sdk").ActionResponse>;
export declare function getPaymentStatus(userId: string, externalId: string, provider: string): Promise<Record<string, unknown> | undefined>;
export declare function getSupportedMethods(userId: string, currency: string): Promise<Record<string, unknown> | undefined>;
export declare function getPaymentContext(userId: string): Promise<import("@coaching/sdk").ContextResponse>;
//# sourceMappingURL=paymentBridge.d.ts.map