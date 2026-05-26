import nodemailer from 'nodemailer';
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
 * Send an email from a coach's connected Gmail account.
 * If the coach has no Gmail connection, logs and returns without throwing.
 */
export async function sendFromCoach(coachId: string, options: SendMailOptions): Promise<void> {
  const { data: conn } = await supabase
    .from('coach_gmail_connections')
    .select('google_account_email, access_token, refresh_token, token_expiry')
    .eq('coach_id', coachId)
    .single();

  if (!conn) {
    process.stdout.write(`[gmail] No Gmail connection for coach ${coachId}, skipping email to ${options.to}\n`);
    return;
  }

  let accessToken = conn.access_token as string;
  const expiry = new Date(conn.token_expiry as string).getTime();

  // Refresh if token expires within 5 minutes
  if (Date.now() > expiry - 5 * 60 * 1000) {
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
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type:         'OAuth2',
      user:         conn.google_account_email as string,
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: conn.refresh_token as string,
      accessToken,
    },
  });

  await transporter.sendMail({
    from:    conn.google_account_email as string,
    to:      options.to,
    subject: options.subject,
    html:    options.html,
  });

  process.stdout.write(`[gmail] Email sent to ${options.to} from ${conn.google_account_email}\n`);
}
