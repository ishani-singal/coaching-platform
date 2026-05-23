'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/components/SessionProvider';
import { useSearchParams, useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CancellationPolicy { hours_notice: number; refund_pct: number; }
interface RecurrenceConfig {
  enabled:        boolean;
  frequency:      'weekly' | 'biweekly' | 'monthly';
  occurrences:    number;
  interval_weeks: number;
}
interface AppointmentType {
  appointmentTypeId:  string;
  title:              string;
  description:        string | null;
  durationMins:       number;
  bufferMins:         number;
  priceUsd:           number;
  currency:           string;
  cancellationPolicy: CancellationPolicy;
  minNoticeHours:     number;
  maxDaysOut:         number;
  isActive:           boolean;
  recurrence:         RecurrenceConfig | null;
}
interface AvailabilityRow { dayOfWeek: number; startTime: string; endTime: string; }
interface CalendarItem    { id: string; summary: string; primary: boolean; }
interface Appointment {
  appointment_id:        string;
  client_name:           string;
  client_email:          string;
  starts_at:             string;
  ends_at:               string;
  timezone:              string;
  status:                string;
  price_usd:             number;
  currency:              string;
  cancellation_reason:   string | null;
  refund_issued:         boolean;
  appointment_types?:    { title: string; duration_mins: number };
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TIMEZONES = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Vancouver','Europe/London','Europe/Paris','Europe/Berlin',
  'Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','UTC',
];

const STATUS_COLORS: Record<string, string> = {
  confirmed:       'bg-green-100 text-green-700',
  pending_payment: 'bg-yellow-100 text-yellow-700',
  cancelled:       'bg-red-100 text-red-700',
  completed:       'bg-gray-100 text-gray-600',
  expired:         'bg-gray-100 text-gray-400',
};

// ── Booking Dashboard ─────────────────────────────────────────────────────────
export default function BookingPage() {
  const { userId } = useSession();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'types');

  function switchTab(t: string) {
    setTab(t);
    router.replace(`/booking?tab=${t}`, { scroll: false });
  }

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  // Legacy state — kept for backward compat but not rendered in the new UI
  const [_form, _setForm] = useState({ title: '', durationMins: 60, description: '', priceUsd: 0 });
  const [_pages, _setPages] = useState<{ bookingPageUrl: string; embedUrl: string; eventTypeId: string }[]>([]);
  const [_payForm, _setPayForm] = useState({ amountUsd: 0, description: '' });
  const [_payLink, _setPayLink] = useState('');
  const [_status, _setStatus] = useState('');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Booking</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b">
        {[
          { id: 'types',        label: 'Appointment Types' },
          { id: 'availability', label: 'Availability' },
          { id: 'calendar',     label: 'Google Calendar' },
          { id: 'bookings',     label: 'Bookings' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'types'        && <AppointmentTypesTab userId={userId} />}
      {tab === 'availability' && <AvailabilityTab     userId={userId} />}
      {tab === 'calendar'     && <CalendarTab         />}
      {tab === 'bookings'     && <BookingsTab         userId={userId} />}
    </div>
  );
}

// ── Tab: Appointment Types ────────────────────────────────────────────────────
function AppointmentTypesTab({ userId: _userId }: { userId: string }) {
  const [types,    setTypes]    = useState<AppointmentType[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<AppointmentType | null>(null);
  const [status,   setStatus]   = useState('');

  const emptyForm = {
    title: '', description: '', durationMins: 60, bufferMins: 15,
    priceUsd: 0, currency: 'USD',
    cancellationPolicy: { hours_notice: 24, refund_pct: 100 },
    minNoticeHours: 1, maxDaysOut: 60,
    recurrenceEnabled: false,
    recurrenceFrequency: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
    recurrenceOccurrences: 4,
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/appointments/types').then(x => x.json()) as { types: AppointmentType[] };
    setTypes(r.types ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(t: AppointmentType) {
    setEditing(t);
    setForm({
      title:               t.title,
      description:         t.description ?? '',
      durationMins:        t.durationMins,
      bufferMins:          t.bufferMins,
      priceUsd:            t.priceUsd,
      currency:            t.currency,
      cancellationPolicy:  t.cancellationPolicy,
      minNoticeHours:      t.minNoticeHours,
      maxDaysOut:          t.maxDaysOut,
      recurrenceEnabled:       t.recurrence?.enabled ?? false,
      recurrenceFrequency:     (t.recurrence?.frequency ?? 'weekly') as 'weekly' | 'biweekly' | 'monthly',
      recurrenceOccurrences:   t.recurrence?.occurrences ?? 4,
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    const freqToWeeks: Record<string, number> = { weekly: 1, biweekly: 2, monthly: 4 };
    const recurrence = form.recurrenceEnabled
      ? {
          enabled:        true,
          frequency:      form.recurrenceFrequency,
          occurrences:    form.recurrenceOccurrences,
          interval_weeks: freqToWeeks[form.recurrenceFrequency] ?? 1,
        }
      : null;
    const method = editing ? 'PUT' : 'POST';
    const body   = editing
      ? { appointmentTypeId: editing.appointmentTypeId, ...form, recurrence }
      : { ...form, recurrence };
    const r = await fetch('/api/appointments/types', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(x => x.json()) as { type?: AppointmentType; error?: string };
    if (r.error) { setStatus(`✗ ${r.error}`); return; }
    setStatus('✓ Saved');
    setShowForm(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this appointment type?')) return;
    await fetch(`/api/appointments/types?id=${id}`, { method: 'DELETE' });
    await load();
  }

  async function toggle(t: AppointmentType) {
    await fetch('/api/appointments/types', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentTypeId: t.appointmentTypeId, isActive: !t.isActive }),
    });
    await load();
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6">
      {status && <div className={`text-sm px-4 py-2 rounded ${status.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{status}</div>}

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Define the types of sessions clients can book with you.</p>
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-indigo-700">+ New Type</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? 'Edit' : 'New'} Appointment Type</h3>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Title *</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Discovery Call" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Description</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What clients can expect…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Duration (min) *</label>
                <input required type="number" min={5} title="Duration (minutes)" placeholder="60" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.durationMins} onChange={e => setForm(f => ({ ...f, durationMins: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Buffer Between Meetings (min)</label>
                <input type="number" min={0} title="Buffer between meetings (minutes)" placeholder="15" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.bufferMins} onChange={e => setForm(f => ({ ...f, bufferMins: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Price (0 = free)</label>
                <div className="flex gap-2">
                  <input type="number" min={0} step={0.01} title="Price" placeholder="0.00" className="flex-1 border rounded-lg px-3 py-2 text-sm" value={form.priceUsd} onChange={e => setForm(f => ({ ...f, priceUsd: +e.target.value }))} />
                  <select title="Currency" className="border rounded-lg px-3 py-2 text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD','GBP','EUR','CAD','AUD','INR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Min Advance Notice (hours)</label>
                <input type="number" min={0} title="Minimum advance notice (hours)" placeholder="1" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.minNoticeHours} onChange={e => setForm(f => ({ ...f, minNoticeHours: +e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Max Days Out (booking window)</label>
                <input type="number" min={1} title="Maximum days out (booking window)" placeholder="60" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.maxDaysOut} onChange={e => setForm(f => ({ ...f, maxDaysOut: +e.target.value }))} />
              </div>
            </div>

            {/* Cancellation policy */}
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cancellation &amp; Refund Policy</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notice Required (hours)</label>
                  <input type="number" min={0} title="Cancellation notice required (hours)" placeholder="24" className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.cancellationPolicy.hours_notice} onChange={e => setForm(f => ({ ...f, cancellationPolicy: { ...f.cancellationPolicy, hours_notice: +e.target.value } }))} />
                </div>

            {/* Recurrence */}
            <div className="border rounded-xl p-4 bg-indigo-50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Recurring Sessions</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.recurrenceEnabled}
                    onChange={e => setForm(f => ({ ...f, recurrenceEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm text-indigo-700 font-medium">Enable recurring</span>
                </label>
              </div>
              {form.recurrenceEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Frequency</label>
                    <select
                      title="Recurrence frequency"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={form.recurrenceFrequency}
                      onChange={e => setForm(f => ({ ...f, recurrenceFrequency: e.target.value as 'weekly' | 'biweekly' | 'monthly' }))}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly (every 4 weeks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Total Sessions</label>
                    <input
                      type="number"
                      min={2}
                      max={52}
                      title="Total number of sessions"
                      placeholder="4"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={form.recurrenceOccurrences}
                      onChange={e => setForm(f => ({ ...f, recurrenceOccurrences: +e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 text-xs text-indigo-500 bg-white rounded-lg px-3 py-2 border border-indigo-100">
                    Clients will book {form.recurrenceOccurrences} sessions upfront and pay{' '}
                    {form.priceUsd > 0
                      ? `${form.currency} ${(form.priceUsd * form.recurrenceOccurrences).toFixed(2)} total (${form.currency} ${Number(form.priceUsd).toFixed(2)} × ${form.recurrenceOccurrences})`
                      : 'nothing (free)'}
                    {' '}in a single checkout.
                  </div>
                </div>
              )}
            </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Refund % (if cancelled in time)</label>
                  <input type="number" min={0} max={100} title="Refund percentage (0–100)" placeholder="100" className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.cancellationPolicy.refund_pct} onChange={e => setForm(f => ({ ...f, cancellationPolicy: { ...f.cancellationPolicy, refund_pct: +e.target.value } }))} />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                e.g. &quot;24 hours notice → 100% refund&quot; means clients get a full refund if they cancel at least 24h before the session.
              </p>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-indigo-700">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {types.length === 0 && !showForm && (
        <div className="text-center text-gray-400 py-12 border rounded-xl">
          No appointment types yet. Create your first one above.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {types.map(t => (
          <div key={t.appointmentTypeId} className={`border rounded-xl p-5 bg-white shadow-sm flex flex-col gap-3 ${!t.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex gap-4">
                <span>⏱ {t.durationMins} min</span>
                {t.bufferMins > 0 && <span>+ {t.bufferMins} min buffer</span>}
              </div>
              {t.recurrence?.enabled && (
                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded px-2 py-0.5 inline-block">
                  🔁 {t.recurrence.occurrences}× {t.recurrence.frequency}
                  {t.priceUsd > 0 && ` · ${t.currency} ${(t.priceUsd * t.recurrence.occurrences).toFixed(2)} total`}
                </div>
              )}
              <div>
                {t.priceUsd > 0 ? `💰 ${t.currency} ${t.priceUsd.toFixed(2)}${t.recurrence?.enabled ? '/session' : ''}` : '🆓 Free'}
              </div>
              <div className="text-xs text-gray-400">
                Cancel: {t.cancellationPolicy.hours_notice}h notice → {t.cancellationPolicy.refund_pct}% refund
              </div>
            </div>
            <div className="flex gap-2 mt-auto pt-2 border-t flex-wrap">
              <button onClick={() => openEdit(t)} className="text-xs border rounded px-3 py-1 hover:bg-gray-50">Edit</button>
              <button onClick={() => toggle(t)} className="text-xs border rounded px-3 py-1 hover:bg-gray-50">{t.isActive ? 'Deactivate' : 'Activate'}</button>
              <button onClick={() => remove(t.appointmentTypeId)} className="text-xs border border-red-200 text-red-600 rounded px-3 py-1 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Availability ─────────────────────────────────────────────────────────
function AvailabilityTab({ userId: _userId }: { userId: string }) {
  const [timezone,  setTimezone]  = useState('America/New_York');
  const [schedule,  setSchedule]  = useState<AvailabilityRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [status,    setStatus]    = useState('');

  const defaultHours = { startTime: '09:00', endTime: '17:00' };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/appointments/availability/schedule').then(x => x.json()) as { schedule: AvailabilityRow[] };
    if (r.schedule?.length > 0) {
      setSchedule(r.schedule);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function isDayEnabled(dow: number) {
    return schedule.some(s => s.dayOfWeek === dow);
  }

  function toggleDay(dow: number) {
    if (isDayEnabled(dow)) {
      setSchedule(s => s.filter(r => r.dayOfWeek !== dow));
    } else {
      setSchedule(s => [...s, { dayOfWeek: dow, ...defaultHours }]);
    }
  }

  function updateRow(dow: number, field: 'startTime' | 'endTime', value: string) {
    setSchedule(s => s.map(r => r.dayOfWeek === dow ? { ...r, [field]: value } : r));
  }

  async function saveSched() {
    setSaving(true);
    setStatus('');
    const r = await fetch('/api/appointments/availability/schedule', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ timezone, schedule }),
    }).then(x => x.json()) as { error?: string };
    setSaving(false);
    setStatus(r.error ? `✗ ${r.error}` : '✓ Availability saved');
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {status && <div className={`text-sm px-4 py-2 rounded ${status.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{status}</div>}

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Timezone</label>
        <select title="Timezone" className="border rounded-lg px-3 py-2 text-sm w-64" value={timezone} onChange={e => setTimezone(e.target.value)}>
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {[1,2,3,4,5,6,0].map(dow => {
          const enabled = isDayEnabled(dow);
          const row     = schedule.find(s => s.dayOfWeek === dow);
          return (
            <div key={dow} className={`flex items-center gap-4 px-5 py-3 border-b last:border-b-0 ${!enabled ? 'bg-gray-50' : ''}`}>
              <div className="w-28 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleDay(dow)}
                  className="w-4 h-4 accent-indigo-600"
                  id={`dow-${dow}`}
                />
                <label htmlFor={`dow-${dow}`} className="text-sm font-medium cursor-pointer select-none">
                  {DAYS[dow].slice(0, 3)}
                </label>
              </div>
              {enabled && row ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" title={`${DAYS[dow]} start time`} value={row.startTime} onChange={e => updateRow(dow, 'startTime', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                  <span className="text-gray-400 text-sm">–</span>
                  <input type="time" title={`${DAYS[dow]} end time`} value={row.endTime}   onChange={e => updateRow(dow, 'endTime',   e.target.value)} className="border rounded px-2 py-1 text-sm" />
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Unavailable</span>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={saveSched} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60">
        {saving ? 'Saving…' : 'Save Availability'}
      </button>
    </div>
  );
}

// ── Tab: Google Calendar ──────────────────────────────────────────────────────
function CalendarTab() {
  interface ConnectionInfo { calendars: CalendarItem[]; selectedCalendarIds: string[]; }
  const searchParams = useSearchParams();

  const [connection,  setConnection]  = useState<ConnectionInfo | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [status,      setStatus]      = useState('');

  useEffect(() => {
    const error     = searchParams.get('error');
    const connected = searchParams.get('connected');
    if (error)     setStatus(`✗ OAuth error: ${error}`);
    if (connected) setStatus('✓ Google Calendar connected successfully');
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/auth/google-calendar/calendars').then(x => x.json()) as ConnectionInfo & { error?: string };
    if (!r.error) {
      setConnection(r);
      setSelected(r.selectedCalendarIds ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleCalendar(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function saveSelection() {
    setSaving(true);
    const r = await fetch('/api/auth/google-calendar/calendars', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ selectedCalendarIds: selected }),
    }).then(x => x.json()) as { error?: string };
    setSaving(false);
    setStatus(r.error ? `✗ ${r.error}` : '✓ Calendar selection saved');
  }

  async function disconnect() {
    if (!confirm('Disconnect Google Calendar?')) return;
    await fetch('/api/auth/google-calendar/disconnect', { method: 'POST' });
    setConnection(null);
    setSelected([]);
    setStatus('Google Calendar disconnected');
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {status && (
        <div className={`text-sm px-4 py-2 rounded ${
          status.startsWith('✓') ? 'bg-green-50 text-green-700'
          : status.startsWith('✗') ? 'bg-red-50 text-red-700'
          : 'bg-blue-50 text-blue-700'
        }`}>{status}</div>
      )}

      {!connection ? (
        <div className="bg-white border rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl">📅</div>
          <h3 className="font-semibold text-lg">Connect Google Calendar</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Connect your Google Calendar to automatically block time slots when you&apos;re busy.
          </p>
          <a href="/api/auth/google-calendar" className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700">
            Connect Google Calendar
          </a>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <p className="font-semibold text-sm text-green-800">Google Calendar connected</p>
                <p className="text-xs text-green-600">Select which calendars block your availability</p>
              </div>
            </div>
            <button onClick={disconnect} className="text-xs text-red-600 border border-red-200 rounded px-3 py-1 hover:bg-red-50">Disconnect</button>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Calendars</p>
              <p className="text-xs text-gray-400 mt-0.5">Checked calendars block slots when you have events</p>
            </div>
            {connection.calendars.map(cal => (
              <label key={cal.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.includes(cal.id)} onChange={() => toggleCalendar(cal.id)} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm flex-1">{cal.summary}</span>
                {cal.primary && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Primary</span>}
              </label>
            ))}
          </div>

          <button onClick={saveSelection} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Selection'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Bookings ─────────────────────────────────────────────────────────────
function BookingsTab({ userId }: { userId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [status,       setStatus]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== 'all' ? `?coachId=${userId}&status=${filter}` : `?coachId=${userId}`;
    const r = await fetch(`/api/appointments/cancel${params}`).then(x => x.json()) as { appointments: Appointment[] };
    setAppointments(r.appointments ?? []);
    setLoading(false);
  }, [userId, filter]);

  useEffect(() => { load(); }, [load]);

  async function cancel(id: string) {
    const reason = prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    const r = await fetch('/api/appointments/cancel', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ appointmentId: id, reason, cancelledBy: 'coach' }),
    }).then(x => x.json()) as { success: boolean; message: string };
    setStatus(r.message);
    await load();
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5">
      {status && <div className="text-sm px-4 py-2 rounded bg-blue-50 text-blue-700">{status}</div>}

      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-sm text-gray-500">Filter:</label>
        {['all', 'confirmed', 'pending_payment', 'completed', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {appointments.length === 0 && (
        <div className="text-center text-gray-400 py-12 border rounded-xl">No appointments found.</div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        {appointments.map((a, i) => {
          const title    = a.appointment_types?.title ?? 'Session';
          const starts   = new Date(a.starts_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
          const canCancel = ['confirmed', 'pending_payment'].includes(a.status);
          return (
            <div key={a.appointment_id} className={`px-5 py-4 flex items-start justify-between gap-4 ${i > 0 ? 'border-t' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{a.client_name} · {a.client_email}</p>
                <p className="text-xs text-gray-400 mt-1">{starts} · {a.timezone}</p>
                {a.price_usd > 0 && <p className="text-xs text-gray-400">{a.currency} {Number(a.price_usd).toFixed(2)}</p>}
                {a.cancellation_reason && <p className="text-xs text-red-500 mt-1">Reason: {a.cancellation_reason}</p>}
                {a.refund_issued && <p className="text-xs text-green-600 mt-0.5">Refund issued</p>}
              </div>
              {canCancel && (
                <button onClick={() => cancel(a.appointment_id)} className="text-xs text-red-600 border border-red-200 rounded px-3 py-1 hover:bg-red-50 shrink-0">
                  Cancel
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
