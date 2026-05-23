# Program Builder UI Redesign — Modules, Programs & Packages

## Context

The current `/programs` page is a 2654-line monolith with three tabs (Modules / Programs / Packages), each backed by large form-heavy sub-components. Coaches must click through multiple nested forms to create content. The goal is to replace this with a **split-panel, chat-first interface** that:
- Eliminates the tab structure in favor of a unified package → program → module hierarchy
- Lets coaches describe what they want in natural language and have an agent build it
- Shows real-time AG-UI events (tool call spinners + content cards) inline in the chat

## Target Layout

```
┌─────────────────────┬──────────────────────────────────────────────┐
│  Program Builder    │  Your Content                                │
│  Assistant          │                                              │
│  (chat panel, 35%)  │  📦 Premium Package    [Edit] [Publish]      │
│                     │    └ 📖 6-Week Mindset Program [Edit]        │
│ > Create a 6-week   │        ├ Week 1: Foundations [+]             │
│   mindset program   │        │   └ 🧩 Morning Mindset Reset        │
│                     │        └ Week 2: Habits [+]                  │
│  ⟳ Building program │                                              │
│  ✓ [Program card]   │  ─── Standalone Modules ───                 │
│  ✓ [Package card]   │  🧩 Nutrition 101   [Edit] [Delete]          │
│                     │                                              │
│  _______________    │                                              │
└─────────────────────┴──────────────────────────────────────────────┘
```

## Files to Create

1. `shell/app/api/agents/program-builder/chat/route.ts` — streaming SSE route; uses Claude to interpret messages, executes program-builder agent actions, emits AG-UI events
2. `shell/components/ProgramBuilderChat.tsx` — left panel chat UI with AG-UI event rendering
3. `shell/components/ContentHierarchy.tsx` — right panel expandable tree (packages → programs → periods → modules → sections)
4. `shell/components/SectionBuilder.tsx` — extracted from `programs/page.tsx` lines 362–1172

## Files to Modify

- `packages/sdk/src/types.ts` — add 5 new AG-UI event types
- `shell/app/(dashboard)/programs/page.tsx` — replace entirely with thin two-column layout wrapper (~50 lines)
- `shell/package.json` — add `"@anthropic-ai/sdk": "^0.27.0"` to dependencies

## Step-by-Step Implementation

### Step 1 — Extend AG-UI types (`packages/sdk/src/types.ts`)

Add `'REFRESH_CONTENT'` to the base `AguiEvent.type` union (line 311).

After line 327 (existing `AguiLibraryCardEvent`), add:

```typescript
export interface AguiToolCallStartEvent extends AguiEvent {
  type: 'TOOL_CALL_START';
  toolCallId: string;
  toolName: string;
  label: string;  // "Creating module..."
}

export interface AguiModuleCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'module_card';
  toolCallId: string;
  output: { moduleId: string; title: string; category: string; };
}

export interface AguiProgramCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'program_card';
  toolCallId: string;
  output: { programId: string; title: string; periodCount?: number; };
}

export interface AguiPackageCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'package_card';
  toolCallId: string;
  output: { packageId: string; title: string; pricingModel: string; isPublished: boolean; };
}

export interface AguiRefreshContentEvent extends AguiEvent {
  type: 'REFRESH_CONTENT';
}

export type ProgramBuilderAguiEvent =
  | AguiToolCallStartEvent
  | AguiModuleCardEvent
  | AguiProgramCardEvent
  | AguiPackageCardEvent
  | AguiRefreshContentEvent;
```

### Step 2 — Extract `SectionBuilder` component

Move from `programs/page.tsx` lines 362–1172 into `shell/components/SectionBuilder.tsx`:

**Exports:**
- `default SectionBuilder` component
- Types: `SectionType`, `BlockType`, `SectionBuilderProps`, `CallAction`
- Constants: `SECTION_LABELS`, `SECTION_ICONS`
- Helpers: `toEmbedUrl`, `isValidEmbedUrl`, `sectionLabel`

Keep `SaveBtn`, `AddBtn`, and all inner form components (`TextForm`, `VideoForm`, etc.) unexported (module-private). The type definitions (`SectionType`, `BlockType`, etc.) currently defined at the top of `programs/page.tsx` lines 8–85 also need to be shared — move the ones needed by `SectionBuilder` into the component file and re-import them in `programs/page.tsx` during the next step.

### Step 3 — Create `ContentHierarchy.tsx`

**Props:**
```typescript
interface ContentHierarchyProps {
  userId:     string;
  callAction: (action: string, params: Record<string, unknown>) => Promise<any>;
  refreshKey: number;  // increment triggers reload
}
```

**Data loading** (mirrors existing `loadAll` from `programs/page.tsx:306`):
```typescript
const [packages, setPackages] = useState<PackageRecord[]>([]);
const [programs, setPrograms] = useState<ProgramRecord[]>([]);
const [modules,  setModules]  = useState<ModuleRecord[]>([]);

useEffect(() => {
  Promise.all([
    callAction('list_modules',  {}),
    callAction('list_programs', {}),
    callAction('list_packages', {}),
  ]).then(([modRes, progRes, pkgRes]) => {
    if (modRes.success)  setModules(modRes.data?.modules   ?? []);
    if (progRes.success) setPrograms(progRes.data?.programs ?? []);
    if (pkgRes.success)  setPackages(pkgRes.data?.packages  ?? []);
  });
}, [callAction, refreshKey]);
```

