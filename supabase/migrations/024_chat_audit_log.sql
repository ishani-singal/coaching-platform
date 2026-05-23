-- ─────────────────────────────────────────────────────────────────────────────
-- 024: Chat Audit Log (SOC 2 / HIPAA compliance)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists chat_audit_log (
  id            uuid        primary key default gen_random_uuid(),
  actor_id      uuid,                    -- auth.users.id if authenticated, else null
  action        text        not null,    -- e.g. 'session.create', 'session.access', 'chat.send', 'chat.limit_reached', 'session.delete', 'payment.unlock', 'rag.index', 'account.signup', 'account.delete', 'export.requested'
  resource_type text,                    -- 'prospect_chat_session', 'coach_chat_settings', etc.
  resource_id   uuid,
  ip_hash       text,                    -- SHA-256 of client IP — raw IP never stored (GDPR)
  coach_id      uuid,                    -- which coach's context this occurred in
  metadata      jsonb,                   -- additional context, never contains PII
  created_at    timestamptz not null default now()
);

create index if not exists idx_chat_audit_log_actor       on chat_audit_log(actor_id);
create index if not exists idx_chat_audit_log_resource    on chat_audit_log(resource_type, resource_id);
create index if not exists idx_chat_audit_log_coach       on chat_audit_log(coach_id);
create index if not exists idx_chat_audit_log_created     on chat_audit_log(created_at);

-- Audit log is append-only: no UPDATE or DELETE policies — service role only
alter table chat_audit_log enable row level security;

-- Coaches can read audit events for their own coach context
create policy "chat_audit_log_coach_read" on chat_audit_log
  for select using (auth.uid() = coach_id);

-- ── Data retention: anonymous sessions older than 30 days ─────────────────
-- Run as a scheduled Supabase Edge Function (pg_cron or supabase cron job)
-- Example cron: 0 3 * * * → DELETE FROM prospect_chat_sessions WHERE prospect_user_id IS NULL AND created_at < now() - interval '30 days';
-- Authenticated sessions are kept until user deletes or 730 days inactivity.
comment on table prospect_chat_sessions is
  'RETENTION: anonymous rows (prospect_user_id IS NULL) purged after 30 days. Authenticated rows kept 730 days from last activity or until user requests erasure.';
