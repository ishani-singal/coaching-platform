'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SectionBuilder, { SectionType, SECTION_LABELS, sectionLabel } from '@/components/SectionBuilder';
import ClientPortalModule from '@/components/ClientPortalModule';
import CertificateBuilder from '@/components/CertificateBuilder';
import { createClient } from '@/lib/supabase/client';
import type { ModuleSectionSpec, CertificateTemplate } from '@coaching/sdk';

// -- Types ---------------------------------------------------------------------

interface ModuleRecord  { moduleId: string; title: string; category: string; }
interface ProgramRecord { programId: string; title: string; periodCount?: number; moduleCount?: number; coverImageUrl?: string; }
interface PackageRecord {
  packageId: string; title: string; pricingModel: string; priceUsd?: number;
  isPublished: boolean; currencies: string[];
  totalSeats?: number; showSeatsFilled?: boolean;
  applyDeadline?: string; discountPrice?: number; discountUntil?: string;
  description?: string; coverImageUrl?: string; certificateUrl?: string;
  certificateTemplate?: CertificateTemplate;
  includedProgramIds?: string[];
}
interface SectionRecord {
  sectionId: string; sectionOrder: number; contentType: SectionType; body: Record<string, unknown>;
}
interface PeriodInfo    { periodOrder: number; label: string; modules: ModuleRecord[]; }
interface ProgramDetail { periods: PeriodInfo[]; }

type CallAction = (a: string, p: Record<string, unknown>) => Promise<unknown>;

// -- Template thumbnails -------------------------------------------------------

const TEMPLATE_THUMBNAILS = [
  { id: 'indigo-purple', label: 'Indigo',   gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'pink-red',     label: 'Coral',    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'sky-cyan',     label: 'Sky',      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'emerald',      label: 'Emerald',  gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'peach',        label: 'Peach',    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'lavender',     label: 'Lavender', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'sunset',       label: 'Sunset',   gradient: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)' },
  { id: 'slate',        label: 'Slate',    gradient: 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)' },
] as const;

function isGradient(value: string | undefined): boolean {
  return !!value && value.startsWith('linear-gradient');
}

// -- CardThumbnail (shown at top of every program/package card) ----------------

function CardThumbnail({ src, title }: { src?: string; title: string }) {
  if (src && isGradient(src)) {
    return <div className="w-full h-32 rounded-t-xl" style={{ background: src }} />;
  }
  if (src) {
    return <img src={src} alt={title} className="w-full h-32 rounded-t-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
  }
  // Default placeholder
  return <div className="w-full h-32 rounded-t-xl bg-gradient-to-br from-gray-100 to-gray-200" />;
}

// -- ThumbnailPicker (template swatches + upload) ----------------------------

function ThumbnailPicker({
  value,
  onChange,
  onFileChange,
  uploading,
}: {
  value:        string;
  onChange:     (v: string) => void;
  onFileChange: (f: File) => void;
  uploading:    boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      {/* Preview */}
      {value && (
        isGradient(value)
          ? <div className="w-full h-24 rounded-xl" style={{ background: value }} />
          : <img src={value} alt="preview" className="w-full h-24 rounded-xl object-cover border border-gray-200" />
      )}
      {!value && <div className="w-full h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs text-gray-400">No thumbnail selected</div>}

      {/* Template swatches */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_THUMBNAILS.map(t => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onChange(t.gradient)}
            className={`w-10 h-10 rounded-lg border-2 transition-all ${
              value === t.gradient ? 'border-indigo-500 scale-110' : 'border-transparent hover:border-gray-300'
            }`}
            style={{ background: t.gradient }}
          />
        ))}
        {/* Clear */}
        {value && (
          <button
            type="button"
            title="Remove thumbnail"
            onClick={() => onChange('')}
            className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-300 flex items-center justify-center text-gray-400 hover:text-red-400 text-lg"
          >✕</button>
        )}
      </div>

      {/* Upload custom image */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          {uploading ? 'Uploading…' : 'Upload custom image'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" title="Upload thumbnail" onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); }} />
      </div>
    </div>
  );
}

export interface ContentHierarchyProps {
  userId:              string;
  callAction:          CallAction;
  modules:             ModuleRecord[];
  programs:            ProgramRecord[];
  packages:            PackageRecord[];
  loading:             boolean;
  onRefresh:           () => void;
  activeTab?:          'packages' | 'programs' | 'modules';
  pkgSubTab?:          'published' | 'unpublished';
  newPkgTrigger?:      number;
  newProgramTrigger?:  number;
  newModuleTrigger?:   number;
}

// -- Shared UI primitives ------------------------------------------------------

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const smallInputCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white';
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors';
const btnSecondary = 'border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';
const btnDanger = 'text-red-400 hover:text-red-600 text-xs';
const btnGhost  = 'text-indigo-500 hover:text-indigo-700 text-xs font-medium';

// -- Module row ----------------------------------------------------------------

