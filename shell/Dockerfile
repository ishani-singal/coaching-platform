# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./

# Copy all packages
COPY packages ./packages
COPY shell ./shell

# Install dependencies
RUN npm install -g pnpm@10.33.0
RUN pnpm install --frozen-lockfile

# Inject public env vars at build time so Next.js can bake them into the client bundle
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG PLATFORM_DOMAIN
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://bthacagrowxgbuhlbcng.supabase.co}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-REDACTED_SUPABASE_ANON_KEY}
ENV PLATFORM_DOMAIN=${PLATFORM_DOMAIN:-coaching-platform-prod-shell.azurewebsites.net}

# Inject server-side Supabase vars at build time so next.config.ts env block bakes real values
# into the Edge Runtime middleware bundle (process.env is read at compile time, not runtime).
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_URL=${SUPABASE_URL:-https://bthacagrowxgbuhlbcng.supabase.co}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-REDACTED_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-REDACTED_SUPABASE_SERVICE_ROLE_KEY}

# Build all packages (turbo builds sdk/tools/skills + shell)
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Standalone output includes all required node_modules (including workspace packages)
COPY --from=builder /app/shell/.next/standalone ./
COPY --from=builder /app/shell/.next/static ./shell/.next/static

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Server-side Supabase vars read at runtime by middleware and server components.
# Defaults baked into image so the container works even if App Service settings are missing.
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ENV SUPABASE_URL=${SUPABASE_URL:-https://bthacagrowxgbuhlbcng.supabase.co}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-REDACTED_SUPABASE_ANON_KEY}

CMD ["node", "shell/server.js"]
