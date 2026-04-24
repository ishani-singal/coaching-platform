import { callAgentAction, callAgentContext } from './agentBridge';
import { PaymentLink } from '@coaching/sdk';

// Stripe secret key lives inside the skillz payment agent — NOT in this repo
const ID = 'payment';

export async function createPaymentLink(userId: string, params: {
  amountUsd: number; description: string; redirectUrl?: string;
}): Promise<PaymentLink> {
  const r = await callAgentAction(ID, userId, 'create_payment_link', {
    amount_cents: Math.round(params.amountUsd * 100),
    description:  params.description,
    redirect_url: params.redirectUrl,
  });
  return r.data as PaymentLink;
}

export async function getTransactions(userId: string, since?: string) {
  const r = await callAgentAction(ID, userId, 'list_transactions', { since });
  return r.data?.transactions ?? [];
}

export async function issueRefund(userId: string, paymentIntentId: string, reason?: string) {
  return callAgentAction(ID, userId, 'refund', { paymentIntentId, reason });
}

export async function getPaymentContext(userId: string) {
  return callAgentContext(ID, userId);
}