function ModuleRow({ mod, callAction, allModules }: {
  mod: ModuleRecord; callAction: CallAction; allModules: ModuleRecord[];
}) {
  const [expanded, setExpanded]     = useState(false);
  const [sections, setSections]     = useState<SectionRecord[] | null>(null);
  const [loading, setLoading]       = useState(false);
  const [editing, setEditing]       = useState(false);
  const [editTitle, setEditTitle]   = useState(mod.title);
  const [saving, setSaving]         = useState(false);
  const [editingSec, setEditingSec] = useState<SectionRecord | null>(null);
  const [addingSection, setAddingSection] = useState(false);

  async function load() {
    if (sections) return;
    setLoading(true);
    const r = await callAction('get_module_detail', { moduleId: mod.moduleId }) as { success: boolean; data?: { sections: SectionRecord[] } };
    setLoading(false);
    if (r.success && r.data) setSections(r.data.sections);
  }

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) await load();
  }

  async function saveEdit() {
    setSaving(true);
    await callAction('update_module', { moduleId: mod.moduleId, title: editTitle.trim() });
    setSaving(false);
    setEditing(false);
  }

  async function addSection(type: SectionType, body: Record<string, unknown>) {
    const order = sections?.length ?? 0;
    const r = await callAction('add_section', { moduleId: mod.moduleId, order, contentType: type, body }) as { success: boolean; data?: SectionRecord };
    if (r.success && r.data) {
      setSections(p => [...(p ?? []), r.data!]);
      setAddingSection(false);
    }
  }

  async function updateSection(sec: SectionRecord, type: SectionType, body: Record<string, unknown>) {
    await callAction('update_section', { moduleId: mod.moduleId, sectionId: sec.sectionId, contentType: type, body });
    setSections(p => (p ?? []).map(s => s.sectionId === sec.sectionId ? { ...s, contentType: type, body } : s));
    setEditingSec(null);
  }

  async function deleteSection(sectionId: string) {
    await callAction('delete_section', { moduleId: mod.moduleId, sectionId });
    setSections(p => (p ?? []).filter(s => s.sectionId !== sectionId));
  }

  void allModules; // may be used by parent for context

  return (
    <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={toggle} className="text-gray-400 text-xs w-4 shrink-0">
          {expanded ? '▾' : '▸'}
        </button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input className={smallInputCls + ' flex-1 min-w-28 text-xs'} value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus />
            <button type="button" disabled={!editTitle.trim() || saving} onClick={saveEdit} className={btnPrimary}>
              {saving ? '...' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setEditTitle(mod.title); }} className={btnSecondary}>Cancel</button>
          </div>
        ) : (
          <span className="flex-1 font-medium text-sm text-gray-800 truncate">{mod.title}</span>
        )}
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setEditing(true)} className={btnGhost}>Edit</button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-3 pb-3 pt-2 space-y-1.5 bg-gray-50">
          {loading && <p className="text-xs text-gray-400">Loading sections...</p>}
          {sections?.map(sec => (
            <div key={sec.sectionId}>
              {editingSec?.sectionId === sec.sectionId ? (
                <div className="rounded-xl border border-indigo-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-700">Editing {SECTION_LABELS[sec.contentType]}</span>
                    <button type="button" onClick={() => setEditingSec(null)} className="text-xs text-gray-400 hover:text-gray-600">x Cancel</button>
                  </div>
                  <SectionBuilder
                    editSection={editingSec}
                    onSave={async (type, body) => updateSection(sec, type, body)}
                    callAction={callAction}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-600">{SECTION_LABELS[sec.contentType]}</span>
                    <p className="text-xs text-gray-400 truncate">{sectionLabel(sec.contentType, sec.body)}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button type="button" onClick={() => setEditingSec(sec)} className="text-gray-400 hover:text-indigo-600" title="Edit section">✏️</button>
                    <button type="button" onClick={() => deleteSection(sec.sectionId)} className="text-gray-300 hover:text-red-500" title="Delete section">🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {sections?.length === 0 && !loading && (
            addingSection ? (
              <div>
                <SectionBuilder compact onSave={addSection} callAction={callAction} />
                <button type="button" onClick={() => setAddingSection(false)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">✕ Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingSection(true)}
                className="text-xs text-indigo-400 hover:text-indigo-600 mt-1">+ Add section</button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// -- Program row ---------------------------------------------------------------

function ProgramRow({ program, callAction, allModules, onDelete }: {
  program: ProgramRecord; callAction: CallAction; allModules: ModuleRecord[]; onDelete: () => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [detail, setDetail]       = useState<ProgramDetail | null>(null);
  const [loading, setLoading]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editTitle, setEditTitle] = useState(program.title);
  const [saving, setSaving]       = useState(false);
  const [addModuleSel, setAddModuleSel] = useState<Record<number, string>>({});

  async function load() {
    if (detail) return;
    setLoading(true);
    const r = await callAction('get_program_detail', { programId: program.programId }) as {
      success: boolean;
      data?: { periods?: { periodOrder: number; label: string; modules?: { moduleId: string; title: string; category: string }[] }[] };
    };
    setLoading(false);
    if (r.success && r.data) {
      setDetail({
        periods: (r.data.periods ?? []).map(p => ({
          periodOrder: p.periodOrder,
          label:       p.label,
          modules:     (p.modules ?? []).map(m => ({ moduleId: m.moduleId, title: m.title, category: m.category })),
        })),
      });
    }
  }

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) await load();
  }

  async function saveEdit() {
    setSaving(true);
    await callAction('update_program', { programId: program.programId, title: editTitle.trim() });
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this program?')) return;
    await callAction('delete_program', { programId: program.programId });
    onDelete();
  }

  async function addModuleToPeriod(periodOrder: number, moduleIdOverride?: string) {
    const moduleId = moduleIdOverride ?? addModuleSel[periodOrder];
    if (!moduleId) return;
    const displayOrder = detail?.periods.find(p => p.periodOrder === periodOrder)?.modules.length ?? 0;
    const r = await callAction('add_module_to_period', { programId: program.programId, moduleId, periodOrder, displayOrder }) as { success: boolean };
    if (r.success) {
      const mod = allModules.find(m => m.moduleId === moduleId);
      if (mod) {
        setDetail(prev => prev ? {
          periods: prev.periods.map(p => p.periodOrder === periodOrder
            ? { ...p, modules: [...p.modules, mod] }
            : p),
        } : prev);
      }
      setAddModuleSel(s => ({ ...s, [periodOrder]: '' }));
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white ml-4 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={toggle} className="text-gray-400 text-xs w-4 shrink-0">
          {expanded ? '▾' : '▸'}
        </button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input className={smallInputCls + ' flex-1 text-xs'} value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus />
            <button type="button" disabled={!editTitle.trim() || saving} onClick={saveEdit} className={btnPrimary}>
              {saving ? '...' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setEditTitle(program.title); }} className={btnSecondary}>Cancel</button>
          </div>
        ) : (
          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{program.title}</span>
        )}
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setEditing(true)} className={btnGhost}>Edit</button>
            <button type="button" onClick={handleDelete} className={btnDanger}>Delete</button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-3 pb-3 pt-2 space-y-2 bg-gray-50">
          {loading && <p className="text-xs text-gray-400">Loading periods...</p>}
          {detail?.periods.map(period => (
            <div key={period.periodOrder} className="rounded-lg border border-indigo-100 overflow-hidden">
              {period.label && (
                <div className="bg-indigo-50 px-3 py-1.5">
                  <span className="text-xs font-semibold text-indigo-700">{period.label}</span>
                </div>
              )}
              <div className="p-2 space-y-1.5">
                {period.modules.length === 0
                  ? <p className="text-xs text-gray-400">No modules in this period.</p>
                  : period.modules.map(m => (
                    <ModuleRow key={m.moduleId} mod={m} callAction={callAction} allModules={allModules} />
                  ))
                }
                <div className="flex items-center gap-2 mt-1">
                  <select className={smallInputCls + ' flex-1 text-xs'} value={addModuleSel[period.periodOrder] ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      setAddModuleSel(s => ({ ...s, [period.periodOrder]: val }));
                      if (val) addModuleToPeriod(period.periodOrder, val);
                    }}
                    title="Add existing module">
                    <option value="">+ Add existing module...</option>
                    {allModules.filter(m => !period.modules.some(pm => pm.moduleId === m.moduleId)).map(m => (
                      <option key={m.moduleId} value={m.moduleId}>{m.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Program summary (uses counts already provided by list_programs) ----------

function ProgramSummary({ periodCount }: { periodCount: number }) {
  return (
    <p className="text-xs text-gray-400">
      {periodCount} period{periodCount !== 1 ? 's' : ''}
    </p>
  );
}

// -- Add card (matches library page style) ------------------------------------

function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:from-indigo-50 hover:to-indigo-100/60 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #c7d2fe 1px, transparent 0)', backgroundSize: '20px 20px' }}
      />
      <div className="relative flex flex-col items-center justify-center gap-3 h-full">
        <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors duration-200 shadow-inner">
          <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-gray-400 group-hover:text-indigo-600 tracking-wide transition-colors duration-200">{label}</span>
      </div>
    </button>
  );
}

// -- Program tile --------------------------------------------------------------

function ProgramTile({ program, onEdit, onDelete, onPreview }: {
  program: ProgramRecord;
  onEdit:    (p: ProgramRecord) => void;
  onDelete:  (p: ProgramRecord) => void;
  onPreview: (p: ProgramRecord) => void;
}) {
  return (
    <div
      className="group relative bg-white rounded-xl aspect-square shadow hover:shadow-lg cursor-pointer transition-shadow border border-gray-100 text-sm flex flex-col overflow-hidden"
      onClick={() => onPreview(program)}
    >
      <CardThumbnail src={program.coverImageUrl} title={program.title} />
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button type="button" onClick={e => { e.stopPropagation(); onEdit(program); }}
          className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z"/></svg>
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onDelete(program); }}
          className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="px-4 py-3 flex-1 flex items-end">
        <span className="font-semibold text-gray-900 leading-snug line-clamp-2">{program.title}</span>
      </div>
    </div>
  );
}

// -- Module tile --------------------------------------------------------------

function ModuleTile({ mod, onEdit, onDelete, onPreview }: {
  mod: ModuleRecord;
  onEdit:    (m: ModuleRecord) => void;
  onDelete:  (m: ModuleRecord) => void;
  onPreview: (m: ModuleRecord) => void;
}) {
  return (
    <div
      className="group relative bg-white rounded-xl aspect-square shadow hover:shadow-lg cursor-pointer transition-shadow border border-gray-100 text-sm flex flex-col overflow-hidden"
      onClick={() => onPreview(mod)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button type="button" onClick={e => { e.stopPropagation(); onEdit(mod); }}
          className="w-6 h-6 flex items-center justify-center text-gray-400/70 hover:text-gray-700 transition-colors" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z"/></svg>
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onDelete(mod); }}
          className="w-6 h-6 flex items-center justify-center text-gray-400/70 hover:text-gray-700 transition-colors" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="relative px-4 py-3 flex-1 flex items-end">
        <span className="font-semibold text-gray-900 leading-snug line-clamp-2">{mod.title}</span>
      </div>
    </div>
  );
}

// -- Package tile --------------------------------------------------------------

function PackageTile({ pkg, onEdit, onDelete, onTogglePublish, onPreview }: {
  pkg: PackageRecord;
  onEdit: (pkg: PackageRecord) => void;
  onDelete: (pkg: PackageRecord) => void;
  onTogglePublish: (pkg: PackageRecord) => void;
  onPreview: (pkg: PackageRecord) => void;
}) {
  const costLabel = pkg.pricingModel === 'free'
    ? 'Free'
    : pkg.pricingModel === 'subscription'
      ? 'Subscription'
      : pkg.priceUsd != null
        ? `$${pkg.priceUsd}`
        : '—';

  return (
    <div
      className="group relative bg-white rounded-xl aspect-square shadow hover:shadow-lg cursor-pointer transition-shadow border border-gray-100 text-sm flex flex-col overflow-hidden"
      onClick={() => onPreview(pkg)}
    >
      <CardThumbnail src={pkg.coverImageUrl} title={pkg.title} />
      {/* Overlay action buttons */}
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button type="button" onClick={e => { e.stopPropagation(); onEdit(pkg); }}
          className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z"/></svg>
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onDelete(pkg); }}
          className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      {/* Tile body */}
      <div className="px-4 py-3 flex flex-col gap-1 flex-1 justify-end">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-900 leading-snug line-clamp-2">{pkg.title}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            pkg.pricingModel === 'free' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>{costLabel}</span>
        </div>
      </div>
    </div>
  );
}

// -- Programs list inside a tile (loads on mount) ------------------------------

type ProgramListItem = { programId: string; title: string; periodType?: string; periodCount: number };

function periodLabel(periodType: string | undefined, periodCount: number): string {
  if (!periodType || periodType === 'custom' || periodCount === 0) return '';
  const map: Record<string, string> = {
    week: 'week', day: 'day', month: 'month', quarter: 'quarter', steps: 'step',
  };
  const singular = map[periodType] ?? periodType;
  return `${periodCount} ${singular}${periodCount !== 1 ? 's' : ''}`;
}

function ProgramsList({ packageId }: { packageId: string }) {
  const [programs, setPrograms] = useState<ProgramListItem[] | null>(null);

  useEffect(() => {
    fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '', config: {}, action: 'get_package_detail', params: { packageId } }),
    })
      .then(r => r.json())
      .then((res: { success: boolean; data?: { programs?: ProgramListItem[] } }) => {
        if (res.success) setPrograms(res.data?.programs ?? []);
      })
      .catch(() => setPrograms([]));
  }, [packageId]);

  if (programs === null) {
    return <p className="text-xs text-gray-400">Loading programs…</p>;
  }
  if (programs.length === 0) {
    return <p className="text-xs text-gray-400 italic">No programs yet.</p>;
  }

  // Single-program: show name prominently
  if (programs.length === 1) {
    const p = programs[0];
    const pl = periodLabel(p.periodType, p.periodCount);
    return (
      <div className="mt-1">
        <p className="text-sm font-medium text-gray-800 leading-snug">{p.title}</p>
        {pl && <p className="text-xs text-indigo-500 mt-0.5">{pl}</p>}
      </div>
    );
  }

  // Multi-program: bullet list with period info
  return (
    <ul className="space-y-1 mt-1">
      {programs.map(p => {
        const pl = periodLabel(p.periodType, p.periodCount);
        return (
          <li key={p.programId} className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className="text-gray-300 shrink-0">•</span>
            <span className="truncate">{p.title}</span>
            {pl && <span className="text-indigo-400 shrink-0 ml-auto pl-1">{pl}</span>}
          </li>
        );
      })}
    </ul>
  );
}

// -- Package preview modal (client view) ---------------------------------------

interface PreviewPeriod {
  periodOrder: number;
  label:       string;
  periodType:  string;
  modules:     { moduleId: string; title: string; category: string }[];
}
interface PreviewProgram {
  programId:    string;
  title:        string;
  description?: string;
  periods:      PreviewPeriod[];
}

type ModalScreen = 'programs' | 'viewer' | 'graduation';

function PackagePreviewModal({ pkg, callAction, onClose }: {
  pkg: PackageRecord;
  callAction: CallAction;
  onClose: () => void;
}) {
  const [programs, setPrograms]           = useState<PreviewProgram[]>([]);
  const [loading, setLoading]             = useState(true);
  const [mounted, setMounted]             = useState(false);
  const [screen, setScreen]               = useState<ModalScreen>('programs');
  const [selectedProgramIdx, setSelectedProgramIdx] = useState(0);
  const [periodIdx, setPeriodIdx]         = useState(0);
  const [moduleIdx, setModuleIdx]         = useState(0);
  const [sections, setSections]           = useState<ModuleSectionSpec[] | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [forkedPrograms, setForkedPrograms] = useState<PreviewProgram[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    async function load() {
      const pkgRes = await fetch('/api/agents/coaching-program-builder/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '', config: {}, action: 'get_package_detail', params: { packageId: pkg.packageId } }),
      }).then(r => r.json()) as { success: boolean; data?: { programs?: { programId: string; title: string }[] } };

      if (!pkgRes.success || !pkgRes.data?.programs?.length) { setLoading(false); return; }

      const details = await Promise.all(
        pkgRes.data.programs.map(p =>
          callAction('get_program_detail', { programId: p.programId }) as Promise<{
            success: boolean;
            data?: {
              programId: string; title: string; description?: string;
              periods?: {
                periodOrder: number; label: string; periodType: string;
                modules?: { moduleId: string; title: string; category: string }[];
              }[];
            };
          }>
        )
      );

      const loaded = details.filter(r => r.success && r.data).map(r => ({
        programId:   r.data!.programId,
        title:       r.data!.title,
        description: r.data!.description,
        periods: (r.data!.periods ?? []).map(p => ({
          periodOrder: p.periodOrder,
          label:       p.label,
          periodType:  p.periodType,
          modules:     p.modules ?? [],
        })),
      }));

      setPrograms(loaded);
      // Skip programs list if only one program
      if (loaded.length === 1) {
        setScreen('viewer');
      }
      setLoading(false);

      // Fetch forked/included program details in parallel (module names only)
      const forkedIds = pkg.includedProgramIds ?? [];
      if (forkedIds.length > 0) {
        const forkedDetails = await Promise.all(
          forkedIds.map(id =>
            callAction('get_program_detail', { programId: id }) as Promise<{
              success: boolean;
              data?: {
                programId: string; title: string; description?: string;
                periods?: { periodOrder: number; label: string; periodType: string;
                  modules?: { moduleId: string; title: string; category: string }[] }[];
              };
            }>
          )
        );
        setForkedPrograms(
          forkedDetails.filter(r => r.success && r.data).map(r => ({
            programId:   r.data!.programId,
            title:       r.data!.title,
            description: r.data!.description,
            periods: (r.data!.periods ?? []).map(p => ({
              periodOrder: p.periodOrder,
              label:       p.label,
              periodType:  p.periodType,
              modules:     p.modules ?? [],
            })),
          }))
        );
      }
    }
    load();
  }, [pkg.packageId, callAction]);

  // Fetch sections when entering viewer or navigating periods/modules
  useEffect(() => {
    if (screen !== 'viewer' || loading) return;
    const prog = programs[selectedProgramIdx];
    if (!prog) return;
    const period = prog.periods[periodIdx];
    if (!period || period.modules.length === 0) { setSections([]); return; }
    const mod = period.modules[moduleIdx];
    if (!mod) return;
    setSections(null);
    setSectionsLoading(true);
    (callAction('get_module_detail', { moduleId: mod.moduleId }) as Promise<{ success: boolean; data?: { sections: ModuleSectionSpec[] } }>)
      .then(r => setSections(r.success ? (r.data?.sections ?? []) : []))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, selectedProgramIdx, periodIdx, moduleIdx, loading]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const costLabel = pkg.pricingModel === 'free' ? 'Free'
    : pkg.pricingModel === 'subscription' ? 'Subscription'
    : pkg.priceUsd != null ? `$${pkg.priceUsd}` : '—';

  const activeProg   = programs[selectedProgramIdx];
  const activePeriod = activeProg?.periods[periodIdx];
  const activeModule = activePeriod?.modules[moduleIdx];

  const hasGraduation = !!(pkg.certificateUrl || pkg.certificateTemplate || forkedPrograms.length > 0);
  const isLastPeriod  = !activeProg || periodIdx >= activeProg.periods.length - 1;
  const isLastModule  = !activePeriod || moduleIdx >= activePeriod.modules.length - 1;

  function goToViewer(progIdx: number) {
    setSelectedProgramIdx(progIdx);
    setPeriodIdx(0);
    setModuleIdx(0);
    setScreen('viewer');
  }

  const totalModules = activeProg?.periods.reduce((acc, p) => acc + p.modules.length, 0) ?? 0;
  const modulesBeforePeriod = activeProg?.periods.slice(0, periodIdx).reduce((acc, p) => acc + p.modules.length, 0) ?? 0;
  const globalModuleIdx = modulesBeforePeriod + moduleIdx + 1;

  function prevStep() {
    if (moduleIdx > 0) {
      setModuleIdx(i => i - 1);
    } else if (periodIdx > 0) {
      const prevPeriodModules = activeProg!.periods[periodIdx - 1].modules.length;
      setPeriodIdx(i => i - 1);
      setModuleIdx(Math.max(0, prevPeriodModules - 1));
    }
  }
  function nextStep() {
    if (!isLastModule) {
      setModuleIdx(i => i + 1);
    } else if (!isLastPeriod) {
      setPeriodIdx(i => i + 1);
      setModuleIdx(0);
    } else if (hasGraduation) {
      setScreen('graduation');
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] h-[90vh] bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white px-8 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Back to programs breadcrumb */}
              {screen === 'viewer' && programs.length > 1 && (
                <button
                  type="button"
                  onClick={() => setScreen('programs')}
                  className="text-sm text-indigo-500 hover:text-indigo-700 font-medium shrink-0 flex items-center gap-1"
                >
                  ← Programs
                </button>
              )}
              {screen === 'graduation' && (
                <button
                  type="button"
                  onClick={() => setScreen('viewer')}
                  className="text-sm text-indigo-500 hover:text-indigo-700 font-medium shrink-0 flex items-center gap-1"
                >
                  ← Back
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900 truncate">{pkg.title}</h2>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
                pkg.pricingModel === 'free' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>{costLabel}</span>
              {screen === 'viewer' && activeProg && programs.length > 1 && (
                <span className="text-sm text-gray-400 truncate hidden sm:block">· {activeProg.title}</span>
              )}
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 px-8 py-8">
              <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Loading programs…
            </div>
          ) : programs.length === 0 ? (
            <p className="text-gray-400 text-sm italic px-8 py-8">No programs in this package yet.</p>

          ) : screen === 'programs' ? (
            /* ── Programs list screen ── */
            <div className="px-8 py-8 space-y-4">
              <p className="text-sm text-gray-500 mb-2">Select a program to preview its content:</p>
              {programs.map((prog, pi) => (
                <button
                  key={prog.programId}
                  type="button"
                  onClick={() => goToViewer(pi)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all p-6 flex items-start gap-4 group"
                >
                  <span className="text-sm font-bold bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-indigo-200 transition-colors">
                    {pi + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{prog.title}</p>
                    {prog.description && (
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{prog.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {prog.periods.length} period{prog.periods.length !== 1 ? 's' : ''} &middot;{' '}
                      {prog.periods.reduce((acc, p) => acc + p.modules.length, 0)} module{prog.periods.reduce((acc, p) => acc + p.modules.length, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-indigo-400 text-lg shrink-0 mt-0.5 group-hover:translate-x-1 transition-transform">→</span>
                </button>
              ))}
            </div>

          ) : screen === 'viewer' ? (
            /* ── Viewer screen ── */
            <div className="flex flex-col h-full">
              {/* Unified module navigation bar */}
              {activeProg && activeProg.periods.length > 0 && totalModules > 0 && (
                <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={periodIdx === 0 && moduleIdx === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    aria-label="Previous module"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  <div className="flex-1 text-center min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {activePeriod?.label
                        ? <span className="text-indigo-600">{activePeriod.label}</span>
                        : <span className="text-gray-500">Period {periodIdx + 1}</span>
                      }
                      {activeModule && (
                        <span className="text-gray-400 font-normal"> · {activeModule.title}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Module {globalModuleIdx} of {totalModules}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={isLastModule && isLastPeriod && !hasGraduation}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    aria-label="Next module"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}

              {/* Module content */}
              <div className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl mx-auto w-full">

                {!activePeriod || activePeriod.modules.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
                    No modules in this period yet.
                  </div>
                ) : sectionsLoading || sections === null ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                        <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-5/6" />
                      </div>
                    ))}
                  </div>
                ) : sections.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
                    This module has no content sections yet.
                  </div>
                ) : (
                  <ClientPortalModule
                    sections={sections}
                    previewMode
                    enrollmentId=""
                    token=""
                  />
                )}

              </div>
            </div>

          ) : screen === 'graduation' ? (
            /* ── Graduation screen ── */
            <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl mx-auto w-full space-y-6">
              {/* Certificate banner */}
              {(pkg.certificateUrl || pkg.certificateTemplate) && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                  <span className="text-3xl shrink-0">🎓</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-900">
                      {pkg.certificateTemplate?.title ?? 'Certificate of Completion'}
                    </p>
                    {pkg.certificateTemplate?.subtitle && (
                      <p className="text-sm text-amber-700 mt-0.5">{pkg.certificateTemplate.subtitle}</p>
                    )}
                    {pkg.certificateTemplate?.coachName && (
                      <p className="text-xs text-amber-600 mt-0.5">Issued by {pkg.certificateTemplate.coachName}</p>
                    )}
                    {pkg.certificateUrl && (
                      <a
                        href={pkg.certificateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-amber-700 underline hover:text-amber-900"
                      >
                        Preview certificate template →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Forked programs — shown on graduation */}
              {forkedPrograms.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎁</span>
                    <h4 className="text-sm font-semibold text-gray-700">Included on Graduation</h4>
                  </div>
                  {forkedPrograms.map(prog => {
                    const allModules = prog.periods.flatMap(p => p.modules);
                    return (
                      <div key={prog.programId} className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-indigo-50 bg-indigo-50/40">
                          <p className="font-semibold text-gray-900 text-sm">{prog.title}</p>
                          {prog.description && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{prog.description}</p>
                          )}
                        </div>
                        <ul className="divide-y divide-gray-50">
                          {allModules.length === 0 ? (
                            <li className="px-5 py-3 text-xs text-gray-400 italic">No modules yet.</li>
                          ) : allModules.map((mod, mi) => (
                            <li key={`${mi}-${mod.moduleId}`} className="flex items-center gap-3 px-5 py-3">
                              <span className="text-sm text-gray-700">{mod.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -- Module preview modal -----------------------------------------------------

function ModulePreviewModal({ mod, callAction, onClose }: {
  mod: ModuleRecord;
  callAction: CallAction;
  onClose: () => void;
}) {
  const [sections, setSections] = useState<ModuleSectionSpec[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setLoading(true);
    (callAction('get_module_detail', { moduleId: mod.moduleId }) as Promise<{ success: boolean; data?: { sections: ModuleSectionSpec[] } }>)
      .then(r => { if (r.success && r.data) setSections(r.data.sections); })
      .finally(() => setLoading(false));
  }, [mod.moduleId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] h-[90vh] bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white px-8 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">📦</span>
              <h2 className="text-xl font-bold text-gray-900 truncate">{mod.title}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6 max-w-2xl mx-auto w-full">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
                  </div>
                ))}
              </div>
            ) : !sections || sections.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
                This module has no content sections yet.
              </div>
            ) : (
              <ClientPortalModule
                sections={sections}
                previewMode
                enrollmentId=""
                token=""
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -- Module create / edit modal ------------------------------------------------

function ModuleModal({ mod, callAction, onClose, onSaved }: {
  mod: ModuleRecord | 'new';
  callAction: CallAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew    = mod === 'new';
  const existing = isNew ? null : (mod as ModuleRecord);

  const [title,        setTitle]        = useState(existing?.title ?? '');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [mounted,      setMounted]      = useState(false);
  const [addSectionFor, setAddSectionFor] = useState<string | null>(null);

  // Edit-mode section management
  const [sections,      setSections]      = useState<SectionRecord[] | null>(null);
  const [secLoading,    setSecLoading]    = useState(false);
  const [editingSec,    setEditingSec]    = useState<SectionRecord | null>(null);
  const [addingSection, setAddingSection] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!existing) return;
    setSecLoading(true);
    (callAction('get_module_detail', { moduleId: existing.moduleId }) as Promise<{ success: boolean; data?: { sections: SectionRecord[] } }>)
      .then(r => { if (r.success && r.data) setSections(r.data.sections); })
      .finally(() => setSecLoading(false));
  }, [existing?.moduleId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const action = isNew ? 'create_module' : 'update_module';
    const params: Record<string, unknown> = { title: title.trim(), category: '' };
    if (!isNew && existing) params.moduleId = existing.moduleId;
    const r = await callAction(action, params) as { success: boolean; message?: string; data?: { moduleId: string } };
    setSaving(false);
    if (!r.success) { setError(r.message ?? 'Failed to save.'); return; }
    if (isNew && r.data?.moduleId) { setAddSectionFor(r.data.moduleId); return; }
    onSaved();
    onClose();
  }

  async function addSection(type: SectionType, body: Record<string, unknown>) {
    if (!existing) return;
    const order = sections?.length ?? 0;
    const r = await callAction('add_section', { moduleId: existing.moduleId, order, contentType: type, body }) as { success: boolean; data?: SectionRecord };
    if (r.success && r.data) {
      setSections(p => [...(p ?? []), r.data!]);
      setAddingSection(false);
    }
  }

  async function updateSection(sec: SectionRecord, type: SectionType, body: Record<string, unknown>) {
    if (!existing) return;
    await callAction('update_section', { moduleId: existing.moduleId, sectionId: sec.sectionId, contentType: type, body });
    setSections(p => (p ?? []).map(s => s.sectionId === sec.sectionId ? { ...s, contentType: type, body } : s));
    setEditingSec(null);
  }

  async function deleteSection(sectionId: string) {
    if (!existing) return;
    await callAction('delete_section', { moduleId: existing.moduleId, sectionId });
    setSections(p => (p ?? []).filter(s => s.sectionId !== sectionId));
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{isNew ? 'New Module' : `Edit Module — ${existing?.title}`}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {addSectionFor ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
              <p className="text-sm font-medium text-gray-700">Module created! Add a first section:</p>
              <SectionBuilder
                callAction={callAction}
                onSave={async (type, body) => {
                  await callAction('add_section', { moduleId: addSectionFor, order: 0, contentType: type, body });
                  onSaved();
                  onClose();
                }}
              />
            </div>
            <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={() => { onSaved(); onClose(); }} className={btnSecondary}>Skip</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
              )}
              <div>
                <label htmlFor="mod-title" className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  id="mod-title"
                  type="text"
                  className={inputCls}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  autoFocus
                  placeholder="Module title"
                />
              </div>
              {/* Sections — only shown when editing an existing module */}
              {!isNew && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Sections</p>
                  {secLoading ? (
                    <p className="text-xs text-gray-400">Loading sections…</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(!sections || sections.length === 0) && !addingSection && (
                        <p className="text-xs text-gray-400 italic">No sections yet.</p>
                      )}
                      {sections?.map(sec => (                        <div key={sec.sectionId}>
                          {editingSec?.sectionId === sec.sectionId ? (
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 space-y-2 max-h-[55vh] overflow-y-auto">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-indigo-700">Editing {SECTION_LABELS[sec.contentType]}</span>
                                <button type="button" onClick={() => setEditingSec(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
                              </div>
                              <SectionBuilder
                                editSection={editingSec}
                                onSave={async (type, body) => updateSection(sec, type, body)}
                                callAction={callAction}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                              <span className="text-xs font-medium text-gray-600 shrink-0">{SECTION_LABELS[sec.contentType]}</span>
                              <p className="text-xs text-gray-400 truncate flex-1">{sectionLabel(sec.contentType, sec.body)}</p>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <button type="button" onClick={() => { setEditingSec(sec); setAddingSection(false); }} className="text-gray-400 hover:text-indigo-600" title="Edit section">✏️</button>
                                <button type="button" onClick={() => deleteSection(sec.sectionId)} className="text-gray-300 hover:text-red-500" title="Delete section">🗑️</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {!editingSec && (!sections || sections.length === 0) && (
                        addingSection ? (
                          <div className="pt-1 max-h-[55vh] overflow-y-auto">
                            <SectionBuilder compact callAction={callAction} onSave={addSection} />
                            <button type="button" onClick={() => setAddingSection(false)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">✕ Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAddingSection(true)}
                            className="text-sm text-indigo-500 hover:text-indigo-700 font-medium mt-1">+ Add section</button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary + ' px-6 py-2 text-sm'}>
                {saving ? 'Saving…' : isNew ? 'Create Module' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// -- Program preview modal -----------------------------------------------------

function ProgramPreviewModal({ prog, callAction, onClose }: {
  prog:       ProgramRecord;
  callAction: CallAction;
  onClose:    () => void;
}) {
  const [periods,         setPeriods]         = useState<PeriodInfo[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [mounted,         setMounted]         = useState(false);
  const [periodIdx,       setPeriodIdx]       = useState(0);
  const [moduleIdx,       setModuleIdx]       = useState(0);
  const [sections,        setSections]        = useState<ModuleSectionSpec[] | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setLoading(true);
    (callAction('get_program_detail', { programId: prog.programId }) as Promise<{
      success: boolean;
      data?: {
        periods?: { periodOrder: number; label: string; periodType: string; modules?: { moduleId: string; title: string; category: string }[] }[];
      };
    }>).then(r => {
      if (r.success && r.data?.periods) {
        setPeriods(r.data.periods.map(p => ({
          periodOrder: p.periodOrder,
          label:       p.label,
          modules:     (p.modules ?? []).map(m => ({ moduleId: m.moduleId, title: m.title, category: m.category })),
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [prog.programId, callAction]);

  // Load sections when period/module changes
  useEffect(() => {
    if (loading) return;
    const period = periods[periodIdx];
    if (!period || period.modules.length === 0) { setSections([]); return; }
    const mod = period.modules[moduleIdx];
    if (!mod) return;
    setSections(null);
    setSectionsLoading(true);
    (callAction('get_module_detail', { moduleId: mod.moduleId }) as Promise<{ success: boolean; data?: { sections: ModuleSectionSpec[] } }>)
      .then(r => setSections(r.success ? (r.data?.sections ?? []) : []))
      .catch(() => setSections([]))
      .finally(() => setSectionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodIdx, moduleIdx, loading]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activePeriod = periods[periodIdx];
  const activeModule = activePeriod?.modules[moduleIdx];
  const isLastPeriod = periodIdx >= periods.length - 1;
  const isLastModule = !activePeriod || moduleIdx >= activePeriod.modules.length - 1;

  const totalModules = periods.reduce((acc, p) => acc + p.modules.length, 0);
  const modulesBeforePeriod = periods.slice(0, periodIdx).reduce((acc, p) => acc + p.modules.length, 0);
  const globalModuleIdx = modulesBeforePeriod + moduleIdx + 1;

  function prevStep() {
    if (moduleIdx > 0) {
      setModuleIdx(i => i - 1);
    } else if (periodIdx > 0) {
      const prevPeriodModules = periods[periodIdx - 1].modules.length;
      setPeriodIdx(i => i - 1);
      setModuleIdx(Math.max(0, prevPeriodModules - 1));
    }
  }
  function nextStep() {
    if (!isLastModule) {
      setModuleIdx(i => i + 1);
    } else if (!isLastPeriod) {
      setPeriodIdx(i => i + 1);
      setModuleIdx(0);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] h-[90vh] bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white px-8 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">📋</span>
              <h2 className="text-xl font-bold text-gray-900 truncate">{prog.title}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none shrink-0">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 px-8 py-8">
              <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Loading program…
            </div>
          ) : periods.length === 0 ? (
            <p className="text-gray-400 text-sm italic px-8 py-8">No periods in this program yet.</p>
          ) : (
            <>
              {/* Unified module navigation bar */}
              <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={periodIdx === 0 && moduleIdx === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                  aria-label="Previous module"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="flex-1 text-center min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">
                    {activePeriod?.label
                      ? <span className="text-indigo-600">{activePeriod.label}</span>
                      : <span className="text-gray-500">Period {periodIdx + 1}</span>
                    }
                    {activeModule && (
                      <span className="text-gray-400 font-normal"> · {activeModule.title}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Module {globalModuleIdx} of {totalModules}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isLastModule && isLastPeriod}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                  aria-label="Next module"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Module content */}
              <div className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl mx-auto w-full">
                {!activePeriod || activePeriod.modules.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
                    No modules in this period yet.
                  </div>
                ) : sectionsLoading || sections === null ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                        <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-5/6" />
                      </div>
                    ))}
                  </div>
                ) : sections.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
                    This module has no content sections yet.
                  </div>
                ) : (
                  <ClientPortalModule
                    sections={sections}
                    previewMode
                    enrollmentId=""
                    token=""
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -- Program create / edit modal -----------------------------------------------

function ProgramModal({
  prog,
  allModules,
  callAction,
  onClose,
  onSaved,
}: {
  prog:       ProgramRecord | 'new';
  allModules: ModuleRecord[];
  callAction: CallAction;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const isNew    = prog === 'new';
  const existing = isNew ? null : (prog as ProgramRecord);

  const [title,            setTitle]            = useState(existing?.title ?? '');
  const [coverImageUrl,    setCoverImageUrl]    = useState(existing?.coverImageUrl ?? '');
  const [coverFile,        setCoverFile]        = useState<File | null>(null);
  const [coverUploading,   setCoverUploading]   = useState(false);
  const [selectedModules,  setSelectedModules]  = useState<string[]>([]);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');
  const [mounted,          setMounted]          = useState(false);

  // Edit-mode: period state
  const [periods,           setPeriods]          = useState<(PeriodInfo & { periodType?: string })[]>([]);
  const [periodsLoading,    setPeriodsLoading]   = useState(false);
  const [addModuleSel,      setAddModuleSel]     = useState<Record<number, string>>({});
  const [expandedModuleId,  setExpandedModuleId] = useState<string | null>(null);
  const [moduleSectionsMap, setModuleSectionsMap] = useState<Record<string, SectionRecord[]>>({});
  const [sectionsLoadingMap, setSectionsLoadingMap] = useState<Record<string, boolean>>({});

  // Add-period form
  const [addingPeriod,     setAddingPeriod]     = useState(false);
  const [newPeriodLabel,   setNewPeriodLabel]   = useState('');
  const [newPeriodType,    setNewPeriodType]    = useState('week');
  const [addingPeriodBusy, setAddingPeriodBusy] = useState(false);

  // Create-new-module form (per period)
  const [creatingModuleForPeriod, setCreatingModuleForPeriod] = useState<number | null>(null);
  const [newModuleTitle,          setNewModuleTitle]          = useState('');
  const [creatingModuleBusy,      setCreatingModuleBusy]      = useState(false);
  const [addingSectionForModuleId, setAddingSectionForModuleId] = useState<string | null>(null);
  const [showAddModuleForPeriod,  setShowAddModuleForPeriod]  = useState<number | null>(null);

  // Inline period label editing
  const [editingPeriodOrder, setEditingPeriodOrder] = useState<number | null>(null);
  const [editingPeriodLabel, setEditingPeriodLabel] = useState('');

  useEffect(() => setMounted(true), []);

  // Edit mode: load periods from server
  useEffect(() => {
    if (!existing) return;
    setPeriodsLoading(true);
    fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '', config: {}, action: 'get_program_detail', params: { programId: existing.programId } }),
    })
      .then(r => r.json())
      .then((res: { success: boolean; data?: { periods?: { periodOrder: number; label: string; periodType?: string; modules?: { moduleId: string; title: string; category: string }[] }[] } }) => {
        if (res.success && res.data?.periods) {
          setPeriods(res.data.periods.map(p => ({
            periodOrder: p.periodOrder,
            label:       p.label,
            periodType:  p.periodType,
            modules:     (p.modules ?? []).map(m => ({ moduleId: m.moduleId, title: m.title, category: m.category })),
          })));
        }
        setPeriodsLoading(false);
      })
      .catch(() => setPeriodsLoading(false));
  }, [existing?.programId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleModule(id: string) {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  async function toggleModuleDetail(moduleId: string) {
    if (expandedModuleId === moduleId) { setExpandedModuleId(null); return; }
    setExpandedModuleId(moduleId);
    if (moduleSectionsMap[moduleId]) return;
    setSectionsLoadingMap(s => ({ ...s, [moduleId]: true }));
    const r = await callAction('get_module_detail', { moduleId }) as { success: boolean; data?: { sections: SectionRecord[] } };
    setModuleSectionsMap(m => ({ ...m, [moduleId]: r.success ? (r.data?.sections ?? []) : [] }));
    setSectionsLoadingMap(s => ({ ...s, [moduleId]: false }));
  }

  async function addModuleToPeriod(periodOrder: number, moduleIdOverride?: string) {
    const moduleId = moduleIdOverride ?? addModuleSel[periodOrder];
    if (!moduleId) return;
    const mod = allModules.find(m => m.moduleId === moduleId);
    if (!mod) return;
    if (isNew) {
      setPeriods(prev => prev.map(p => p.periodOrder === periodOrder
        ? { ...p, modules: [...p.modules, mod] }
        : p));
      setAddModuleSel(s => ({ ...s, [periodOrder]: '' }));
      return;
    }
    const displayOrder = periods.find(p => p.periodOrder === periodOrder)?.modules.length ?? 0;
    const r = await callAction('add_module_to_period', {
      programId: existing!.programId, moduleId, periodOrder, displayOrder,
    }) as { success: boolean };
    if (r.success) {
      setPeriods(prev => prev.map(p => p.periodOrder === periodOrder
        ? { ...p, modules: [...p.modules, mod] }
        : p));
      setAddModuleSel(s => ({ ...s, [periodOrder]: '' }));
    }
  }

  async function addPeriod() {
    if (!newPeriodLabel.trim()) return;
    setAddingPeriodBusy(true);
    const periodOrder = periods.length > 0 ? Math.max(...periods.map(p => p.periodOrder)) + 1 : 0;
    if (isNew) {
      setPeriods(prev => [...prev, { periodOrder, label: newPeriodLabel.trim(), periodType: newPeriodType, modules: [] }]);
      setNewPeriodLabel('');
      setNewPeriodType('week');
      setAddingPeriod(false);
      setAddingPeriodBusy(false);
      return;
    }
    const r = await callAction('create_program_period', {
      programId: existing!.programId,
      periodOrder,
      label:      newPeriodLabel.trim(),
      periodType: newPeriodType,
    }) as { success: boolean };
    if (r.success) {
      setPeriods(prev => [...prev, { periodOrder, label: newPeriodLabel.trim(), periodType: newPeriodType, modules: [] }]);
      setNewPeriodLabel('');
      setNewPeriodType('week');
      setAddingPeriod(false);
    }
    setAddingPeriodBusy(false);
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');

    // Upload cover image if a file was selected
    let resolvedCoverUrl = coverImageUrl;
    if (coverFile) {
      setCoverUploading(true);
      try {
        const supabase = createClient();
        const ext      = coverFile.name.split('.').pop() ?? 'bin';
        const filePath = `programs/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('library-files').upload(filePath, coverFile);
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(filePath);
        resolvedCoverUrl = urlData.publicUrl;
      } catch (e: unknown) {
        setError((e as Error).message);
        setSaving(false);
        setCoverUploading(false);
        return;
      }
      setCoverUploading(false);
    }

    if (isNew) {
      let r: { success: boolean; message?: string };
      if (periods.length > 0) {
        r = await callAction('build_program_with_periods', {
          title: title.trim(),
          periods: periods.map(p => ({
            label:      p.label,
            periodType: p.periodType ?? 'custom',
            moduleIds:  p.modules.map(m => m.moduleId),
          })),
        }) as { success: boolean; message?: string };
      } else {
        r = await callAction('build_program', { title: title.trim(), moduleIds: selectedModules }) as { success: boolean; message?: string };
      }
      setSaving(false);
      if (!r.success) { setError(r.message ?? 'Failed to create program.'); return; }
    } else {
      await callAction('update_program', { programId: existing!.programId, title: title.trim(), ...(resolvedCoverUrl !== undefined ? { coverImageUrl: resolvedCoverUrl } : {}) });
      setSaving(false);
    }

    onSaved();
    onClose();
  }

  const PERIOD_TYPE_LABELS: Record<string, string> = {
    week: 'Week', day: 'Day', month: 'Month', quarter: 'Quarter', steps: 'Step', custom: 'Custom',
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] max-w-2xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {isNew ? 'New Program' : `Edit Program — ${existing?.title}`}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Program Title</label>
            <input
              className={inputCls}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 8-Week Fitness Foundation"
              autoFocus
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Thumbnail</label>
            <ThumbnailPicker
              value={coverFile ? URL.createObjectURL(coverFile) : coverImageUrl}
              onChange={v => { setCoverFile(null); setCoverImageUrl(v); }}
              onFileChange={f => { setCoverFile(f); setCoverImageUrl(''); }}
              uploading={coverUploading}
            />
          </div>

          {/* ── Periods (both new and edit mode) ── */}
          <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Periods</label>
              {periodsLoading ? (
                <p className="text-xs text-gray-400">Loading periods…</p>
              ) : periods.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No periods yet. Add one below.</p>
              ) : (
                periods.map(period => (
                  <div key={period.periodOrder} className="rounded-xl border border-indigo-100">
                    {/* Period header */}
                    <div className="bg-indigo-50 px-4 py-2 flex items-center gap-2">
                      {editingPeriodOrder === period.periodOrder ? (
                        <input
                          autoFocus
                          className="text-xs font-semibold text-indigo-800 flex-1 bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          value={editingPeriodLabel}
                          onChange={e => setEditingPeriodLabel(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Escape') { setEditingPeriodOrder(null); return; }
                            if (e.key === 'Enter') {
                              const label = editingPeriodLabel.trim();
                              if (label && existing) {
                                await callAction('rename_program_period', { programId: existing.programId, periodOrder: period.periodOrder, label });
                                setPeriods(prev => prev.map(p => p.periodOrder === period.periodOrder ? { ...p, label } : p));
                              }
                              setEditingPeriodOrder(null);
                            }
                          }}
                          onBlur={async () => {
                            const label = editingPeriodLabel.trim();
                            if (label && existing) {
                              await callAction('rename_program_period', { programId: existing.programId, periodOrder: period.periodOrder, label });
                              setPeriods(prev => prev.map(p => p.periodOrder === period.periodOrder ? { ...p, label } : p));
                            }
                            setEditingPeriodOrder(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-800 flex-1 text-left hover:text-indigo-600 truncate"
                          onClick={() => { setEditingPeriodOrder(period.periodOrder); setEditingPeriodLabel(period.label || `Period ${period.periodOrder + 1}`); }}
                          title="Click to rename"
                        >
                          {period.label || `Period ${period.periodOrder + 1}`}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Add module to this period"
                        onClick={() => setShowAddModuleForPeriod(n => n === period.periodOrder ? null : period.periodOrder)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-indigo-200 text-indigo-500 hover:text-indigo-800 shrink-0 text-xs font-semibold"
                      >
                        Add Module
                      </button>
                      <button
                        type="button"
                        title="Delete period"
                        onClick={async () => {
                          if (isNew) {
                            setPeriods(prev => prev.filter(p => p.periodOrder !== period.periodOrder));
                            return;
                          }
                          if (!existing) return;
                          const r = await callAction('delete_program_period', { programId: existing.programId, periodOrder: period.periodOrder }) as { success: boolean };
                          if (r.success) setPeriods(prev => prev.filter(p => p.periodOrder !== period.periodOrder));
                        }}
                        className="ml-1 w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-300 hover:text-red-600 shrink-0 text-xs"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Add module panel */}
                    {showAddModuleForPeriod === period.periodOrder && (
                      <div className="border-b border-indigo-100 bg-indigo-50/50 px-3 py-2">
                        {creatingModuleForPeriod === period.periodOrder ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-indigo-700">New Module</p>
                              <button type="button" onClick={() => { setCreatingModuleForPeriod(null); setNewModuleTitle(''); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <input
                              className={smallInputCls + ' w-full text-xs'}
                              value={newModuleTitle}
                              onChange={e => setNewModuleTitle(e.target.value)}
                              placeholder="Module title"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Escape') { setCreatingModuleForPeriod(null); setNewModuleTitle(''); } }}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={!newModuleTitle.trim() || creatingModuleBusy}
                                onClick={async () => {
                                  if (!newModuleTitle.trim()) return;
                                  setCreatingModuleBusy(true);
                                  const displayOrder = period.modules.length;
                                  let r: { success: boolean; data?: { moduleId: string; title: string; category: string } };
                                  if (isNew) {
                                    r = await callAction('create_module', {
                                      title:    newModuleTitle.trim(),
                                      category: '',
                                    }) as typeof r;
                                  } else {
                                    r = await callAction('create_inline_module', {
                                      programId:    existing!.programId,
                                      periodOrder:  period.periodOrder,
                                      title:        newModuleTitle.trim(),
                                      category:     '',
                                      displayOrder,
                                    }) as typeof r;
                                  }
                                  if (r.success && r.data) {
                                    const newMod = { moduleId: r.data.moduleId, title: r.data.title, category: r.data.category };
                                    setPeriods(prev => prev.map(p => p.periodOrder === period.periodOrder
                                      ? { ...p, modules: [...p.modules, newMod] }
                                      : p));
                                    setExpandedModuleId(r.data.moduleId);
                                    setAddingSectionForModuleId(r.data.moduleId);
                                  }
                                  setCreatingModuleBusy(false);
                                  setCreatingModuleForPeriod(null);
                                  setNewModuleTitle('');
                                  setShowAddModuleForPeriod(null);
                                }}
                                className={btnPrimary}
                              >
                                {creatingModuleBusy ? '…' : 'Create'}
                              </button>
                              <button type="button" onClick={() => { setCreatingModuleForPeriod(null); setNewModuleTitle(''); }} className={btnSecondary}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              className={smallInputCls + ' flex-1 text-xs'}
                              value={addModuleSel[period.periodOrder] ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__create__') {
                                  setCreatingModuleForPeriod(period.periodOrder);
                                  setNewModuleTitle('');
                                  setAddModuleSel(s => ({ ...s, [period.periodOrder]: '' }));
                                } else if (val) {
                                  setAddModuleSel(s => ({ ...s, [period.periodOrder]: val }));
                                  addModuleToPeriod(period.periodOrder, val);
                                }
                              }}
                            >
                              <option value="">Pick a module…</option>
                              <option value="__create__">✦ Create new module</option>
                              {allModules.filter(m => !period.modules.some(pm => pm.moduleId === m.moduleId)).map(m => (
                                <option key={m.moduleId} value={m.moduleId}>{m.title}</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => setShowAddModuleForPeriod(null)} className={btnSecondary}>Cancel</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modules list */}
                    <div className="p-3 space-y-1.5 bg-white">
                      {period.modules.length === 0 ? (
                        <p className="text-xs text-gray-400">No modules in this period.</p>
                      ) : (
                        period.modules.map(mod => {
                          const isExpanded = expandedModuleId === mod.moduleId;
                          const secs       = moduleSectionsMap[mod.moduleId];
                          const secLoading = sectionsLoadingMap[mod.moduleId];
                          return (
                            <div key={mod.moduleId} className="rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2 px-3 py-2 bg-white">
                                <span className="flex-1 text-sm text-gray-800 truncate">{mod.title}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleModuleDetail(mod.moduleId)}
                                  title={isExpanded ? 'Collapse sections' : 'View module sections'}
                                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors shrink-0 text-sm font-semibold ${
                                    isExpanded
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'hover:bg-indigo-50 text-indigo-400 hover:text-indigo-700'
                                  }`}
                                >
                                  →
                                </button>
                                <button
                                  type="button"
                                  title="Remove from this period"
                                  onClick={async () => {
                                    if (isNew) {
                                      setPeriods(prev => prev.map(p => p.periodOrder === period.periodOrder
                                        ? { ...p, modules: p.modules.filter(m => m.moduleId !== mod.moduleId) }
                                        : p));
                                      if (expandedModuleId === mod.moduleId) setExpandedModuleId(null);
                                      return;
                                    }
                                    if (!existing) return;
                                    const r = await callAction('remove_module_from_period', { programId: existing.programId, periodOrder: period.periodOrder, moduleId: mod.moduleId }) as { success: boolean };
                                    if (r.success) {
                                      setPeriods(prev => prev.map(p => p.periodOrder === period.periodOrder
                                        ? { ...p, modules: p.modules.filter(m => m.moduleId !== mod.moduleId) }
                                        : p));
                                      if (expandedModuleId === mod.moduleId) setExpandedModuleId(null);
                                    }
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded-md text-red-300 hover:text-red-600 hover:bg-red-50 shrink-0 text-xs font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-gray-50 bg-gray-50 px-3 py-2 space-y-1">
                                  {secLoading ? (
                                    <p className="text-xs text-gray-400">Loading sections…</p>
                                  ) : (
                                    <>
                                      {(!secs || secs.length === 0) && addingSectionForModuleId !== mod.moduleId && (
                                        <>
                                          <p className="text-xs text-gray-400 italic">No sections yet.</p>
                                          <button
                                            type="button"
                                            onClick={() => setAddingSectionForModuleId(mod.moduleId)}
                                            className="text-xs text-indigo-400 hover:text-indigo-600 font-medium"
                                          >+ Add section</button>
                                        </>
                                      )}
                                      {secs?.map(sec => (
                                        <div key={sec.sectionId} className="flex items-center gap-2 bg-white rounded-md border border-gray-100 px-3 py-1.5">
                                          <span className="text-xs font-medium text-gray-500 shrink-0">{SECTION_LABELS[sec.contentType]}</span>
                                          <span className="text-xs text-gray-400 truncate flex-1">{sectionLabel(sec.contentType, sec.body)}</span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => setAddingSectionForModuleId(mod.moduleId)}
                                              className="text-gray-400 hover:text-indigo-600 text-sm"
                                              title="Edit section"
                                            >✏️</button>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                await callAction('delete_section', { moduleId: mod.moduleId, sectionId: sec.sectionId });
                                                setModuleSectionsMap(m => ({ ...m, [mod.moduleId]: [] }));
                                              }}
                                              className="text-gray-300 hover:text-red-500 text-sm"
                                              title="Delete section"
                                            >🗑️</button>
                                          </div>
                                        </div>
                                      ))}
                                      {addingSectionForModuleId === mod.moduleId && (
                                        <div className="pt-1">
                                          <SectionBuilder
                                            compact
                                            callAction={callAction}
                                            editSection={secs && secs.length > 0 ? secs[0] : undefined}
                                            onSave={async (type, body) => {
                                              const existingSec = secs && secs.length > 0 ? secs[0] : null;
                                              if (existingSec) {
                                                await callAction('update_section', { moduleId: mod.moduleId, sectionId: existingSec.sectionId, contentType: type, body });
                                                setModuleSectionsMap(m => ({ ...m, [mod.moduleId]: [{ ...existingSec, contentType: type, body }] }));
                                              } else {
                                                const r = await callAction('add_section', { moduleId: mod.moduleId, order: 0, contentType: type, body }) as { success: boolean; data?: SectionRecord };
                                                if (r.success && r.data) {
                                                  setModuleSectionsMap(m => ({ ...m, [mod.moduleId]: [r.data!] }));
                                                }
                                              }
                                              setAddingSectionForModuleId(null);
                                            }}
                                          />
                                          <button type="button" onClick={() => setAddingSectionForModuleId(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">✕ Cancel</button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Add Period */}
              {addingPeriod ? (
                <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-4 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700">New Period</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      className={smallInputCls + ' flex-1 min-w-32 text-xs'}
                      value={newPeriodLabel}
                      onChange={e => setNewPeriodLabel(e.target.value)}
                      placeholder="e.g. Week 3"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') addPeriod(); if (e.key === 'Escape') setAddingPeriod(false); }}
                    />
                    <select
                      className={smallInputCls + ' w-28 text-xs'}
                      value={newPeriodType}
                      onChange={e => setNewPeriodType(e.target.value)}
                      title="Period type"
                    >
                      <option value="week">Week</option>
                      <option value="day">Day</option>
                      <option value="month">Month</option>
                      <option value="quarter">Quarter</option>
                      <option value="steps">Step</option>
                      <option value="custom">Custom</option>
                    </select>
                    <button type="button" disabled={!newPeriodLabel.trim() || addingPeriodBusy} onClick={addPeriod} className={btnPrimary}>
                      {addingPeriodBusy ? '…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setAddingPeriod(false)} className={btnSecondary}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingPeriod(true)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  + Add Period
                </button>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className={btnPrimary + ' px-6 py-2 text-sm'}
          >
            {saving ? 'Saving…' : isNew ? 'Create Program' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -- Package edit / create modal -----------------------------------------------

interface PackageFormState {
  title:                string;
  pricingModel:         string;
  currency:             string;
  priceUsd:             string;
  selectedPrograms:     string[];
  totalSeats:           string;
  showSeatsFilled:      boolean;
  applyDeadline:        string;
  discountPrice:        string;
  discountUntil:        string;
  description:          string;
  coverImageUrl:        string;
  certificateUrl:       string;
  includedProgramIds:   string[];
  certificateTemplate?: CertificateTemplate;
  certEnabled:          boolean;
}

function PackageModal({
  pkg,
  programs,
  callAction,
  onClose,
  onSaved,
  profileLogoUrl,
}: {
  pkg: PackageRecord | 'new';
  programs: ProgramRecord[];
  callAction: CallAction;
  onClose: () => void;
  onSaved: () => void;
  profileLogoUrl?: string;
}) {
  const isNew = pkg === 'new';
  const existing = isNew ? null : pkg as PackageRecord;

  const [form, setForm] = useState<PackageFormState>({
    title:               existing?.title              ?? '',
    pricingModel:        existing?.pricingModel       ?? 'one_time',
    currency:            (existing?.currencies?.[0])  ?? 'USD',
    priceUsd:            existing?.priceUsd           != null ? String(existing.priceUsd)      : '',
    selectedPrograms:    [],
    totalSeats:          existing?.totalSeats         != null ? String(existing.totalSeats)    : '',
    showSeatsFilled:     existing?.showSeatsFilled    ?? false,
    applyDeadline:       existing?.applyDeadline      ? existing.applyDeadline.slice(0, 10)   : '',
    discountPrice:       existing?.discountPrice      != null ? String(existing.discountPrice) : '',
    discountUntil:       existing?.discountUntil      ? existing.discountUntil.slice(0, 10)   : '',
    description:         existing?.description        ?? '',
    coverImageUrl:       existing?.coverImageUrl      ?? '',
    certificateUrl:      existing?.certificateUrl     ?? '',
    includedProgramIds:  existing?.includedProgramIds ?? [],
    certificateTemplate: existing?.certificateTemplate,
    certEnabled:         !!existing?.certificateTemplate,
  });
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [mounted, setMounted]             = useState(false);
  const [coverFile, setCoverFile]         = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load existing package programs when editing
  useEffect(() => {
    if (!existing) return;
    fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '', config: {}, action: 'get_package_detail', params: { packageId: existing.packageId } }),
    })
      .then(r => r.json())
      .then((res: { success: boolean; data?: { programs?: { programId: string }[] } }) => {
        if (res.success) {
          setForm(f => ({ ...f, selectedPrograms: (res.data?.programs ?? []).map(p => p.programId) }));
        }
      })
      .catch(() => {});
  }, [existing?.packageId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleProgram(id: string) {
    setForm(f => ({
      ...f,
      selectedPrograms: f.selectedPrograms.includes(id)
        ? f.selectedPrograms.filter(p => p !== id)
        : [...f.selectedPrograms, id],
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');

    // Upload cover image if a file was chosen
    let coverImageUrl = form.coverImageUrl;
    if (coverFile) {
      setCoverUploading(true);
      try {
        const supabase = createClient();
        const ext = coverFile.name.split('.').pop() ?? 'bin';
        const filePath = `packages/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('library-files').upload(filePath, coverFile);
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(filePath);
        coverImageUrl = urlData.publicUrl;
      } catch (e: unknown) {
        setError((e as Error).message);
        setSaving(false);
        setCoverUploading(false);
        return;
      }
      setCoverUploading(false);
    }

    const params: Record<string, unknown> = {
      title:        form.title.trim(),
      pricingModel: form.pricingModel,
      programIds:   form.selectedPrograms,
    };
    if (form.pricingModel !== 'free' && form.priceUsd) params.priceUsd = parseFloat(form.priceUsd);
    if (form.pricingModel !== 'free') params.currencies = [form.currency];
    if (form.totalSeats)    params.totalSeats    = parseInt(form.totalSeats, 10);
    if (form.applyDeadline) params.applyDeadline = form.applyDeadline;
    if (form.discountPrice) params.discountPrice = parseFloat(form.discountPrice);
    if (form.discountUntil) params.discountUntil = form.discountUntil;
    params.showSeatsFilled = form.showSeatsFilled;
    if (form.description.trim())      params.description          = form.description.trim();
    if (coverImageUrl.trim())         params.coverImageUrl        = coverImageUrl.trim();
    if (form.certificateUrl.trim())   params.certificateUrl       = form.certificateUrl.trim();
    if (form.includedProgramIds.length > 0) params.includedProgramIds = form.includedProgramIds;
    if (form.certificateTemplate)     params.certificateTemplate  = form.certificateTemplate;

    const action = isNew ? 'assemble_package' : 'update_package';
    if (!isNew && existing) params.packageId = existing.packageId;

    const r = await callAction(action, params) as { success: boolean; message?: string };
    setSaving(false);
    if (!r.success) { setError(r.message ?? 'Failed to save.'); return; }
    onSaved();
    onClose();
  }

  async function handlePublishToggle() {
    if (!existing) return;
    const action = existing.isPublished ? 'unpublish_package' : 'publish_package';
    await callAction(action, { packageId: existing.packageId });
    onSaved();
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[90vw] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {isNew ? 'New Package' : `Edit Package — ${existing?.title}`}
          </h2>
          <div className="flex items-center gap-3">
            {!isNew && existing && (
              <button
                type="button"
                onClick={handlePublishToggle}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  existing.isPublished
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {existing.isPublished ? 'Unpublish' : 'Publish'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Package Title</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. 6-Week Mindset Transformation"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <textarea
              rows={3}
              className={inputCls + ' resize-none'}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What will clients get out of this package?"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Thumbnail</label>
            <ThumbnailPicker
              value={coverFile ? URL.createObjectURL(coverFile) : form.coverImageUrl}
              onChange={v => { setCoverFile(null); setForm(f => ({ ...f, coverImageUrl: v })); }}
              onFileChange={f => { setCoverFile(f); setForm(prev => ({ ...prev, coverImageUrl: '' })); }}
              uploading={coverUploading}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="pkg-pricing-model" className="block text-sm font-medium text-gray-700 mb-1.5">Pricing Model</label>
              <select
                id="pkg-pricing-model"
                className={inputCls}
                value={form.pricingModel}
                onChange={e => setForm(f => ({ ...f, pricingModel: e.target.value }))}
              >
                <option value="free">Free</option>
                <option value="one_time">One-time payment</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>
            {form.pricingModel !== 'free' && (
              <>
                <div>
                  <label htmlFor="pkg-currency" className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                  <select
                    id="pkg-currency"
                    className={inputCls}
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    <option value="USD">USD — US Dollar</option>
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="AUD">AUD — Australian Dollar</option>
                    <option value="CAD">CAD — Canadian Dollar</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={form.priceUsd}
                    onChange={e => setForm(f => ({ ...f, priceUsd: e.target.value }))}
                    placeholder="e.g. 299"
                  />
                </div>
              </>
            )}
          </div>

          {/* Programs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Programs Included</label>
            {programs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No programs available. Create programs first.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {programs.map(prog => (
                  <label
                    key={prog.programId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.selectedPrograms.includes(prog.programId)
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      title={prog.title}
                      checked={form.selectedPrograms.includes(prog.programId)}
                      onChange={() => toggleProgram(prog.programId)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-800">{prog.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Seats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Seats (optional)</label>
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.totalSeats}
                onChange={e => setForm(f => ({ ...f, totalSeats: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showSeatsFilled}
                  onChange={e => setForm(f => ({ ...f, showSeatsFilled: e.target.checked }))}
                  title="Show seats filled counter"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Show seats filled counter</span>
              </label>
            </div>
          </div>

          {/* Apply deadline */}
          <div>
            <label htmlFor="pkg-apply-deadline" className="block text-sm font-medium text-gray-700 mb-1.5">Apply Deadline (optional)</label>
            <input
              id="pkg-apply-deadline"
              type="date"
              className={inputCls}
              value={form.applyDeadline}
              onChange={e => setForm(f => ({ ...f, applyDeadline: e.target.value }))}
            />
          </div>

          {/* Discount */}
          {form.pricingModel !== 'free' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount Price ({form.currency})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.discountPrice}
                  onChange={e => setForm(f => ({ ...f, discountPrice: e.target.value }))}
                  placeholder="e.g. 199"
                />
              </div>
              <div>
                <label htmlFor="pkg-discount-until" className="block text-sm font-medium text-gray-700 mb-1.5">Discount Until</label>
                <input
                  id="pkg-discount-until"
                  type="date"
                  className={inputCls}
                  value={form.discountUntil}
                  onChange={e => setForm(f => ({ ...f, discountUntil: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Certificate URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Certificate URL (optional)</label>
            <p className="text-xs text-gray-400 mb-1.5">Link to a static downloadable PDF — alternative to the designed certificate below.</p>
            <input
              type="url"
              className={inputCls}
              value={form.certificateUrl}
              onChange={e => setForm(f => ({ ...f, certificateUrl: e.target.value }))}
              placeholder="https://... (downloadable completion certificate)"
            />
          </div>

          {/* Certificate template designer */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Toggle header */}
            <button
              type="button"
              onClick={() => setForm(f => ({
                ...f,
                certEnabled: !f.certEnabled,
                certificateTemplate: f.certEnabled ? undefined : f.certificateTemplate,
              }))}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-700">Certificate Template</p>
                <p className="text-xs text-gray-400">Design the certificate graduates receive. Coach name is autofilled at graduation.</p>
              </div>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                form.certEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  form.certEnabled ? 'translate-x-4' : 'translate-x-1'
                }`} />
              </div>
            </button>
            {/* Builder (shown when enabled) */}
            {form.certEnabled && (
              <div className="border-t border-gray-200">
                <CertificateBuilder
                  initial={form.certificateTemplate}
                  packageTitle={form.title || 'Your Package'}
                  hideCoachName
                  profileLogoUrl={profileLogoUrl}
                  onChange={tmpl => setForm(f => ({ ...f, certificateTemplate: tmpl }))}
                />
              </div>
            )}
          </div>

          {/* Programs forked at graduation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Programs Forked at Graduation (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Programs that are copied into the trainee&apos;s account when they complete this package.</p>
            {programs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No programs available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {programs.map(prog => (
                  <label
                    key={prog.programId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.includedProgramIds.includes(prog.programId)
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      title={prog.title}
                      checked={form.includedProgramIds.includes(prog.programId)}
                      onChange={() => setForm(f => ({
                        ...f,
                        includedProgramIds: f.includedProgramIds.includes(prog.programId)
                          ? f.includedProgramIds.filter(id => id !== prog.programId)
                          : [...f.includedProgramIds, prog.programId],
                      }))}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm text-gray-800">{prog.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0 bg-white">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary + ' px-6 py-2 text-sm'}>
            {saving ? 'Saving…' : isNew ? 'Create Package' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// -- Main component ------------------------------------------------------------

function ContentHierarchy(
  { userId: _userId, callAction, modules, programs, packages, loading, onRefresh, activeTab = 'packages', pkgSubTab: pkgSubTabProp = 'published', newPkgTrigger = 0, newProgramTrigger = 0, newModuleTrigger = 0 }: ContentHierarchyProps
) {
  const [editPkg,     setEditPkg]     = useState<PackageRecord | 'new' | null>(null);
  const [previewPkg,  setPreviewPkg]  = useState<PackageRecord | null>(null);
  const pkgSubTab = pkgSubTabProp;
  const [editProg,    setEditProg]    = useState<ProgramRecord | 'new' | null>(null);
  const [previewProg, setPreviewProg] = useState<ProgramRecord | null>(null);
  const [editMod,     setEditMod]     = useState<ModuleRecord | 'new' | null>(null);
  const [previewMod,  setPreviewMod]  = useState<ModuleRecord | null>(null);
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!_userId) return;
    fetch(`/api/coaches/profile?userId=${encodeURIComponent(_userId)}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: { logo?: string } | null }) => {
        if (d.success && d.data?.logo) setProfileLogoUrl(d.data.logo);
      })
      .catch(() => { /* non-critical */ });
  }, [_userId]);

  useEffect(() => { if (newPkgTrigger > 0) setEditPkg('new'); }, [newPkgTrigger]);
  useEffect(() => { if (newProgramTrigger > 0) setEditProg('new'); }, [newProgramTrigger]);
  useEffect(() => { if (newModuleTrigger > 0) setEditMod('new'); }, [newModuleTrigger]);

  const initialLoading = loading && packages.length === 0 && programs.length === 0 && modules.length === 0;

  return (
    <>
      {editPkg !== null && (
        <PackageModal
          pkg={editPkg}
          programs={programs}
          callAction={callAction}
          onClose={() => setEditPkg(null)}
          onSaved={onRefresh}
          profileLogoUrl={profileLogoUrl}
        />
      )}
      {previewPkg !== null && (
        <PackagePreviewModal
          pkg={previewPkg}
          callAction={callAction}
          onClose={() => setPreviewPkg(null)}
        />
      )}
      {editProg !== null && (
        <ProgramModal
          prog={editProg}
          allModules={modules}
          callAction={callAction}
          onClose={() => setEditProg(null)}
          onSaved={onRefresh}
        />
      )}
      {previewProg !== null && (
        <ProgramPreviewModal
          prog={previewProg}
          callAction={callAction}
          onClose={() => setPreviewProg(null)}
        />
      )}
      {editMod !== null && (
        <ModuleModal
          mod={editMod}
          callAction={callAction}
          onClose={() => setEditMod(null)}
          onSaved={onRefresh}
        />
      )}
      {previewMod !== null && (
        <ModulePreviewModal
          mod={previewMod}
          callAction={callAction}
          onClose={() => setPreviewMod(null)}
        />
      )}
      {initialLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Loading content...
        </div>
      ) : (
    <div className="space-y-3">
      {/* Packages */}
      {activeTab === 'packages' && (
        <>
          {(() => {
            const published   = packages.filter(p => p.isPublished);
            const unpublished = packages.filter(p => !p.isPublished);
            const tileProps = (p: PackageRecord) => ({
              pkg: p,
              onEdit: (pkg: PackageRecord) => setEditPkg(pkg),
              onPreview: setPreviewPkg,
              onTogglePublish: async (pkg: PackageRecord) => {
                const action = pkg.isPublished ? 'unpublish_package' : 'publish_package';
                await callAction(action, { packageId: pkg.packageId });
                onRefresh();
              },
              onDelete: async (pkg: PackageRecord) => {
                if (!confirm('Delete this package? This cannot be undone.')) return;
                await callAction('delete_package', { packageId: pkg.packageId });
                onRefresh();
              },
            });
            const visible = pkgSubTab === 'published' ? published : unpublished;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AddCard label="New Package" onClick={() => setEditPkg('new')} />
                {visible.map(p => <PackageTile key={p.packageId} {...tileProps(p)} />)}
              </div>
            );
          })()}

        </>
      )}

      {/* Programs */}
      {activeTab === 'programs' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AddCard label="New Program" onClick={() => setEditProg('new')} />
            {programs.map(prog => (
              <ProgramTile
                key={prog.programId}
                program={prog}
                onEdit={p => setEditProg(p)}
                onDelete={async p => {
                  if (!confirm('Delete this program? This cannot be undone.')) return;
                  await callAction('delete_program', { programId: p.programId });
                  onRefresh();
                }}
                onPreview={p => setPreviewProg(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modules */}
      {activeTab === 'modules' && (
        <>
          {(() => {
            const tileProps = (m: ModuleRecord) => ({
              mod: m,
              onEdit: (mod: ModuleRecord) => setEditMod(mod),
              onPreview: (mod: ModuleRecord) => setPreviewMod(mod),
              onDelete: async (mod: ModuleRecord) => {
                if (!confirm('Delete this module? This cannot be undone.')) return;
                await callAction('delete_module', { moduleId: mod.moduleId });
                onRefresh();
              },
            });
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AddCard label="New Module" onClick={() => setEditMod('new')} />
                {modules.map(m => <ModuleTile key={m.moduleId} {...tileProps(m)} />)}
              </div>
            );
          })()}
        </>
      )}
    </div>
    )}
  </>
  );
}

export default ContentHierarchy;
