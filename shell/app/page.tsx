'use client';
import { useState } from 'react';
import Link from 'next/link';

type Region = 'in' | 'us';

const FEATURES = [
  'Unlimited coaching modules & programs',
  'Up to 100 client seats included',
  'Client portal & enrollment management',
  'Built-in progress tracking',
  'Program builder with timeline support',
  'Package publishing & monetisation',
  'CRM with client notes',
  'YouTube channel integration',
  'Licensing & revenue sharing',
  'Additional seats available on request',
];

// ── Deal badge ────────────────────────────────────────────────────────────────
function DealBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
      ⚡ {children}
    </span>
  );
}

// ── Check icon ────────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── India pricing ─────────────────────────────────────────────────────────────
function IndiaPricing() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

      {/* One-time */}
      <div className="relative bg-white rounded-2xl border-2 border-indigo-600 shadow-lg flex flex-col overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">One-time Payment</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold">₹86,000</span>
          </div>
          <p className="mt-1 text-indigo-200 text-sm line-through">₹90,000</p>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <DealBadge>Limited-time offer — save ₹4,000</DealBadge>
        </div>
        <div className="px-6 py-5 flex flex-col flex-1 gap-3">
          <p className="text-sm text-gray-500">Own the platform forever. One payment, no recurring fees.</p>
          <ul className="space-y-2 mt-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <Check /> {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-gray-500 italic">
              <svg className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              No free trial
            </li>
          </ul>
          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
            Includes <span className="font-semibold">100 client seats</span>. Need more? Additional seat packs available on request.
          </div>
        </div>
        <div className="px-6 pb-6">
          <Link href="/login" className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            Get started — ₹86,000
          </Link>
        </div>
      </div>

      {/* Annual */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-50 to-white px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Annual Subscription</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">₹29,000</span>
            <span className="text-gray-500 text-sm mb-1">/year</span>
          </div>
          <p className="mt-1 text-gray-400 text-sm line-through">₹32,000/year</p>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <DealBadge>Limited-time offer — save ₹3,000</DealBadge>
        </div>
        <div className="px-6 py-5 flex flex-col flex-1 gap-3">
          <p className="text-sm text-gray-500">Billed yearly. Renew or cancel anytime.</p>
          <ul className="space-y-2 mt-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <Check /> {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-gray-500 italic">
              <svg className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              No free trial
            </li>
          </ul>
          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
            Includes <span className="font-semibold">100 client seats</span>. Need more? Additional seat packs available on request.
          </div>
        </div>
        <div className="px-6 pb-6">
          <Link href="/login" className="block w-full text-center border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 rounded-xl transition-colors text-sm">
            Get started — ₹29,000/yr
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── USA pricing ───────────────────────────────────────────────────────────────
function USAPricing() {
  const monthlyFromAnnual = (970 / 12).toFixed(2); // ≈ $80.83

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

      {/* Annual — highlighted */}
      <div className="relative bg-white rounded-2xl border-2 border-indigo-600 shadow-lg flex flex-col overflow-hidden">
        <div className="absolute top-4 right-4">
          <span className="bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">Best value</span>
        </div>
        <div className="bg-indigo-600 px-6 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Annual Plan</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold">${monthlyFromAnnual}</span>
            <span className="text-indigo-200 text-sm mb-1">/mo</span>
          </div>
          <p className="mt-1 text-indigo-200 text-sm">$970 billed annually</p>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">
            ✓ Save ~8% vs monthly
          </span>
        </div>
        <div className="px-6 py-5 flex flex-col flex-1 gap-3">
          <p className="text-sm text-gray-500">Billed as $970/year. Lowest per-month rate.</p>
          <ul className="space-y-2 mt-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <Check /> {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-green-700 font-medium">
              <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              3-day free trial included
            </li>
          </ul>
          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
            Includes <span className="font-semibold">100 client seats</span>. Need more? Additional seat packs available on request.
          </div>
        </div>
        <div className="px-6 pb-6">
          <Link href="/login" className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
            Start free 3-day trial
          </Link>
        </div>
      </div>

      {/* Monthly */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-50 to-white px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Monthly Plan</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-gray-900">$88</span>
            <span className="text-gray-500 text-sm mb-1">/mo</span>
          </div>
          <p className="mt-1 text-gray-400 text-sm">Billed month-to-month</p>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-200">
            Switch to annual to save ~8%
          </span>
        </div>
        <div className="px-6 py-5 flex flex-col flex-1 gap-3">
          <p className="text-sm text-gray-500">Flexible. Cancel or upgrade anytime.</p>
          <ul className="space-y-2 mt-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <Check /> {f}
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-green-700 font-medium">
              <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              3-day free trial included
            </li>
          </ul>
          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
            Includes <span className="font-semibold">100 client seats</span>. Need more? Additional seat packs available on request.
          </div>
        </div>
        <div className="px-6 pb-6">
          <Link href="/login" className="block w-full text-center border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 rounded-xl transition-colors text-sm">
            Start free 3-day trial
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [region, setRegion] = useState<Region>('in');

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-indigo-600 text-lg tracking-tight">Skillz</span>
          <Link href="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6 text-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wider">
            Coaching platform
          </span>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
            Build, deliver & grow<br />your coaching business
          </h1>
          <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
            Everything you need to create programs, manage clients, and monetise your expertise — in one place.
          </p>
          <Link href="/login"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg">
            Get started today
          </Link>
        </div>
      </section>

      {/* Features strip */}
      <section className="py-12 px-6 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: '📚', label: 'Program builder' },
            { icon: '👥', label: 'Client management' },
            { icon: '📦', label: 'Package publishing' },
            { icon: '📊', label: 'Progress tracking' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500 mb-6">Choose your region to see relevant plans and currency.</p>

            {/* Region toggle */}
            <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setRegion('in')}
                className={
                  'px-5 py-2 rounded-lg text-sm font-semibold transition-colors ' +
                  (region === 'in'
                    ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700')
                }
              >
                🇮🇳 India (₹)
              </button>
              <button
                type="button"
                onClick={() => setRegion('us')}
                className={
                  'px-5 py-2 rounded-lg text-sm font-semibold transition-colors ' +
                  (region === 'us'
                    ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700')
                }
              >
                🇺🇸 USA ($)
              </button>
            </div>
          </div>

          {region === 'in' ? <IndiaPricing /> : <USAPricing />}

          {/* India limited-time note */}
          {region === 'in' && (
            <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-6 max-w-lg mx-auto">
              ⚡ Limited-time pricing is available for a short period. Original prices: ₹90,000 one-time · ₹32,000/year.
            </p>
          )}

          {/* USA trial note */}
          {region === 'us' && (
            <p className="text-center text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-6 max-w-lg mx-auto">
              ✓ All US plans include a 3-day free trial. No credit card charged until the trial ends.
            </p>
          )}
        </div>
      </section>

      {/* FAQ-style comparison */}
      <section className="py-16 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Everything included</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                <Check />
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 text-center bg-gradient-to-br from-indigo-950 to-purple-900">
        <h2 className="text-3xl font-bold text-white mb-3">Ready to start coaching?</h2>
        <p className="text-indigo-300 mb-8 text-sm">
          {region === 'us' ? 'Try free for 3 days, no credit card required.' : 'Get instant access after payment.'}
        </p>
        <Link href="/login"
          className="inline-block bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-lg">
          {region === 'us' ? 'Start free trial' : 'Get started'}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-6 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Skillz. All rights reserved.</p>
      </footer>
    </div>
  );
}
