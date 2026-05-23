"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentLink = createPaymentLink;
exports.getTransactions = getTransactions;
exports.issueRefund = issueRefund;
exports.getPaymentStatus = getPaymentStatus;
exports.getSupportedMethods = getSupportedMethods;
exports.getPaymentContext = getPaymentContext;
const agentBridge_1 = require("./agentBridge");
// Routes to the internal coaching-payment agent (port 3007).
// agentBridge resolves this ID to SKILLZ_AGENT_COACHING_PAYMENT_URL.
const ID = 'coaching-payment';
async function createPaymentLink(userId, params) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'create_payment_link', {
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        redirectUrl: params.redirectUrl,
        packageId: params.packageId,
    });
    return r.data;
}
async function getTransactions(userId, since) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'list_transactions', { since });
    return r.data?.transactions ?? [];
}
async function issueRefund(userId, externalId, options) {
    return (0, agentBridge_1.callAgentAction)(ID, userId, 'issue_refund', {
        externalId,
        provider: options?.provider ?? 'stripe',
        amountSmallestUnit: options?.amountSmallestUnit,
        reason: options?.reason,
    });
}
async function getPaymentStatus(userId, externalId, provider) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'get_payment_status', { externalId, provider });
    return r.data;
}
async function getSupportedMethods(userId, currency) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'get_supported_methods', { currency });
    return r.data;
}
async function getPaymentContext(userId) {
    return (0, agentBridge_1.callAgentContext)(ID, userId);
}
//# sourceMappingURL=paymentBridge.js.map