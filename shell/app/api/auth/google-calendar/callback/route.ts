import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI!;
const APP_URL              = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

// Exchange auth code for tokens and persist the connection
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied consent
  if (error) {
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=invalid_response`);
  }

  // Validate CSRF state cookie
  const cookieState = req.cookies.get('gcal_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=state_mismatch`);
  }

  // Extract userId from state (format: "userId:randomHex")
  const [userId] = state.split(':');

  // Verify the authenticated user matches
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=user_mismatch`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('[gcal-callback] Token exchange failed:', await tokenRes.text());
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    scope:         string;
  };

  if (!tokens.refresh_token) {
    // This happens when Google doesn't return a refresh token (user already consented previously).
    // prompt=consent in the OAuth initiation should prevent this, but handle gracefully.
    return NextResponse.redirect(`${APP_URL}/booking?tab=calendar&error=no_refresh_token`);
  }

  // Get the Google account email
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { email: string };

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Upsert connection (one connection per coach)
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const serviceSupabase = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await serviceSupabase.from('coach_calendar_connections').upsert(
    {
      coach_id:             user.id,
      google_account_email: profile.email,
      access_token:         tokens.access_token,
      refresh_token:        tokens.refresh_token,
      token_expiry:         expiry,
      updated_at:           new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  );

  const response = NextResponse.redirect(`${APP_URL}/booking?tab=calendar&connected=1`);
  // Clear the CSRF cookie
  response.cookies.set('gcal_oauth_state', '', { maxAge: 0, path: '/' });
  return response;
}
