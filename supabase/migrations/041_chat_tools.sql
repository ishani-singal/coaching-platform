-- Chat tools: per-coach array of configurable chat behaviour tools
-- Stored as JSONB so new tools can be added without schema changes.
-- Example value:
-- [
--   { "type": "listen_first", "enabled": true, "settings": { "questionPhaseRounds": 3 } },
--   { "type": "reflective_acknowledgement", "enabled": false, "settings": {} }
-- ]

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS chat_tools JSONB DEFAULT '[]'::jsonb;
