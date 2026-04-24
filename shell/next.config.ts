import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@coaching/sdk', '@coaching/tools', '@coaching/skills'],
};

export default nextConfig;
