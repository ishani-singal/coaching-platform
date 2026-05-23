import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const service = () =>
  createServiceClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function mapRow(row: Record<string, unknown>) {
  return {
    appointmentTypeId:  row.appointment_type_id,
    coachId:            row.coach_id,
    title:              row.title,
    description:        row.description ?? null,
    durationMins:       row.duration_mins,
    bufferMins:         row.buffer_mins,
    priceUsd:           parseFloat(String(row.price_usd ?? 0)),
    currency:           row.currency,
    cancellationPolicy: row.cancellation_policy,
    minNoticeHours:     row.min_notice_hours,
    maxDaysOut:         row.max_days_out,
    isActive:           row.is_active,
    recurrence:         (row.recurrence && (row.recurrence as Record<string,unknown>).enabled === true)
                          ? row.recurrence
                          : null,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

// GET /api/appointments/types — list all appointment types for the authenticated coach
// Public variant: ?coachId=&typeId= (no auth required, returns single type or list)
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coachId');
  const typeId  = req.nextUrl.searchParams.get('typeId');

  // Public lookup by coachId (optionally filtered to a single typeId)
  if (coachId) {
    let query = service()
      .from('appointment_types')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true);

    if (typeId) {
      const { data, error } = await query.eq('appointment_type_id', typeId).single();
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ type: mapRow(data as Record<string, unknown>) });
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ types: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
  }

  // Authenticated coach — return their own types
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data, error } = await service()
    .from('appointment_types')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: (data ?? []).map(r => mapRow(r as Record<string, unknown>)) });
}

// POST /api/appointments/types — create a new appointment type
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as {
    title:              string;
    description?:       string;
    durationMins:       number;
    bufferMins?:        number;
    priceUsd?:          number;
    currency?:          string;
    cancellationPolicy?: { hours_notice: number; refund_pct: number };
    minNoticeHours?:    number;
    maxDaysOut?:        number;
    recurrence?:        { enabled: boolean; frequency: string; occurrences: number; interval_weeks: number } | null;
  };

  if (!body.title || !body.durationMins) {
    return NextResponse.json({ error: 'title and durationMins are required' }, { status: 400 });
  }

  // Validate recurrence if provided
  const rec = body.recurrence;
  if (rec?.enabled && (!rec.occurrences || rec.occurrences < 2)) {
    return NextResponse.json({ error: 'Recurring types require at least 2 occurrences' }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    coach_id:            user.id,
    title:               body.title,
    description:         body.description ?? null,
    duration_mins:       body.durationMins,
    buffer_mins:         body.bufferMins  ?? 15,
    price_usd:           body.priceUsd    ?? 0,
    currency:            body.currency    ?? 'USD',
    min_notice_hours:    body.minNoticeHours ?? 1,
    max_days_out:        body.maxDaysOut  ?? 60,
    recurrence:          rec?.enabled ? rec : null,
  };

  if (body.cancellationPolicy) {
    insert.cancellation_policy = body.cancellationPolicy;
  }

  const { data, error } = await service()
    .from('appointment_types')
    .insert(insert)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ type: mapRow(data as Record<string, unknown>) }, { status: 201 });
}

// PUT /api/appointments/types — update an existing appointment type
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json() as { appointmentTypeId: string } & Record<string, unknown>;
  const { appointmentTypeId, ...rest } = body;
  if (!appointmentTypeId) {
    return NextResponse.json({ error: 'appointmentTypeId is required' }, { status: 400 });
  }

  // Build column update map (camelCase → snake_case for allowed fields)
  const allowed: Record<string, string> = {
    title:              'title',
    description:        'description',
    durationMins:       'duration_mins',
    bufferMins:         'buffer_mins',
    priceUsd:           'price_usd',
    currency:           'currency',
    cancellationPolicy: 'cancellation_policy',
    minNoticeHours:     'min_notice_hours',
    maxDaysOut:         'max_days_out',
    isActive:           'is_active',
    recurrence:         'recurrence',
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, col] of Object.entries(allowed)) {
    if (rest[key] !== undefined) patch[col] = rest[key];
  }

  const { data, error } = await service()
    .from('appointment_types')
    .update(patch)
    .eq('appointment_type_id', appointmentTypeId)
    .eq('coach_id', user.id)      // ownership check
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found'  }, { status: 404 });
  return NextResponse.json({ type: mapRow(data as Record<string, unknown>) });
}

// DELETE /api/appointments/types?id=<appointmentTypeId>
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

  const { error } = await service()
    .from('appointment_types')
    .delete()
    .eq('appointment_type_id', id)
    .eq('coach_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
