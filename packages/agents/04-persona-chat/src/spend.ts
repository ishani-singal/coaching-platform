/**
 * spend.ts — Chat spend tracking, limit enforcement, and RAG for prospect chat sessions.
 *
 * Security notes:
 * - Messages are stored AES-256-GCM encrypted at rest. Decryption only in API layer.
 * - No raw IP addresses stored; callers should pass a SHA-256 hash.
 * - All DB writes go through the service-role Supabase client (server-only module).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { supabase } from '@coaching/sdk';

// ── Encryption helpers ───────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const KEY_ENV   = 'SUPABASE_CHAT_ENCRYPTION_KEY'; // 64-char hex → 32 bytes

function getEncryptionKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(`${KEY_ENV} must be a 64-character hex string (32 bytes)`);
  }
  return Buffer.from(hex, 'hex');
}

export function encryptMessages(plaintext: string): string {
  const key  = getEncryptionKey();
  const iv   = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptMessages(ciphertext: string): string {
  if (!ciphertext) return '[]';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return '[]';
  const [ivHex, tagHex, encHex] = parts;
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  try {
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[]'; // Failed decryption → return empty; log externally
  }
}

// ── Token cost pricing map (USD per 1M tokens) ───────────────────────────────
// Costs are approximate and used for limit enforcement only, not billing.

const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash':         { input: 0.10,  output: 0.40  },
  'gemini-2.0-flash-thinking': { input: 0.10,  output: 0.40  },
  'gemini-1.5-pro':           { input: 1.25,  output: 5.00  },
  'gemini-1.5-flash':         { input: 0.075, output: 0.30  },
  'claude-3-5-sonnet':        { input: 3.00,  output: 15.00 },
  'claude-3-haiku':           { input: 0.25,  output: 1.25  },
  'gpt-4o':                   { input: 5.00,  output: 15.00 },
  'gpt-4o-mini':              { input: 0.15,  output: 0.60  },
  default:                    { input: 0.50,  output: 2.00  },
};

export function estimateCostCents(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING_USD_PER_1M[modelId] ?? PRICING_USD_PER_1M.default;
  const usd = (inputTokens / 1_000_000) * pricing.input
            + (outputTokens / 1_000_000) * pricing.output;
  return Math.ceil(usd * 100); // cents, round up
}

// ── Limit check ──────────────────────────────────────────────────────────────

export type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; limitType: 'messages' | 'cost'; sessionId: string; coachSlug: string; isPaid: boolean };

export async function checkSpendLimit(
  sessionId: string,
  coachId: string,
): Promise<LimitCheckResult> {
  const [sessionResult, settingsResult] = await Promise.all([
    supabase
      .from('prospect_chat_sessions')
      .select('message_count, estimated_cost_cents, is_paid')
      .eq('session_id', sessionId)
      .single(),
    supabase
      .from('coach_chat_settings')
      .select('free_message_limit, free_cost_limit_cents')
      .eq('coach_id', coachId)
      .maybeSingle(),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    // Unknown session — allow with a warning (session may not be created yet)
    console.warn(`[spend] session ${sessionId} not found — allowing`);
    return { allowed: true };
  }

  const session  = sessionResult.data;

  // Paid sessions are always allowed
  if (session.is_paid) return { allowed: true };

  // Default limits if coach hasn't configured settings
  const limits = settingsResult.data ?? { free_message_limit: 10, free_cost_limit_cents: 50 };

  if (session.message_count >= limits.free_message_limit) {
    return { allowed: false, limitType: 'messages', sessionId, coachSlug: coachId, isPaid: false };
  }
  if (session.estimated_cost_cents >= limits.free_cost_limit_cents) {
    return { allowed: false, limitType: 'cost', sessionId, coachSlug: coachId, isPaid: false };
  }

  return { allowed: true };
}

// ── Update spend after a message exchange ────────────────────────────────────

export async function updateSessionSpend(
  sessionId: string,
  newUserMessage: string,
  assistantResponse: string,
  costCents: number,
): Promise<void> {
  // Fetch current encrypted messages
  const { data, error } = await supabase
    .from('prospect_chat_sessions')
    .select('messages_encrypted, message_count, estimated_cost_cents')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    console.error(`[spend] updateSessionSpend: session ${sessionId} not found`, error);
    return;
  }

  // Decrypt, append, re-encrypt
  const existing: Array<{ role: string; content: string; ts: number }> = JSON.parse(
    decryptMessages(data.messages_encrypted || '')
  );
  existing.push({ role: 'user',      content: newUserMessage,   ts: Date.now() });
  existing.push({ role: 'assistant', content: assistantResponse, ts: Date.now() });
  const newEncrypted = encryptMessages(JSON.stringify(existing));

  await supabase
    .from('prospect_chat_sessions')
    .update({
      messages_encrypted:   newEncrypted,
      message_count:        (data.message_count ?? 0) + 1,
      estimated_cost_cents: (data.estimated_cost_cents ?? 0) + costCents,
    })
    .eq('session_id', sessionId);
}

// ── Audit logging ────────────────────────────────────────────────────────────

export async function auditLog(
  action: string,
  opts: {
    actorId?:     string;
    resourceType?: string;
    resourceId?:  string;
    coachId?:     string;
    ipHash?:      string;
    metadata?:    Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await supabase.from('chat_audit_log').insert({
      actor_id:      opts.actorId    ?? null,
      action,
      resource_type: opts.resourceType ?? null,
      resource_id:   opts.resourceId  ? opts.resourceId as unknown : null,
      coach_id:      opts.coachId     ? opts.coachId as unknown    : null,
      ip_hash:       opts.ipHash      ?? null,
      metadata:      opts.metadata    ?? null,
    });
  } catch (e) {
    // Audit log must never throw — log to console but don't block the main flow
    console.error('[audit] failed to write audit log:', (e as Error).message);
  }
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

// ── Decrypt messages for export / RAG (API layer only) ───────────────────────

export function getDecryptedMessages(
  encryptedMessages: string,
): Array<{ role: string; content: string; ts: number }> {
  try {
    return JSON.parse(decryptMessages(encryptedMessages));
  } catch {
    return [];
  }
}
