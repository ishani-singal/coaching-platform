'use client';
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CopilotKit, useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useSession } from '@/components/SessionProvider';
import ContentHierarchy from '@/components/ContentHierarchy';

// -- Types (mirrored from ContentHierarchy for callAction return shapes) -------

interface ModuleRecord  { moduleId: string; title: string; category: string; }
interface ProgramRecord { programId: string; title: string; periodCount?: number; moduleCount?: number; coverImageUrl?: string; }
interface PackageRecord { packageId: string; title: string; pricingModel: string; isPublished: boolean; priceUsd?: number; currencies: string[]; totalSeats?: number; showSeatsFilled?: boolean; applyDeadline?: string; discountPrice?: number; discountUntil?: string; description?: string; coverImageUrl?: string; certificateUrl?: string; includedProgramIds?: string[]; }

// -- Shared ToolCallCard used by all useCopilotAction render props -------------

function ToolCallCard({ status, label, type, subtitle }: {
  status:    string;
  label:     string;
  type:      'module' | 'program' | 'package' | 'section';
  subtitle?: string;
}) {
  const colors: Record<string, string> = {
    module:  'border-indigo-100 bg-indigo-50',
    program: 'border-purple-100 bg-purple-50',
    package: 'border-green-100  bg-green-50',
    section: 'border-gray-100   bg-gray-50',
  };
  const textColors: Record<string, string> = {
    module: 'text-indigo-800', program: 'text-purple-800',
    package: 'text-green-800', section: 'text-gray-700',
  };
  const done = status === 'complete';
  return (
    <div className={`rounded-xl border ${colors[type]} px-3 py-2.5 text-xs max-w-xs flex items-start gap-2.5`}>
      {!done
        ? <span className="mt-0.5 shrink-0 w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
        : <span className="mt-0.5 shrink-0 leading-none">✓</span>
      }
      <div>
        <p className={`font-medium ${textColors[type]}`}>{label}</p>
        {subtitle && <p className="opacity-60 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// -- Root page (CopilotKit provider) ------------------------------------------

export default function ProgramsPage() {
  const { userId } = useSession();
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
    >
      <ProgramBuilderInner userId={userId} />
    </CopilotKit>
  );
}

// -- Inner component (must be inside CopilotKit to use hooks) -----------------

type ContentTab = 'packages' | 'programs' | 'modules';

function ProgramBuilderInner({ userId }: { userId: string }) {
  const [modules,    setModules]    = useState<ModuleRecord[]>([]);
  const [programs,   setPrograms]   = useState<ProgramRecord[]>([]);
  const [packages,   setPackages]   = useState<PackageRecord[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchParams = useSearchParams();
  const activeTab: ContentTab = (searchParams.get('tab') as ContentTab) ?? 'packages';
  const [newPkgTrigger, setNewPkgTrigger] = useState(0);
  const [newProgramTrigger, setNewProgramTrigger] = useState(0);
  const [newModuleTrigger, setNewModuleTrigger] = useState(0);
  const [pkgSubTab, setPkgSubTab] = useState<'published' | 'unpublished'>('published');
  const [enrollOpen,   setEnrollOpen]   = useState(false);
  const [enrollForm,   setEnrollForm]   = useState({ packageId: '', clientName: '', clientEmail: '', enrollmentType: 'client', customPrice: '', discountAmount: '' });
  const [enrollStatus, setEnrollStatus] = useState('');
  const [enrollPortalUrl, setEnrollPortalUrl] = useState('');
  const [licenseOpen,      setLicenseOpen]      = useState(false);
  const [licenseForm,      setLicenseForm]      = useState({ programId: '', licenseeEmail: '', licenseFeeAmount: '', licenseFeeCurrency: 'USD' });
  const [licenseStatus,    setLicenseStatus]    = useState('');
  const [licenseDashboard, setLicenseDashboard] = useState<{ granted: unknown[]; held: unknown[]; revenueThisMonth: number } | null>(null);

  useEffect(() => {
    if (!licenseOpen || !userId) return;
    fetch('/api/agents/coaching-licensing/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action: 'get_license_dashboard', params: {} }),
    }).then(r => r.json()).then(r => setLicenseDashboard((r as { data?: { granted: unknown[]; held: unknown[]; revenueThisMonth: number } }).data ?? null));
  }, [licenseOpen, userId]);

  const callAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config: {}, action, params }),
    });
    return res.json();
  }, [userId]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    callAction('load_all', {})
      .then((res) => {
        const r = res as { success: boolean; data?: { modules?: ModuleRecord[]; programs?: (ProgramRecord & { periods?: { modules?: unknown[] }[] })[]; packages?: (PackageRecord & Record<string, unknown>)[] } };
        if (r.success && r.data) {
          setModules(r.data.modules ?? []);
          const rawProgs = r.data.programs ?? [];
          setPrograms(rawProgs.map(p => ({
            programId:     p.programId,
            title:         p.title,
            periodCount:   p.periods?.length ?? 0,
            moduleCount:   p.periods?.reduce((acc, period) => acc + ((period as { modules?: unknown[] }).modules?.length ?? 0), 0) ?? 0,
            coverImageUrl: p.coverImageUrl,
          })));
          const rawPkgs = r.data.packages ?? [];
          setPackages(rawPkgs.map(p => ({
            ...p,
            isPublished: Boolean(p.isPublished ?? p.is_published ?? false),
            currencies:  (p.currencies ?? ['USD']),
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [callAction, refreshKey]);

  // -- Context visible to Claude -----------------------------------------------

  useCopilotReadable({ description: 'Current coaching modules', value: modules });
  useCopilotReadable({ description: 'Current programs',         value: programs });
  useCopilotReadable({ description: 'Current packages',         value: packages });

  // -- Tool registrations -------------------------------------------------------

  useCopilotAction({
    name: 'create_module',
    description: 'Create a new coaching module',
    parameters: [
      { name: 'title',    type: 'string', required: true, description: 'Module title' },
      { name: 'category', type: 'string', required: true, description: 'Category: mindset|nutrition|fitness|business|leadership|wellness|productivity' },
    ],
    handler: async ({ title, category }) => {
      const r = await callAction('create_module', { title, category });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Creating module "${args.title}"…` : `Created module "${args.title}"`}
        type="module"
        subtitle={args.category}
      />
    ),
  });

  useCopilotAction({
    name: 'update_module',
    description: 'Edit a module title or category',
    parameters: [
      { name: 'moduleId', type: 'string', required: true },
      { name: 'title',    type: 'string' },
      { name: 'category', type: 'string' },
    ],
    handler: async ({ moduleId, title, category }) => {
      const r = await callAction('update_module', { moduleId, title, category });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'delete_module',
    description: 'Delete a module',
    parameters: [{ name: 'moduleId', type: 'string', required: true }],
    handler: async ({ moduleId }) => {
      const r = await callAction('delete_module', { moduleId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'add_section',
    description: 'Add a content section to a module. contentType: text|video|long_form_qa|single_choice|multi_choice|match_following|rating|assignment|file',
    parameters: [
      { name: 'moduleId',    type: 'string', required: true },
      { name: 'order',       type: 'number', required: true, description: 'Zero-based section position' },
      { name: 'contentType', type: 'string', required: true },
      { name: 'body',        type: 'object', required: true, description: 'Section body: text→{content}, video→{embedUrl}, long_form_qa→{questions:[{question}]}, single_choice→{question,options:[],correctIndices:[]}, rating→{question,scale}' },
    ],
    handler: async ({ moduleId, order, contentType, body }) => {
      const r = await callAction('add_section', { moduleId, order, contentType, body });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Adding ${args.contentType} section…` : `Added ${args.contentType} section`}
        type="section"
      />
    ),
  });

  useCopilotAction({
    name: 'update_section',
    description: 'Edit an existing section in a module',
    parameters: [
      { name: 'moduleId',    type: 'string', required: true },
      { name: 'sectionId',   type: 'string', required: true },
      { name: 'contentType', type: 'string', required: true },
      { name: 'body',        type: 'object', required: true },
    ],
    handler: async ({ moduleId, sectionId, contentType, body }) => {
      const r = await callAction('update_section', { moduleId, sectionId, contentType, body });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'delete_section',
    description: 'Delete a section from a module',
    parameters: [
      { name: 'moduleId',  type: 'string', required: true },
      { name: 'sectionId', type: 'string', required: true },
    ],
    handler: async ({ moduleId, sectionId }) => {
      const r = await callAction('delete_section', { moduleId, sectionId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'build_program',
    description: 'Build a flat (no timeline) program from existing modules',
    parameters: [
      { name: 'title',     type: 'string', required: true },
      { name: 'moduleIds', type: 'string[]', required: true },
    ],
    handler: async ({ title, moduleIds }) => {
      const r = await callAction('build_program', { title, moduleIds });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Building program "${args.title}"…` : `Built program "${args.title}"`}
        type="program"
      />
    ),
  });

  useCopilotAction({
    name: 'build_program_with_periods',
    description: 'Build a timeline program with weekly/monthly/step-based periods, each containing modules',
    parameters: [
      { name: 'title',       type: 'string',   required: true },
      { name: 'description', type: 'string' },
      { name: 'periods',     type: 'object[]', required: true, description: 'Array of { label, periodType (week|month|day|steps|custom), moduleIds }' },
    ],
    handler: async ({ title, description, periods }) => {
      const r = await callAction('build_program_with_periods', { title, description, periods });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Building program "${args.title}"…` : `Built program "${args.title}"`}
        type="program"
        subtitle={`${(args.periods as unknown[])?.length ?? 0} period(s)`}
      />
    ),
  });

  useCopilotAction({
    name: 'create_inline_module',
    description: 'Create a new module and immediately assign it to a period in an existing program',
    parameters: [
      { name: 'programId',    type: 'string', required: true },
      { name: 'periodOrder',  type: 'number', required: true },
      { name: 'title',        type: 'string', required: true },
      { name: 'category',     type: 'string', required: true },
      { name: 'displayOrder', type: 'number', required: true },
    ],
    handler: async ({ programId, periodOrder, title, category, displayOrder }) => {
      const r = await callAction('create_inline_module', { programId, periodOrder, title, category, displayOrder });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Creating module "${args.title}"…` : `Created module "${args.title}"`}
        type="module"
        subtitle={args.category as string}
      />
    ),
  });

  useCopilotAction({
    name: 'update_program',
    description: 'Edit a program title or description',
    parameters: [
      { name: 'programId',   type: 'string', required: true },
      { name: 'title',       type: 'string' },
      { name: 'description', type: 'string' },
    ],
    handler: async ({ programId, title, description }) => {
      const r = await callAction('update_program', { programId, title, description });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'delete_program',
    description: 'Delete a program',
    parameters: [{ name: 'programId', type: 'string', required: true }],
    handler: async ({ programId }) => {
      const r = await callAction('delete_program', { programId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'add_module_to_period',
    description: 'Assign an existing module to a period in a program',
    parameters: [
      { name: 'programId',    type: 'string', required: true },
      { name: 'moduleId',     type: 'string', required: true },
      { name: 'periodOrder',  type: 'number', required: true },
      { name: 'displayOrder', type: 'number', required: true },
    ],
    handler: async ({ programId, moduleId, periodOrder, displayOrder }) => {
      const r = await callAction('add_module_to_period', { programId, moduleId, periodOrder, displayOrder });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'create_program_period',
    description: 'Add a new period to an existing program',
    parameters: [
      { name: 'programId',   type: 'string', required: true },
      { name: 'periodOrder', type: 'number', required: true },
      { name: 'label',       type: 'string', required: true },
      { name: 'periodType',  type: 'string', required: true, description: 'week|day|month|quarter|steps|custom' },
    ],
    handler: async ({ programId, periodOrder, label, periodType }) => {
      const r = await callAction('create_program_period', { programId, periodOrder, label, periodType });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'delete_program_period',
    description: 'Delete a period from a program',
    parameters: [
      { name: 'programId',   type: 'string', required: true },
      { name: 'periodOrder', type: 'number', required: true },
    ],
    handler: async ({ programId, periodOrder }) => {
      const r = await callAction('delete_program_period', { programId, periodOrder });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'rename_program_period',
    description: 'Rename a period label in a program',
    parameters: [
      { name: 'programId',   type: 'string', required: true },
      { name: 'periodOrder', type: 'number', required: true },
      { name: 'label',       type: 'string', required: true },
    ],
    handler: async ({ programId, periodOrder, label }) => {
      const r = await callAction('update_program_period', { programId, periodOrder, label });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  useCopilotAction({
    name: 'assemble_package',
    description: 'Create a new coaching package from existing programs',
    parameters: [
      { name: 'title',          type: 'string',   required: true },
      { name: 'programIds',     type: 'string[]', required: true },
      { name: 'pricingModel',   type: 'string',   required: true, description: 'free|one_time|subscription' },
      { name: 'priceUsd',       type: 'number' },
      { name: 'currencies',     type: 'string[]' },
      { name: 'totalSeats',     type: 'number' },
      { name: 'showSeatsFilled', type: 'boolean' },
      { name: 'applyDeadline',  type: 'string', description: 'ISO date string' },
      { name: 'discountPrice',  type: 'number' },
      { name: 'discountUntil',  type: 'string' },
    ],
    handler: async (params) => {
      const r = await callAction('assemble_package', params as Record<string, unknown>);
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Assembling package "${args.title}"…` : `Assembled package "${args.title}"`}
        type="package"
        subtitle={`${(args.pricingModel as string)?.replace('_', ' ')} · ${(args.programIds as string[])?.length ?? 0} program(s)`}
      />
    ),
  });

  useCopilotAction({
    name: 'update_package',
    description: 'Update an existing package settings, pricing, or programs',
    parameters: [
      { name: 'packageId',      type: 'string', required: true },
      { name: 'title',          type: 'string', required: true },
      { name: 'pricingModel',   type: 'string', required: true },
      { name: 'priceUsd',       type: 'number' },
      { name: 'currencies',     type: 'string[]' },
      { name: 'totalSeats',     type: 'number' },
      { name: 'showSeatsFilled', type: 'boolean' },
      { name: 'applyDeadline',  type: 'string' },
      { name: 'discountPrice',  type: 'number' },
      { name: 'discountUntil',  type: 'string' },
    ],
    handler: async (params) => {
      const r = await callAction('update_package', params as Record<string, unknown>);
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ args, status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? `Updating package "${args.title}"…` : `Updated package "${args.title}"`}
        type="package"
      />
    ),
  });

  useCopilotAction({
    name: 'publish_package',
    description: 'Publish a package to make it publicly visible on the coach page',
    parameters: [{ name: 'packageId', type: 'string', required: true }],
    handler: async ({ packageId }) => {
      const r = await callAction('publish_package', { packageId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? 'Publishing package…' : 'Package published ✓'}
        type="package"
      />
    ),
  });

  useCopilotAction({
    name: 'unpublish_package',
    description: 'Unpublish a package (hides it from the coach page)',
    parameters: [{ name: 'packageId', type: 'string', required: true }],
    handler: async ({ packageId }) => {
      const r = await callAction('unpublish_package', { packageId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
    render: ({ status }) => (
      <ToolCallCard
        status={status}
        label={status !== 'complete' ? 'Unpublishing package…' : 'Package unpublished'}
        type="package"
      />
    ),
  });

  useCopilotAction({
    name: 'delete_package',
    description: 'Delete a package permanently',
    parameters: [{ name: 'packageId', type: 'string', required: true }],
    handler: async ({ packageId }) => {
      const r = await callAction('delete_package', { packageId });
      if ((r as { success: boolean }).success) refresh();
      return r;
    },
  });

  // -- Layout ------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -mx-8 -my-8 overflow-hidden">
      {/* Action buttons */}
      <div className="px-8 pt-4 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-end">
          {activeTab === 'packages' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setEnrollStatus(''); setEnrollOpen(true); }}
                className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                </svg>
                Enroll
              </button>
              <button
                type="button"
                onClick={() => { setLicenseStatus(''); setLicenseOpen(true); }}
                className="border border-purple-600 text-purple-600 hover:bg-purple-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                License
              </button>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewModuleTrigger(t => t + 1)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                New Module
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Content row: sidebar + scrollable area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Published/Unpublished sidebar — packages tab only */}
        {activeTab === 'packages' && (
          <nav className="group/pkgsidebar shrink-0 w-[52px] hover:w-48 transition-[width] duration-200 overflow-hidden bg-white border-r flex flex-col">
            <div className="pt-3">
              {([
                { id: 'published' as const, label: 'Published', icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                )},
                { id: 'unpublished' as const, label: 'Unpublished', icon: (
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )},
              ] as { id: 'published' | 'unpublished'; label: string; icon: React.ReactNode }[]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPkgSubTab(tab.id)}
                  className={`flex items-center gap-3 w-full px-3.5 py-3 transition-colors ${
                    pkgSubTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {tab.icon}
                  <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover/pkgsidebar:opacity-100 transition-opacity duration-150">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        )}
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <ContentHierarchy
          userId={userId}
          callAction={callAction}
          modules={modules}
          programs={programs}
          packages={packages}
          loading={loading}
          onRefresh={refresh}
          activeTab={activeTab}
          newPkgTrigger={newPkgTrigger}
          newProgramTrigger={newProgramTrigger}
          newModuleTrigger={newModuleTrigger}
          pkgSubTab={pkgSubTab}
        />
      </div>
      </div>

      {/* Enroll modal */}
      {enrollOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setEnrollOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Enroll Client / Trainee</h2>
              <button type="button" onClick={() => setEnrollOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={async e => {
                e.preventDefault();
                setEnrollStatus('');
                setEnrollPortalUrl('');
                const r = await fetch('/api/agents/coaching-program-runner/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, config: {}, action: 'enroll_client', params: {
                    ...enrollForm,
                    customPrice:    enrollForm.customPrice    ? parseFloat(enrollForm.customPrice)    : undefined,
                    discountAmount: enrollForm.discountAmount ? parseFloat(enrollForm.discountAmount) : undefined,
                  } }),
                }).then(res => res.json()) as { success: boolean; message: string; data: { portalUrl: string } };
                if (r.success) {
                  setEnrollStatus('✓ Enrolled successfully');
                  if (r.data?.portalUrl) {
                    try {
                      const parsed = new URL(r.data.portalUrl);
                      setEnrollPortalUrl(window.location.origin + parsed.pathname);
                    } catch {
                      setEnrollPortalUrl('');
                    }
                  }
                  setEnrollForm({ packageId: '', clientName: '', clientEmail: '', enrollmentType: 'client', customPrice: '', discountAmount: '' });
                } else {
                  setEnrollStatus(`✗ ${r.message}`);
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Package</label>
                <select
                  aria-label="Package"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={enrollForm.packageId}
                  onChange={e => setEnrollForm(f => ({ ...f, packageId: e.target.value }))}
                  required
                >
                  <option value="">Select a package…</option>
                  {packages.map(p => (
                    <option key={p.packageId} value={p.packageId}>
                      {p.title}{!p.isPublished ? ' (draft)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Client Name</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Full name"
                  value={enrollForm.clientName}
                  onChange={e => setEnrollForm(f => ({ ...f, clientName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="client@example.com"
                  value={enrollForm.clientEmail}
                  onChange={e => setEnrollForm(f => ({ ...f, clientEmail: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Enrollment Type</label>
                <select
                  aria-label="Enrollment Type"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={enrollForm.enrollmentType}
                  onChange={e => setEnrollForm(f => ({ ...f, enrollmentType: e.target.value }))}
                >
                  <option value="client">Client</option>
                  <option value="trainee">Trainee</option>
                </select>
              </div>
              {enrollForm.packageId && (() => {
                const pkg = packages.find(p => p.packageId === enrollForm.packageId);
                const defaultLabel = pkg?.pricingModel === 'free' ? 'Free' : pkg?.priceUsd != null ? `Default: $${pkg.priceUsd}` : 'No default price';
                return (
                  <div className="space-y-4 border border-gray-100 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pricing Override (optional)</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                        Custom Cost (USD)
                        <span className="ml-1 normal-case font-normal text-gray-400">— {defaultLabel}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        placeholder="Leave blank to use package default"
                        value={enrollForm.customPrice}
                        onChange={e => setEnrollForm(f => ({ ...f, customPrice: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Discount Amount (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                        placeholder="e.g. 50"
                        value={enrollForm.discountAmount}
                        onChange={e => setEnrollForm(f => ({ ...f, discountAmount: e.target.value }))}
                      />
                      {enrollForm.customPrice || enrollForm.discountAmount ? (
                        <p className="text-xs text-gray-400 mt-1">
                          Effective price: ${
                            Math.max(0,
                              (parseFloat(enrollForm.customPrice || '0') || (packages.find(p => p.packageId === enrollForm.packageId)?.priceUsd ?? 0))
                              - (parseFloat(enrollForm.discountAmount || '0') || 0)
                            ).toFixed(2)
                          }
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
              {enrollStatus && (
                <div className={`text-xs break-all rounded-lg px-3 py-2 ${
                  enrollStatus.startsWith('✓')
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  <p>{enrollStatus}</p>
                  {enrollPortalUrl && (
                    <a
                      href={enrollPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium mt-1 inline-block"
                    >
                      Open Client Portal →
                    </a>
                  )}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Enroll
              </button>
            </form>
          </div>
        </div>
      )}

      {/* License modal */}
      {licenseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setLicenseOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">License Package / Program</h2>
              <button type="button" onClick={() => setLicenseOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>



            <form
              className="space-y-4"
              onSubmit={async e => {
                e.preventDefault();
                setLicenseStatus('');
                const r = await fetch('/api/agents/coaching-licensing/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, config: {}, action: 'send_license_invitation', params: { ...licenseForm, licenseFeeAmount: parseFloat(licenseForm.licenseFeeAmount) || 0 } }),
                }).then(res => res.json()) as { success: boolean; message: string };
                if (r.success) {
                  setLicenseStatus('✓ Invitation sent — check their inbox');
                  setLicenseForm({ programId: '', licenseeEmail: '', licenseFeeAmount: '', licenseFeeCurrency: 'USD' });
                  fetch('/api/agents/coaching-licensing/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, config: {}, action: 'get_license_dashboard', params: {} }),
                  }).then(res => res.json()).then(res => setLicenseDashboard((res as { data?: { granted: unknown[]; held: unknown[]; revenueThisMonth: number } }).data ?? null));
                } else {
                  setLicenseStatus('✗ ' + r.message);
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Program</label>
                <select
                  aria-label="Program to license"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  value={licenseForm.programId}
                  onChange={e => setLicenseForm(f => ({ ...f, programId: e.target.value }))}
                  required
                >
                  <option value="">Select a program…</option>
                  {programs.map(p => (
                    <option key={p.programId} value={p.programId}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Licensee Coach Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  placeholder="coach@example.com"
                  value={licenseForm.licenseeEmail}
                  onChange={e => setLicenseForm(f => ({ ...f, licenseeEmail: e.target.value }))}
                  required
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">One-Time Fee</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={licenseForm.licenseFeeAmount}
                    onChange={e => setLicenseForm(f => ({ ...f, licenseFeeAmount: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Currency</label>
                  <select
                    aria-label="License fee currency"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    value={licenseForm.licenseFeeCurrency}
                    onChange={e => setLicenseForm(f => ({ ...f, licenseFeeCurrency: e.target.value }))}
                  >
                    {['USD','EUR','GBP','INR','AUD','CAD','JPY','SGD'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {licenseStatus && (
                <p className={`text-xs rounded-lg px-3 py-2 ${
                  licenseStatus.startsWith('✓')
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>{licenseStatus}</p>
              )}
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Send Invitation
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
