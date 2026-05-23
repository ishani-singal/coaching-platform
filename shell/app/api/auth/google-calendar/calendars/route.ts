import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// List Google Calendars for the connected account so the coach can choose which ones block slots
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const service = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: conn, error } = await service
    .from('coach_calendar_connections')
    .select('access_token, refresh_token, token_expiry, selected_calendar_ids')
    .eq('coach_id', user.id)
    .single();

  if (error || !conn) {
    return NextResponse.json({ error: 'No Google Calendar connected' }, { status: 404 });
  }

  // Refresh access token if expired (within 60s buffer)
  let accessToken = conn.access_token as string;
  const expiry    = new Date(conn.token_expiry as string).getTime();
  if (Date.now() > expiry - 60_000) {
    const refreshed = await refreshAccessToken(conn.refresh_token as string);
    if (refreshed) {
      accessToken = refreshed.access_token;
      await service.from('coach_calendar_connections').update({
        access_token: refreshed.access_token,
        token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq('coach_id', user.id);
    }
  }

  const listRes = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch calendars from Google' }, { status: 502 });
  }

  const list = await listRes.json() as {
    items: Array<{ id: string; summary: string; primary?: boolean }>;
  };

  const calendars = (list.items ?? []).map(c => ({
    id:      c.id,
    summary: c.summary,
    primary: c.primary ?? false,
  }));

  return NextResponse.json({
    calendars,
    selectedCalendarIds: conn.selected_calendar_ids ?? [],
  });
}

// Save the selected calendar IDs to block
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as { selectedCalendarIds: string[] };
  if (!Array.isArray(body.selectedCalendarIds)) {
    return NextResponse.json({ error: 'selectedCalendarIds must be an array' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await service
    .from('coach_calendar_connections')
    .update({
      selected_calendar_ids: body.selectedCalendarIds,
      updated_at:            new Date().toISOString(),
    })
    .eq('coach_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
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