**Tree rendering:**
- **Packages section**: each package row shows title, pricing badge, Published/Draft badge, expand chevron, Edit (inline title edit), Delete button. Expanding loads `get_package_detail` to show included programs.
- **Programs within package**: shows title, expand chevron, Edit, Delete. Expanding calls `get_program_with_periods` (reuse existing action `get_program_with_periods` that exists in the agent).
- **Periods within program**: shows label, period type chip, Rename, Delete buttons. [+] button adds an existing module via a dropdown.
- **Modules within period / standalone**: shows title, category color badge, expand chevron, Edit (inline), Delete. Expanding calls `get_module_detail` to load sections.
- **Sections within module**: list with section type icon, label, Edit (opens inline `<SectionBuilder>`), Delete.
- **Standalone Modules section**: modules whose `moduleId` does not appear in any expanded program's periods. On initial load (no programs expanded), all modules appear here. This is acceptable UX — the user can see all modules immediately.

**Inline edit**: clicking Edit on a module shows a small inline form (input + category select + Save/Cancel), same pattern as existing code at `programs/page.tsx:1196–1198`. On save: `callAction('update_module', { moduleId, title, category })`.

**Inline section edit**: clicking Edit on a section renders `<SectionBuilder editSection={section} onSave={...} callAction={callAction} compact />` directly below the section row. On save: `callAction('update_section', { moduleId, sectionId, contentType, body })`.

**Add section**: at the bottom of each expanded module, an "Add section" button renders `<SectionBuilder onSave={...} callAction={callAction} compact />`. On save: `callAction('add_section', { moduleId, order: sections.length, contentType, body })`.

### Step 4 — Create streaming chat API route

**File:** `shell/app/api/agents/program-builder/chat/route.ts`

Uses `@anthropic-ai/sdk` with `messages.create()` (non-streaming; simpler for the agentic tool-use loop).

**Wire format** (matches existing SSE conventions in the codebase):
```
data: {"type":"text","chunk":"...text..."}\n\n
data: {"type":"agui","event":{...}}\n\n
data: [DONE]\n\n
```

