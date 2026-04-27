import type { NextConfig } from 'next';
import path from 'path';
import dotenv from 'dotenv';

// Load root .env so shell picks up shared env vars (single source of truth)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nextConfig: NextConfig = {
  transpilePackages: ['@coaching/sdk', '@coaching/tools', '@coaching/skills'],
  env: {
    PLATFORM_DOMAIN:          process.env.PLATFORM_DOMAIN ?? '',
    SUPABASE_URL:             process.env.SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY:        process.env.SUPABASE_ANON_KEY ?? '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    SHELL_INTERNAL_TOKEN:     process.env.SHELL_INTERNAL_TOKEN ?? '',
  },
};

export default nextConfig;
