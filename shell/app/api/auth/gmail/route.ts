import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID       = process.env.GOOGLE_CLIENT_ID!;
const GMAIL_REDIRECT_URI     = process.env.GMAIL_REDIRECT_URI!;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Initiate Gmail OAuth flow
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  if (!GOOGLE_CLIENT_ID || !GMAIL_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GMAIL_REDIRECT_URI.' },
      { status: 500 }
    );
  }

  const state = `${user.id}:${crypto.randomBytes(16).toString('hex')}`;

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   900,
    path:     '/',
  });

  return response;
}