**Agent URL** (mirrors `shell/app/api/agents/[agentId]/action/route.ts`):
```typescript
const AGENT_URL   = `http://localhost:${process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001'}`;
const AGENT_TOKEN = process.env.SHELL_INTERNAL_TOKEN;
```

**Agentic loop** (caps at 10 iterations to prevent runaway loops):
```typescript
let loopCount = 0;
while (loopCount++ < 10) {
  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 4096,
    system:     systemPrompt,
    tools:      TOOLS,
    messages,
  });

  for (const block of response.content) {
    if (block.type === 'text') {
      emit({ type: 'text', chunk: block.text });
    } else if (block.type === 'tool_use') {
      // 1. Emit TOOL_CALL_START spinner
      emit({ type: 'agui', event: { type: 'TOOL_CALL_START', toolCallId: block.id,
        toolName: block.name, label: TOOL_LABELS[block.name] ?? `Running ${block.name}...` }});

      // 2. Proxy to agent
      const result = await fetch(`${AGENT_URL}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          ...(AGENT_TOKEN ? { Authorization: `Bearer ${AGENT_TOKEN}` } : {}) },
        body: JSON.stringify({ userId, config: {}, action: block.name, params: block.input }),
      }).then(r => r.json()).catch(e => ({ success: false, message: e.message }));

      // 3. Emit TOOL_CALL_END content card
      emit({ type: 'agui', event: buildCardEvent(block.name, block.id, block.input, result) });

      // 4. Track if refresh needed
      if (REFRESH_TOOLS.has(block.name) && result.success) needsRefresh = true;

      // 5. Append to messages for next loop
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result',
        tool_use_id: block.id, content: JSON.stringify(result) }] });
    }
  }

  if (response.stop_reason !== 'tool_use') break;
}
```

**System prompt** injects current content (fetched from agent's `/context` endpoint):
```
You are a program builder assistant. Help the coach create and manage coaching content.

CURRENT CONTENT:
Modules (N): "Title" [moduleId] (category), ...
Programs (N): "Title" [programId], ...
Packages (N): "Title" [packageId] (published/draft), ...

GUIDELINES: [categories, section body formats, etc.]
```

**Tools defined** (20 tools, full list):
`create_module`, `update_module`, `delete_module`, `add_section`, `update_section`, `delete_section`, `get_module_detail`, `build_program`, `build_program_with_periods`, `create_inline_module`, `update_program`, `delete_program`, `add_module_to_period`, `create_program_period`, `delete_program_period`, `rename_program_period`, `assemble_package`, `update_package`, `publish_package`, `unpublish_package`, `delete_package`

**`buildCardEvent`** maps tool results to typed content cards for module/program/package creations; falls back to a plain TOOL_CALL_END for other tools.

After the loop, emits `REFRESH_CONTENT` if any mutation occurred, then `[DONE]`.

### Step 5 — Create `ProgramBuilderChat.tsx`

**Props:**
```typescript
interface ProgramBuilderChatProps {
  onRefresh: () => void;
}
```

**State:**
- `messages: ChatMessage[]` — `{ id, role, content }`
- `toolCalls: Record<string, ToolCallState>` — keyed by `toolCallId`, holds `{ label, done, cardEvent? }`
- `input: string`, `streaming: boolean`

**SSE parsing** (mirrors `PersonaChatWidget.tsx` pattern):
- `type === 'text'` → append chunk to last assistant message
- `type === 'agui'` + `event.type === 'TOOL_CALL_START'` → add spinner entry to `toolCalls`
- `type === 'agui'` + `event.type === 'TOOL_CALL_END'` → mark done, attach card if it's a module/program/package card
- `type === 'agui'` + `event.type === 'REFRESH_CONTENT'` → call `onRefresh()`

**Rendering:** Messages in chat bubbles (same style as `PersonaChatWidget`). Tool call rows rendered inline after messages: spinning indicator while `!done`, content card when done with a card event, simple "✓ done" tick otherwise.

**Content card styles:**
- `module_card` → indigo-50 bg, indigo-800 title
- `program_card` → purple-50 bg, purple-800 title
- `package_card` → green-50 bg, green-800 title (+ pricing and published status)

**History** sent to API: only `{ role, content }` pairs from text messages (not tool call rows), capped at last 20 turns.

### Step 6 — Redesign `programs/page.tsx`

Replace all 2654 lines with a ~60-line layout component:

```typescript
'use client';
import { useState, useCallback } from 'react';
import { useSession } from '@/components/SessionProvider';
import ProgramBuilderChat from '@/components/ProgramBuilderChat';
import ContentHierarchy   from '@/components/ContentHierarchy';

export default function ProgramsPage() {
  const { userId }      = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  const callAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    });
    return res.json();
  }, [userId]);

  return (
    <div className="flex h-[calc(100vh-64px)] -mx-8 -my-8 overflow-hidden">
      <div className="w-[360px] shrink-0 flex flex-col border-r border-gray-100 bg-white">
        <ProgramBuilderChat onRefresh={() => setRefreshKey(k => k + 1)} />
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Content</h1>
        <ContentHierarchy userId={userId} callAction={callAction} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
```

**Layout note:** `-mx-8 -my-8` cancels the dashboard layout's `p-8` so the chat panel is full-height. The `h-[calc(100vh-64px)]` assumes a 64px top navbar — verify against the actual Navbar height.

### Step 7 — Add Anthropic SDK to shell

In `shell/package.json`, add to `dependencies`:
```json
"@anthropic-ai/sdk": "^0.27.0"
```

Then run `pnpm install` from the workspace root. The SDK is already in the pnpm store (used by `@coaching/skills`).

### Step 8 — Confirm env vars

`ANTHROPIC_API_KEY` is already in `.env.example` and used by other agents. Confirm it is set in `.env.local`. The new route reads it as `process.env.ANTHROPIC_API_KEY`.

## Reused Code / Patterns

| Pattern | Location |
|---|---|
| `callAction` fetch pattern | `programs/page.tsx:297–304` |
| SSE `data: [payload]\n\n` wire format | `packages/agents/04-persona-chat/src/index.ts:153–262` |
| SSE read loop in frontend | `shell/components/PersonaChatWidget.tsx:38–63` |
| Agent proxy URL + auth header | `shell/app/api/agents/[agentId]/action/route.ts:19–26` |
| Category color map | `programs/page.tsx` (copy into `ContentHierarchy`) |
| `SectionBuilder` + forms | `programs/page.tsx:362–1172` → extract |
| `ModuleRecord`, `ProgramRecord`, `PackageRecord`, `SectionRecord` types | `programs/page.tsx:18–62` → move to `ContentHierarchy` or a shared types file |

## Verification

1. `pnpm -C shell typecheck` — no type errors
2. Start dev server; navigate to `/programs`
   - Two-column layout renders; no tab bar visible
   - Hierarchy shows existing packages/programs/modules
3. **Chat creation flow:** Type "Create a wellness module called Morning Breathwork"
   - Spinner appears → module_card renders in chat → ContentHierarchy adds module to Standalone Modules
4. **Section add via chat:** Type "Add a video section to that module"
   - Tool spinner → success tick; expand module in hierarchy to confirm section
5. **Program build:** Type "Build a 4-week program using Morning Breathwork in week 1"
   - `build_program_with_periods` tool call, program_card in chat, hierarchy updates
6. **Package via chat:** Type "Assemble a free package called Breathwork Starter"
   - `assemble_package` tool call, package_card in chat, package appears at top of hierarchy
7. **Inline edit:** Click Edit on a module in the right panel, change title, save — hierarchy refreshes
8. **Inline section add:** Expand a module, click "Add section", create a text section — saves and renders
9. Network tab: `POST /api/agents/program-builder/chat` returns `Content-Type: text/event-stream`
