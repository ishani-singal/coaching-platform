import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { TimeSlot } from '@coaching/sdk';

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET /api/appointments/availability/slots?coachId=&typeId=&date=YYYY-MM-DD
// Returns available time slots for a given appointment type on a given date.
// Public endpoint — no auth required.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coachId = searchParams.get('coachId');
  const typeId  = searchParams.get('typeId');
  const date    = searchParams.get('date'); // YYYY-MM-DD

  if (!coachId || !typeId || !date) {
    return NextResponse.json({ error: 'coachId, typeId, and date are required' }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const sb = service();

  // Load appointment type
  const { data: apptType, error: typeError } = await sb
    .from('appointment_types')
    .select('duration_mins, buffer_mins, min_notice_hours, max_days_out, is_active')
    .eq('appointment_type_id', typeId)
    .eq('coach_id', coachId)
    .single();

  if (typeError || !apptType) {
    return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 });
  }
  if (!apptType.is_active) {
    return NextResponse.json({ slots: [] });
  }

  // Validate date is within booking window
  const today      = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const targetDate = new Date(`${date}T00:00:00Z`);
  const diffDays   = Math.floor((targetDate.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0 || diffDays > (apptType.max_days_out as number)) {
    return NextResponse.json({ slots: [] });
  }

  // Load weekly availability for this day of week
  // targetDate day_of_week: Sunday=0 ... Saturday=6
  const dayOfWeek = targetDate.getUTCDay();
  const { data: scheduleRows } = await sb
    .from('coach_availability')
    .select('start_time, end_time, timezone')
    .eq('coach_id', coachId)
    .eq('day_of_week', dayOfWeek)
    .order('start_time');

  if (!scheduleRows || scheduleRows.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const timezone = (scheduleRows[0].timezone as string) ?? 'UTC';
  const durationMs = (apptType.duration_mins as number) * 60_000;
  const bufferMs   = (apptType.buffer_mins   as number) * 60_000;

  // Build candidate slots from each schedule window
  const candidates: Array<{ start: number; end: number }> = [];
  for (const row of scheduleRows) {
    const [sh, sm] = (row.start_time as string).split(':').map(Number);
    const [eh, em] = (row.end_time   as string).split(':').map(Number);

    const windowStart = new Date(`${date}T${pad(sh)}:${pad(sm)}:00`);
    const windowEnd   = new Date(`${date}T${pad(eh)}:${pad(em)}:00`);

    // Convert from coach's timezone to UTC offset (simplified: assume UTC for now;
    // if timezone is set, we rely on the stored HH:MM being in that timezone)
    let cursor = windowStart.getTime();
    while (cursor + durationMs <= windowEnd.getTime()) {
      candidates.push({ start: cursor, end: cursor + durationMs });
      cursor += durationMs + bufferMs;
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const dayStart = new Date(`${date}T00:00:00Z`).getTime();
  const dayEnd   = new Date(`${date}T23:59:59Z`).getTime();
  const nowMs    = Date.now();
  const minAdvanceMs = (apptType.min_notice_hours as number) * 3_600_000;

  // Load existing confirmed/pending_payment appointments for this coach on this date
  const { data: existingAppts } = await sb
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('coach_id', coachId)
    .in('status', ['confirmed', 'pending_payment'])
    .gte('starts_at', new Date(dayStart).toISOString())
    .lte('starts_at', new Date(dayEnd).toISOString());

  const busyFromAppts = (existingAppts ?? []).map(a => ({
    start: new Date(a.starts_at as string).getTime(),
    end:   new Date(a.ends_at   as string).getTime(),
  }));

  // Fetch Google Calendar busy periods if connection exists
  let busyFromGoogle: Array<{ start: number; end: number }> = [];
  const { data: calConn } = await sb
    .from('coach_calendar_connections')
    .select('access_token, refresh_token, token_expiry, selected_calendar_ids')
    .eq('coach_id', coachId)
    .maybeSingle();

  if (calConn && Array.isArray(calConn.selected_calendar_ids) && calConn.selected_calendar_ids.length > 0) {
    let accessToken = calConn.access_token as string;
    const expiry    = new Date(calConn.token_expiry as string).getTime();

    if (nowMs > expiry - 60_000) {
      const refreshed = await refreshToken(calConn.refresh_token as string);
      if (refreshed) {
        accessToken = refreshed.access_token;
        await sb.from('coach_calendar_connections').update({
          access_token: refreshed.access_token,
          token_expiry: new Date(nowMs + refreshed.expires_in * 1000).toISOString(),
          updated_at:   new Date().toISOString(),
        }).eq('coach_id', coachId);
      }
    }

    const freeBusyBody = {
      timeMin: new Date(dayStart).toISOString(),
      timeMax: new Date(dayEnd).toISOString(),
      timeZone: timezone,
      items: (calConn.selected_calendar_ids as string[]).map(id => ({ id })),
    };

    try {
      const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(freeBusyBody),
      });

      if (fbRes.ok) {
        const fb = await fbRes.json() as {
          calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
        };
        for (const cal of Object.values(fb.calendars ?? {})) {
          for (const period of cal.busy ?? []) {
            busyFromGoogle.push({
              start: new Date(period.start).getTime(),
              end:   new Date(period.end).getTime(),
            });
          }
        }
      }
    } catch {
      // Google calendar check is non-fatal — proceed without it
    }
  }

  const allBusy = [...busyFromAppts, ...busyFromGoogle];

  // Filter candidates: remove past, too-soon, and overlapping with busy
  const available: TimeSlot[] = candidates
    .filter(c => {
      if (c.start < nowMs + minAdvanceMs) return false;
      for (const b of allBusy) {
        if (c.start < b.end && c.end > b.start) return false;
      }
      return true;
    })
    .map(c => ({
      startsAt: new Date(c.start).toISOString(),
      endsAt:   new Date(c.end).toISOString(),
      label:    formatTime(new Date(c.start), timezone),
    }));

  return NextResponse.json({ slots: available, timezone });
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatTime(d: Date, _tz: string): string {
  // Format as "9:00 AM" — using UTC since our times are stored as UTC-equivalent
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

async function refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
