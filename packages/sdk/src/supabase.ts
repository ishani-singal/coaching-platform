import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load .env from repo root when running via ts-node (dev mode)
if (!process.env.SUPABASE_URL) {
  config({ path: path.resolve(__dirname, '../../../.env') });
}

// Provide placeholder fallbacks so createClient doesn't throw during Next.js
// static build ("Collecting page data"). At runtime the real env vars are set.
export const supabase = createClient(
  process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-key'
);

export function supabaseAsUser(jwt: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
