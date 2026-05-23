import type { NextConfig } from 'next';
import path from 'path';
import dotenv from 'dotenv';

// Load root .env so shell picks up shared env vars (single source of truth)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
  transpilePackages: ['@coaching/sdk', '@coaching/tools', '@coaching/skills'],
  env: {
    // Only PLATFORM_DOMAIN needs build-time baking (used in Edge Runtime middleware for subdomain routing).
    // Supabase/auth vars are accessed in middleware via NEXT_PUBLIC_* (already baked in Dockerfile Stage 1).
    // Server component vars (SUPABASE_SERVICE_ROLE_KEY, SHELL_INTERNAL_TOKEN) are intentionally omitted
    // here so Next.js does NOT replace them with empty strings — they are read at runtime from
    // App Service application settings.
    PLATFORM_DOMAIN: process.env.PLATFORM_DOMAIN ?? '',
  },
};

export default nextConfig;
