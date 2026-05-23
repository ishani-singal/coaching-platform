'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface TimeSlot {
  startsAt: string;
  endsAt:   string;
  label:    string;
}

interface AppointmentType {
  appointmentTypeId: string;
  title:             string;
  description:       string | null;
  durationMins:      number;
  priceUsd:          number;
  currency:          string;
  maxDaysOut:        number;
  cancellationPolicy: { hours_notice: number; refund_pct: number };
  recurrence: {
    enabled:        boolean;
    frequency:      string;
    occurrences:    number;
    interval_weeks: number;
  } | null;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export default function BookTypePage() {
  const params = useParams();
  const router = useRouter();
  const slug   = params.slug as string;
  const typeId = params.typeId as string;

  const [apptType,  setApptType]  = useState<AppointmentType | null>(null);
  const [coachId,   setCoachId]   = useState('');
  const [dates,     setDates]     = useState<string[]>([]);
  const [selDate,   setSelDate]   = useState('');
  const [slots,     setSlots]     = useState<TimeSlot[]>([]);
  const [selSlot,   setSelSlot]   = useState<TimeSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [timezone,  setTimezone]  = useState('');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [booking,   setBooking]   = useState(false);
  const [error,     setError]     = useState('');

  // Load appointment type + coach ID from public API
  useEffect(() => {
    async function load() {
      // Get coach by slug via existing page meta API
      const r = await fetch(`/api/coaches/by-slug?slug=${slug}`).then(x => x.json()) as { userId?: string; error?: string };
      if (!r.userId) return;
      setCoachId(r.userId);

      const tr = await fetch(`/api/appointments/types?coachId=${r.userId}&typeId=${typeId}`).then(x => x.json()) as { type?: AppointmentType };
      if (tr.type) {
        setApptType(tr.type);
        // Build date list
        const today = new Date();
        const list: string[] = [];
        for (let i = 0; i < (tr.type.maxDaysOut ?? 60); i++) {
          list.push(formatDate(addDays(today, i)));
        }
        setDates(list);
      }
    }
    load();
    // Detect local timezone
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [slug, typeId]);

  const loadSlots = useCallback(async (date: string) => {
    if (!coachId) return;
    setSlotsLoading(true);
    setSelSlot(null);
    const r = await fetch(
      `/api/appointments/availability/slots?coachId=${coachId}&typeId=${typeId}&date=${date}&timezone=${encodeURIComponent(timezone)}`
    ).then(x => x.json()) as { slots?: TimeSlot[]; error?: string };
    setSlots(r.slots ?? []);
    setSlotsLoading(false);
  }, [coachId, typeId, timezone]);

  useEffect(() => {
    if (selDate) loadSlots(selDate);
  }, [selDate, loadSlots]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!selSlot || !apptType) return;
    setBooking(true);
    setError('');
    const r = await fetch('/api/appointments/book', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        appointmentTypeId: typeId,
        coachId,
        clientName:  name,
        clientEmail: email,
        startsAt:    selSlot.startsAt,
        timezone,
      }),
    }).then(x => x.json()) as { checkoutUrl?: string; appointmentId?: string; error?: string };

    setBooking(false);
    if (r.error) { setError(r.error); return; }
    if (r.checkoutUrl) {
      window.location.href = r.checkoutUrl;
    } else if (r.appointmentId) {
      router.push(`/coaches/${slug}/book/${typeId}/confirm?appointment_id=${r.appointmentId}`);
    }
  }

  if (!apptType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-10 px-6">
        {/* Header */}
        <div className="mb-8">
          <a href={`/coaches/${slug}/book`} className="text-sm text-indigo-600 hover:underline">← Back</a>
          <h1 className="text-2xl font-bold mt-3">{apptType.title}</h1>
          {apptType.description && <p className="text-gray-500 mt-1">{apptType.description}</p>}
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span>⏱ {apptType.durationMins} min</span>
            {apptType.recurrence?.enabled
              ? (
                <span className="text-indigo-600 font-medium">
                  🔁 {apptType.recurrence.occurrences} sessions · {apptType.recurrence.frequency}
                  {apptType.priceUsd > 0 && ` · ${apptType.currency} ${(apptType.priceUsd * apptType.recurrence.occurrences).toFixed(2)} total`}
                </span>
              )
              : apptType.priceUsd > 0
              ? <span>💳 {apptType.currency} {Number(apptType.priceUsd).toFixed(2)}</span>
              : <span className="text-green-600">🆓 Free</span>
            }
          </div>
          {apptType.cancellationPolicy.hours_notice > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Cancel up to {apptType.cancellationPolicy.hours_notice}h before for a {apptType.cancellationPolicy.refund_pct}% refund.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Date + slot picker */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Select a Date</label>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                {dates.map(d => {
                  const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <button
                      key={d}
                      onClick={() => setSelDate(d)}
                      className={`text-xs rounded-lg py-2 px-1 border transition-colors ${
                        selDate === d
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white hover:border-indigo-300 text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selDate && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Available Times</label>
                {slotsLoading ? (
                  <p className="text-sm text-gray-400">Loading slots…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-400">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {slots.map(s => (
                      <button
                        key={s.startsAt}
                        onClick={() => setSelSlot(s)}
                        className={`text-sm rounded-lg py-2 border transition-colors ${
                          selSlot?.startsAt === s.startsAt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white hover:border-indigo-300 text-gray-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recurring schedule preview */}
            {selSlot && apptType.recurrence?.enabled && (() => {
              const intervalMs = apptType.recurrence!.interval_weeks * 7 * 24 * 60 * 60 * 1000;
              const firstMs    = new Date(selSlot.startsAt).getTime();
              const sessionDates = Array.from({ length: apptType.recurrence!.occurrences }, (_, i) =>
                new Date(firstMs + i * intervalMs)
              );
              return (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-600 uppercase mb-2">Your {apptType.recurrence!.occurrences} Sessions</p>
                  <ul className="space-y-1">
                    {sessionDates.map((d, i) => (
                      <li key={i} className="text-sm text-indigo-800 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {selSlot.label}
                      </li>
                    ))}
                  </ul>
                  {apptType.priceUsd > 0 && (
                    <p className="text-xs text-indigo-500 mt-3 border-t border-indigo-100 pt-2">
                      Total charged today: <strong>{apptType.currency} {(apptType.priceUsd * apptType.recurrence!.occurrences).toFixed(2)}</strong>
                      {' '}({apptType.currency} {Number(apptType.priceUsd).toFixed(2)} × {apptType.recurrence!.occurrences} sessions)
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Booking form */}
          <div>
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Your Details</h2>

              {selSlot && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm">
                  <p className="font-medium text-indigo-800">
                    {new Date(selSlot.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-indigo-600">{selSlot.label} · {timezone}</p>
                </div>
              )}

              <form onSubmit={book} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Full Name *</label>
                  <input
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Timezone</label>
                  <input
                    title="Your timezone"
                    placeholder="e.g. America/New_York"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50"
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <button
                  type="submit"
                  disabled={!selSlot || booking}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {booking
                    ? 'Processing…'
                    : apptType.recurrence?.enabled
                    ? apptType.priceUsd > 0
                      ? `Pay ${apptType.currency} ${(apptType.priceUsd * apptType.recurrence.occurrences).toFixed(2)} & Book ${apptType.recurrence.occurrences} Sessions`
                      : `Book ${apptType.recurrence.occurrences} Sessions`
                    : apptType.priceUsd > 0
                    ? `Pay ${apptType.currency} ${Number(apptType.priceUsd).toFixed(2)} & Book`
                    : 'Confirm Booking'
                  }
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
