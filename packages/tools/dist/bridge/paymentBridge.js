"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentLink = createPaymentLink;
exports.getTransactions = getTransactions;
exports.issueRefund = issueRefund;
exports.getPaymentContext = getPaymentContext;
const agentBridge_1 = require("./agentBridge");
// Stripe secret key lives inside the skillz payment agent — NOT in this repo
const ID = 'payment';
async function createPaymentLink(userId, params) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'create_payment_link', {
        amount_cents: Math.round(params.amountUsd * 100),
        description: params.description,
        redirect_url: params.redirectUrl,
    });
    return r.data;
}
async function getTransactions(userId, since) {
    const r = await (0, agentBridge_1.callAgentAction)(ID, userId, 'list_transactions', { since });
    return r.data?.transactions ?? [];
}
async function issueRefund(userId, paymentIntentId, reason) {
    return (0, agentBridge_1.callAgentAction)(ID, userId, 'refund', { paymentIntentId, reason });
}
async function getPaymentContext(userId) {
    return (0, agentBridge_1.callAgentContext)(ID, userId);
}
//# sourceMappingURL=paymentBridge.js.map