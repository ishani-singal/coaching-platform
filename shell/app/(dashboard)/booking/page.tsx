'use client';
import { useState } from 'react';
import { useSession } from '@/components/SessionProvider';

export default function BookingPage() {
  const { userId } = useSession();
  const [form, setForm] = useState({ title: '', durationMins: 60, description: '', priceUsd: 0 });
  const [pages, setPages] = useState<{ bookingPageUrl: string; embedUrl: string; eventTypeId: string }[]>([]);
  const [payForm, setPayForm] = useState({ amountUsd: 0, description: '' });
  const [payLink, setPayLink] = useState('');
  const [status, setStatus] = useState('');

  async function callSkillz(agentId: string, action: string, params: Record<string, unknown>) {
    return fetch(`/api/skillz-agents/${agentId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action, params }),
    }).then(r => r.json());
  }

  async function createBookingPage(e: React.FormEvent) {
    e.preventDefault();
    const r = await callSkillz('customer-booking', 'create_booking_page', form) as { success: boolean; data: typeof pages[0] };
    if (r.success) setPages(prev => [...prev, r.data]);
    setStatus(r.success ? '✓ Booking page created' : '✗ Failed');
  }

  async function createPaymentLink(e: React.FormEvent) {
    e.preventDefault();
    const r = await callSkillz('payment', 'create_payment_link', {
      amount_cents: Math.round(payForm.amountUsd * 100),
      description: payForm.description,
    }) as { success: boolean; data: { paymentLinkUrl: string } };
    if (r.success) setPayLink(r.data?.paymentLinkUrl ?? '');
    setStatus(r.success ? '✓ Payment link created' : '✗ Failed');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Booking & Payments</h1>
      {status && <div className="mb-4 text-sm text-green-700 bg-green-50 px-4 py-2 rounded">{status}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Create Booking Page</h2>
          <form onSubmit={createBookingPage} className="space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Session title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="Duration (minutes)" value={form.durationMins} onChange={e => setForm(f => ({ ...f, durationMins: +e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <input className="w-full border rounded px-3 py-2 text-sm" type="number" step="0.01" placeholder="Price USD (0 = free)" value={form.priceUsd} onChange={e => setForm(f => ({ ...f, priceUsd: +e.target.value }))} />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Create</button>
          </form>

          {pages.length > 0 && (
            <div className="mt-4 space-y-2">
              {pages.map((p, i) => (
                <div key={i} className="border rounded p-3 text-sm">
                  <a href={p.bookingPageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open booking page →</a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Create Payment Link</h2>
          <form onSubmit={createPaymentLink} className="space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" type="number" step="0.01" placeholder="Amount USD" value={payForm.amountUsd} onChange={e => setPayForm(f => ({ ...f, amountUsd: +e.target.value }))} required />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Description" value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))} required />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm">Generate Link</button>
          </form>
          {payLink && (
            <div className="mt-3 text-sm">
              <a href={payLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">{payLink}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
