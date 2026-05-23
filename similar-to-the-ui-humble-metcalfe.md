# Plan: Module Tab UI Overhaul (Tiles + Add/Edit/Delete + Preview Modal)

## Context
The packages and programs tabs display items as a grid of clickable tiles with edit/delete buttons and preview modals. The modules tab currently uses a plain expandable-row list (`ModuleRow`) with no "Add Module" button and no tile-based preview. This change brings the modules tab to visual and functional parity with the other tabs.

---

## Files to Modify

| File | Change |
|---|---|
| `shell/components/ContentHierarchy.tsx` | Primary — add `ModuleTile`, `ModuleModal`, `ModulePreviewModal`; wire up state |
| `shell/app/(dashboard)/programs/page.tsx` | Add `newModuleTrigger` state + "New Module" button in the tab header |

---

## Implementation Steps

### 1. `ContentHierarchyProps` — add `newModuleTrigger`

In the `ContentHierarchyProps` interface (around line 37), add:
```ts
newModuleTrigger?: number;
```

In the `ContentHierarchy` component signature, add:
```ts
newModuleTrigger = 0
```

---

### 2. New state variables (after `previewProg` state, ~line 2050)

```ts
const [editMod,    setEditMod]    = useState<ModuleRecord | 'new' | null>(null);
const [previewMod, setPreviewMod] = useState<ModuleRecord | null>(null);
```

---

### 3. useEffect for `newModuleTrigger` (after existing trigger effects, ~line 2063)

```ts
useEffect(() => { if (newModuleTrigger > 0) setEditMod('new'); }, [newModuleTrigger]);
```

---

### 4. `ModuleTile` component (add after `ProgramTile`, ~line 376)

Grid tile matching `ProgramTile` structure:
- Outer `div` with `onClick={() => onPreview(mod)}`  
- Title on the left; category color badge + pencil edit button + × delete button on the right  
- Edit/delete buttons use `e.stopPropagation()` to prevent preview from opening  
- Category badge uses existing `catColor()` helper  

```tsx
function ModuleTile({ mod, onEdit, onDelete, onPreview }: {
  mod: ModuleRecord;
  onEdit:    (m: ModuleRecord) => void;
  onDelete:  (m: ModuleRecord) => void;
  onPreview: (m: ModuleRecord) => void;
}) {
  const col = catColor(mod.category);
  return (
    <div
      className="bg-white rounded-xl shadow hover:shadow-lg cursor-pointer transition-shadow border border-gray-100 text-sm flex flex-col"
      onClick={() => onPreview(mod)}
    >
      <div className="px-6 py-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-gray-900 leading-snug">{mod.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.bg} ${col.text}`}>
              {mod.category}
            </span>
            <button type="button" onClick={e => { e.stopPropagation(); onEdit(mod); }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
              title="Edit">&#9999;</button>
            <button type="button" onClick={e => { e.stopPropagation(); onDelete(mod); }}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Delete">&#10005;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 5. `ModuleModal` component (add near `ProgramModal`, ~line 1123)

Simple create/edit modal — title + category dropdown:
- `mod: ModuleRecord | 'new'`  
- Category is a `<select>` over `Object.keys(CATEGORY_COLORS)`  
- On save: calls `create_module` (new) or `update_module` (existing)  
- Calls `onSaved()` then `onClose()` on success  
- Portal render, Escape key + backdrop click to close  
- Reuses `inputCls`, `btnPrimary`, `btnSecondary` constants  

---

### 6. `ModulePreviewModal` component (add near `ProgramPreviewModal`, ~line 960)

Viewer + section manager in a portal modal:
- Loads sections on open via `get_module_detail`  
- Header: category badge + module title + close button  
- Sections list:
  - Each section shows type label and a short preview (reuse `sectionLabel()` helper from `SectionBuilder`)  
  - Edit section → inline `SectionBuilder`  
  - Delete section → `delete_section` call  
- "+ Add section" button at the bottom → `SectionBuilder` in add mode  
- Full scrollable modal, `max-w-2xl`, `max-h-[90vh]`  
- Section state management mirrors existing `ModuleRow` logic (can be ported directly)  

---

### 7. Update the modules tab rendering (~line 2221)

Replace current `modules.map(mod => <ModuleRow ... />)` with:

```tsx
{activeTab === 'modules' && (
  <>
    {modules.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map(mod => (
          <ModuleTile
            key={mod.moduleId}
            mod={mod}
            onEdit={m => setEditMod(m)}
            onDelete={async m => {
              if (!confirm('Delete this module? This cannot be undone.')) return;
              await callAction('delete_module', { moduleId: m.moduleId });
              setModules(prev => prev.filter(mm => mm.moduleId !== m.moduleId));
            }}
            onPreview={m => setPreviewMod(m)}
          />
        ))}
      </div>
    ) : (
      !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🧩</p>
          <p className="text-sm">No modules yet. Click &ldquo;New Module&rdquo; or use the chat to create one.</p>
        </div>
      )
    )}
  </>
)}
```

---

### 8. Wire up modal renders (~line 2095, after existing modals)

```tsx
{editMod !== null && (
  <ModuleModal
    mod={editMod}
    callAction={callAction}
    onClose={() => setEditMod(null)}
    onSaved={load}
  />
)}
{previewMod !== null && (
  <ModulePreviewModal
    mod={previewMod}
    callAction={callAction}
    onClose={() => setPreviewMod(null)}
  />
)}
```

---

### 9. `page.tsx` — "New Module" button + trigger state

Add alongside the `newProgramTrigger` state (around line 86):
```ts
const [newModuleTrigger, setNewModuleTrigger] = useState(0);
```

In the tab header (where `activeTab === 'modules'`), add a "New Module" button matching the style of "New Package" / "New Program":
```tsx
{activeTab === 'modules' && (
  <button type="button"
    onClick={() => setNewModuleTrigger(t => t + 1)}
    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
    New Module
  </button>
)}
```

Pass to `ContentHierarchy`:
```tsx
newModuleTrigger={newModuleTrigger}
```

---

## What is NOT changing

- `ModuleRow` component stays in the file (still used by `ProgramPreviewModal` indirectly; can be cleaned up later)  
- API actions (`create_module`, `update_module`, `delete_module`, `get_module_detail`, etc.) are unchanged  
- All other tabs (packages, programs) are unchanged  

---

## Verification

1. Navigate to `/dashboard/programs` → Modules tab  
2. "New Module" button visible in top-right → click → modal opens with title + category  
3. Save → module appears as a tile in the grid  
4. Tile has category badge, pencil (edit) button, × (delete) button  
5. Click pencil → `ModuleModal` opens pre-filled, save updates the tile  
6. Click × → confirm dialog → module removed from grid  
7. Click tile body → `ModulePreviewModal` opens showing sections  
8. In preview modal: add section, edit section, delete section all work  
9. Escape key and backdrop click close all modals  
10. Empty state shows "No modules yet. Click 'New Module'..." text  
