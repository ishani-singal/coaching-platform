import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side signup using the service role key so Supabase admin.createUser
// can mark the email as already confirmed — bypassing the need for SMTP /
// email-confirmation settings in the Supabase dashboard.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[signup] Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      // Surface the Supabase error (e.g. "User already registered") to the client.
      return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
    }

    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch (e: unknown) {
    console.error('[signup] Unexpected error:', e);
    return NextResponse.json({ error: (e as Error).message ?? 'Signup failed.' }, { status: 500 });
  }
}
