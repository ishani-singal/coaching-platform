'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/components/SessionProvider';
import { useSearchParams } from 'next/navigation';

interface SubscriptionState {
  subscription: {
    plan_tier:         string;
    status:            string;
    paid_chat_enabled: boolean;
    current_period_end: string | null;
  } | null;
  chatSettings: {
    free_message_limit:   number;
    free_cost_limit_cents: number;
    paid_chat_price_usd:  number | null;
    stripe_price_id:      string | null;
    upsell_message:       string | null;
  } | null;
}

const PLANS = [
  {
    tier:        'starter',
    name:        'Starter',
    price:       'Free',
    description: 'Get started with persona chat and basic features.',
    features:    ['Public persona chat', 'Free message limits for prospects', 'Library RAG'],
    paidChat:    false,
  },
  {
    tier:        'pro',
    name:        'Pro',
    price:       '$49/mo',
    description: 'Unlock paid chat for your prospects and advanced features.',
    features:    ['Everything in Starter', 'Paid chat unlock for prospects', 'Chat history RAG for paid users', 'Priority support'],
    paidChat:    true,
    recommended: true,
  },
  {
    tier:        'enterprise',
    name:        'Enterprise',
    price:       '$199/mo',
    description: 'For coaches with large audiences and compliance requirements.',
    features:    ['Everything in Pro', 'Custom platform cut negotiation', 'Dedicated support', 'SLA guarantee'],
    paidChat:    true,
  },
];

export default function SubscriptionSettingsPage() {
  const { userId }     = useSession();
  const searchParams   = useSearchParams();
  const successMsg     = searchParams.get('success') === 'true';

  const [state,            setState]            = useState<SubscriptionState | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [checkoutLoading,  setCheckoutLoading]  = useState<string | null>(null);
  const [settingsSaving,   setSettingsSaving]   = useState(false);
  const [settingsMsg,      setSettingsMsg]       = useState('');

  // Chat limit form state (initialised from API)
  const [freeMessages,   setFreeMessages]   = useState('10');
  const [freeCostCents,  setFreeCostCents]  = useState('50');
  const [paidPrice,      setPaidPrice]      = useState('');
  const [upsellMessage,  setUpsellMessage]  = useState('');

  useEffect(() => {
    fetch('/api/coaches/subscription/status')
      .then(r => r.json())
      .then((d: SubscriptionState) => {
        setState(d);
        if (d.chatSettings) {
          setFreeMessages(String(d.chatSettings.free_message_limit   ?? 10));
          setFreeCostCents(String(d.chatSettings.free_cost_limit_cents ?? 50));
          setPaidPrice(d.chatSettings.paid_chat_price_usd != null
            ? String(d.chatSettings.paid_chat_price_usd) : '');
          setUpsellMessage(d.chatSettings.upsell_message ?? '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  async function handleUpgrade(tier: string) {
    setCheckoutLoading(tier);
    try {
      const res = await fetch('/api/coaches/subscription/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planTier: tier }),
      });
      const d = await res.json() as { checkoutUrl?: string; error?: string };
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
      } else {
        alert(d.error ?? 'Failed to start checkout');
      }
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/coaches/subscription/chat-settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          freeMessageLimit:   parseInt(freeMessages, 10)  || 10,
          freeCostLimitCents: parseInt(freeCostCents, 10) || 50,
          paidChatPriceUsd:   paidPrice ? parseFloat(paidPrice) : null,
          upsellMessage,
        }),
      });
      const d = await res.json() as { saved?: boolean; error?: string };
      if (d.saved) {
        setSettingsMsg('Settings saved.');
      } else {
        setSettingsMsg(d.error ?? 'Failed to save.');
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-400 animate-pulse">Loading subscription info…</div>
    );
  }

  const currentTier  = state?.subscription?.plan_tier  ?? 'starter';
  const currentStatus = state?.subscription?.status    ?? null;
  const paidChatOn   = state?.subscription?.paid_chat_enabled ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Platform Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your Skillz plan and configure paid chat for your prospects.
        </p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          Subscription activated! Paid chat is now enabled for your prospects.
        </div>
      )}

      {/* Plan selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentTier === plan.tier && currentStatus === 'active';
          const isUpgrade = currentTier === 'starter' && plan.tier !== 'starter';
          return (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.recommended
                  ? 'border-indigo-400 shadow-md'
                  : 'border-gray-200'
              } ${isCurrent ? 'bg-indigo-50' : 'bg-white'}`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide bg-indigo-600 text-white px-3 py-1 rounded-full">
                  Recommended
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-2xl font-bold text-indigo-700 mt-1 mb-2">{plan.price}</p>
              <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
              <ul className="space-y-1 text-xs text-gray-600 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="text-center text-xs font-medium text-indigo-600 bg-indigo-100 rounded-lg py-2">
                  Current plan
                </span>
              ) : plan.tier !== 'starter' ? (
                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={checkoutLoading === plan.tier}
                  className="bg-indigo-600 text-white text-sm font-medium py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === plan.tier ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </button>
              ) : (
                <span className="text-center text-xs text-gray-400">Current plan</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat limits configuration */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Prospect Chat Limits</h2>
        <p className="text-sm text-gray-500 mb-6">
          Control how much free chat your prospects get before seeing the upsell.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Free message limit
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={freeMessages}
                onChange={e => setFreeMessages(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1">Max messages before the upsell appears.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Free cost cap (cents)
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={freeCostCents}
                onChange={e => setFreeCostCents(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Estimated LLM cost cap in cents (50 = $0.50). Whichever limit hits first triggers the upsell.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paid chat price (USD)
              {!paidChatOn && (
                <span className="ml-2 text-xs font-normal text-amber-600">
                  (requires Pro or Enterprise plan)
                </span>
              )}
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={paidPrice}
              onChange={e => setPaidPrice(e.target.value)}
              disabled={!paidChatOn}
              placeholder={paidChatOn ? 'e.g. 9.99' : 'Upgrade to enable'}
              className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              One-time charge for unlimited chat with you. Leave empty to disable the paid unlock option.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom upsell message
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={upsellMessage}
              onChange={e => setUpsellMessage(e.target.value)}
              placeholder="You've used your free messages! Book a session or unlock unlimited chat to keep going."
              className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {settingsMsg && (
            <p className={`text-sm rounded-lg px-3 py-2 ${
              settingsMsg.startsWith('Settings') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {settingsMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={settingsSaving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {settingsSaving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
