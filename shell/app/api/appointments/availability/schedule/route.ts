import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function mapRow(r: Record<string, unknown>) {
  return {
    availabilityId: r.availability_id,
    coachId:        r.coach_id,
    dayOfWeek:      r.day_of_week,
    startTime:      r.start_time,
    endTime:        r.end_time,
    timezone:       r.timezone,
  };
}

// GET /api/appointments/availability/schedule — get the coach's weekly schedule
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data, error } = await service()
    .from('coach_availability')
    .select('*')
    .eq('coach_id', user.id)
    .order('day_of_week')
    .order('start_time');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
}

// POST /api/appointments/availability/schedule — replace the whole weekly schedule
// Body: { timezone: string, schedule: Array<{ dayOfWeek, startTime, endTime }> }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as {
    timezone: string;
    schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  };

  if (!body.timezone || !Array.isArray(body.schedule)) {
    return NextResponse.json({ error: 'timezone and schedule array required' }, { status: 400 });
  }

  const sb = service();

  // Delete existing schedule for this coach
  await sb.from('coach_availability').delete().eq('coach_id', user.id);

  if (body.schedule.length === 0) {
    return NextResponse.json({ schedule: [] });
  }

  const rows = body.schedule.map(s => ({
    coach_id:    user.id,
    day_of_week: s.dayOfWeek,
    start_time:  s.startTime,
    end_time:    s.endTime,
    timezone:    body.timezone,
  }));

  const { data, error } = await sb
    .from('coach_availability')
    .insert(rows)
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
}
