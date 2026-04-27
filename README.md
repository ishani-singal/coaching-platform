# Coaching Platform

An AI-powered coaching platform built with a layered multi-agent architecture: **Tools → Skills → Agents → Shell**.

## Architecture

```
shell/          Next.js web app (coach-facing dashboard)
packages/
  sdk/          Shared agent SDK and base types
  tools/        Low-level integrations (Supabase, APIs, bridges)
  skills/       Reusable skill modules built on top of tools
  agents/       Specialized coaching agents
    01-program-builder/   Design and generate training programs
    02-program-runner/    Execute and track active programs
    03-coach-library/     Manage content and exercise library
    04-persona-chat/      Client-facing chat with coach persona
    05-crm/               Client relationship management
    06-licensing/         License and subscription management
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Monorepo**: pnpm workspaces + Turborepo
- **LLM**: Google Gemini 2.5 Flash
- **Auth & DB**: Supabase
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install
```

### Environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google Gemini API key |

### Run

```bash
# Build all packages
pnpm build

# Start the shell dev server
cd shell && pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

## Development

```bash
# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint
```
