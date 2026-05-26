import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GMAIL_REDIRECT_URI   = process.env.GMAIL_REDIRECT_URI!;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const APP_URL = origin;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=invalid_response`);
  }

  // Validate CSRF state cookie
  const cookieState = req.cookies.get('gmail_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=state_mismatch`);
  }

  const [userId] = state.split(':');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=user_mismatch`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  GMAIL_REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('[gmail-callback] Token exchange failed:', await tokenRes.text());
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token?: string;
    expires_in:    number;
  };

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${APP_URL}/settings?gmail_error=no_refresh_token`);
  }

  // Get the Gmail account email
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json() as { email: string };

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const service = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await service.from('coach_gmail_connections').upsert(
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

  const response = NextResponse.redirect(`${APP_URL}/settings?gmail_connected=1`);
  response.cookies.set('gmail_oauth_state', '', { maxAge: 0, path: '/' });
  return response;
}
