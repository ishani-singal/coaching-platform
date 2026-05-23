import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Decrypt messages — must match spend.ts logic. Imported inline to avoid
// pulling the full persona-chat agent into the shell.
import { createDecipheriv } from 'crypto';

function decryptMessages(ciphertext: string): string {
  if (!ciphertext) return '[]';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return '[]';
  const [ivHex, tagHex, encHex] = parts;
  const hex = process.env.SUPABASE_CHAT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return '[]';
  try {
    const key     = Buffer.from(hex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[]';
  }
}

/**
 * GET /api/coaches/[slug]/account/export
 * Returns the user's decrypted chat history as a JSON download.
 * GDPR Art. 20 / CCPA data portability right.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const service = serviceClient();

  const { data: coach } = await service
    .from('user_profiles')
    .select('user_id')
    .eq('slug', slug)
    .single();

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });

  const { data: sessions } = await service
    .from('prospect_chat_sessions')
    .select('session_id, messages_encrypted, message_count, is_paid, created_at')
    .eq('coach_id', coach.user_id)
    .eq('prospect_user_id', user.id)
    .order('created_at', { ascending: false });

  const exportData = (sessions ?? []).map(s => ({
    sessionId:    s.session_id,
    messageCount: s.message_count,
    isPaid:       s.is_paid,
    startedAt:    s.created_at,
    messages:     JSON.parse(decryptMessages(s.messages_encrypted ?? '')),
  }));

  // Audit
  await service.from('chat_audit_log').insert({
    actor_id:      user.id,
    action:        'export.requested',
    resource_type: 'prospect_chat_session',
    coach_id:      coach.user_id,
    metadata:      { sessionCount: exportData.length },
  });

  const json = JSON.stringify({ exportedAt: new Date().toISOString(), coachSlug: slug, sessions: exportData }, null, 2);
  return new NextResponse(json, {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="chat-history-${slug}.json"`,
    },
  });
}
