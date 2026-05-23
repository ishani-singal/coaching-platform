import { callAgentAction, callAgentContext } from './agentBridge';
import { PaymentLink, CreatePaymentLinkParams } from '@coaching/sdk';

// Routes to the internal coaching-payment agent (port 3007).
// agentBridge resolves this ID to SKILLZ_AGENT_COACHING_PAYMENT_URL.
const ID = 'coaching-payment';

export async function createPaymentLink(
  userId: string,
  params: CreatePaymentLinkParams,
): Promise<PaymentLink> {
  const r = await callAgentAction(ID, userId, 'create_payment_link', {
    amount:       params.amount,
    currency:     params.currency,
    description:  params.description,
    redirectUrl:  params.redirectUrl,
    packageId:    params.packageId,
  });
  return r.data as unknown as PaymentLink;
}

export async function getTransactions(userId: string, since?: string) {
  const r = await callAgentAction(ID, userId, 'list_transactions', { since });
  return r.data?.transactions ?? [];
}

export async function issueRefund(
  userId: string,
  externalId: string,
  options?: { provider?: string; amountSmallestUnit?: number; reason?: string },
) {
  return callAgentAction(ID, userId, 'issue_refund', {
    externalId,
    provider:           options?.provider ?? 'stripe',
    amountSmallestUnit: options?.amountSmallestUnit,
    reason:             options?.reason,
  });
}

export async function getPaymentStatus(userId: string, externalId: string, provider: string) {
  const r = await callAgentAction(ID, userId, 'get_payment_status', { externalId, provider });
  return r.data;
}

export async function getSupportedMethods(userId: string, currency: string) {
  const r = await callAgentAction(ID, userId, 'get_supported_methods', { currency });
  return r.data;
}

export async function getPaymentContext(userId: string) {
  return callAgentContext(ID, userId);
}
