import { supabase } from '@coaching/sdk';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/**
 * Build a base64url-encoded RFC 2822 MIME message for the Gmail API.
 */
function buildRawMime(from: string, to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');
  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Send an email from a coach's connected Gmail account via the Gmail REST API.
 * Uses refresh_token every time to guarantee a fresh access token.
 * If the coach has no Gmail connection, the email is skipped (logged only).
 */
export async function sendFromCoach(coachId: string, options: SendMailOptions): Promise<void> {
  const { data: conn } = await supabase
    .from('coach_gmail_connections')
    .select('google_account_email, refresh_token')
    .eq('coach_id', coachId)
    .single();

  if (!conn) {
    process.stdout.write(`[gmail] No Gmail connection for coach ${coachId} — email skipped\n`);
    return;
  }

  // Always get a fresh access token via refresh — avoids stale token 401/535 errors
  let accessToken: string;
  try {
    const refreshed = await refreshAccessToken(conn.refresh_token as string);
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from('coach_gmail_connections')
      .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
      .eq('coach_id', coachId);
  } catch (err) {
    process.stdout.write(`[gmail] Token refresh failed for coach ${coachId}: ${String(err)}\n`);
    throw err;
  }

  const from = conn.google_account_email as string;
  const raw  = buildRawMime(from, options.to, options.subject, options.html);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${body}`);
  }

  process.stdout.write(`[gmail] Email sent to ${options.to} from ${from}\n`);
}
