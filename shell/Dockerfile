# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages
COPY packages ./packages
COPY shell ./shell

# Install dependencies
RUN npm install -g pnpm@10.33.0
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

# Build Next.js
WORKDIR /app/shell
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/shell/.next ./.next
COPY --from=builder /app/shell/node_modules ./node_modules
COPY --from=builder /app/shell/package.json ./
COPY --from=builder /app/shell/public ./public

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node_modules/.bin/next", "start"]
