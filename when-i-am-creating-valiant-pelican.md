# Plan: Fix Program Storage Flow

## Context

Programs created via the "Programs" tab UI are correctly persisted to the `programs` table in Supabase. However, there is a stale table reference bug in the agent's `onContext` function that queries a non-existent table (`coaching_programs`), which was the old name before migrations renamed it to `programs`. This causes the agent's AI context to always report zero programs — even when they exist — breaking any AI-driven features that rely on context awareness.

**Answer to Q1 — Where is it storing?**  
Programs are stored in the `programs` table. Periods (e.g. Week 1, Week 2) and their module references are stored as a `periods` JSONB array within the same row — not in a separate table. The `packages` table separately references programs via its own JSONB `programs` column.

## The Bug

**File**: `packages/agents/01-program-builder/src/index.ts` — line 146

```ts
// WRONG — table doesn't exist, wrong column name
supabase.from('coaching_programs').select('program_id, title').eq('coach_id', userId),
```

Should be:
```ts
// CORRECT
supabase.from('programs').select('program_id, title').eq('creator_coach_id', userId),
```

This is inside the `onContext` `Promise.all` at line 142–147. The Supabase client silently returns `{ data: null, error: {...} }` for the missing table, so `programs` resolves to `null` and the context always shows 0 programs.

## Fix

### Step 1 — Fix `onContext` in the agent source

**File**: `packages/agents/01-program-builder/src/index.ts`  
**Line 146**: Replace the stale query:

```diff
-    supabase.from('coaching_programs').select('program_id, title').eq('coach_id', userId),
+    supabase.from('programs').select('program_id, title').eq('creator_coach_id', userId),
```

### Step 2 — Rebuild the agent dist

Run from repo root:
```bash
cd packages/agents/01-program-builder && npm run build
```

Or if using the monorepo build script:
```bash
npm run build --workspace=packages/agents/01-program-builder
```

## Verification

1. Restart the program builder agent (port 3001)
2. Open the Programs page → "Programs" tab
3. Create a new program with at least one period
4. Verify: program appears in the UI under "Your Programs"
5. In Supabase Studio → Table Editor → `programs` table: confirm the new row exists with `creator_coach_id` matching your user ID and `periods` JSONB containing the period data
6. Confirm the agent `/context` endpoint now returns the programs in `rawContext.programs`

## Critical Files

- `packages/agents/01-program-builder/src/index.ts` — **only file to edit** (line 146)
- `packages/agents/01-program-builder/dist/index.js` — rebuilt output
- `packages/tools/src/programs/programTools.ts` — `createProgram`, `listProgramsForCoach` (no change needed)
- `packages/skills/src/programBuildingSkill.ts` — `buildProgramWithPeriods` (no change needed)
