'use client';
import { useState, useCallback, useEffect } from 'react';
import type { WebsiteConfig, WebsiteComponent, WebsiteComponentType, NavItem } from '@coaching/sdk';
import { getTemplate, DEFAULT_TEMPLATE_ID } from './templates';
import { getComponentDef } from './componentDefs';
import BuilderSidebar from './BuilderSidebar';
import PreviewCanvas from './PreviewCanvas';

interface Profile {
  slug: string;
  displayName: string;
  bio?: string;
  websiteNavBar?: NavItem[];
  websiteDraft?: WebsiteConfig | null;
}

interface Props {
  profile: Profile;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function WebsiteBuilderShell({ profile }: Props) {
  const [draft, setDraft] = useState<WebsiteConfig>(() => {
    if (profile.websiteDraft) return profile.websiteDraft;
    return { templateId: DEFAULT_TEMPLATE_ID, components: [] };
  });
  const [navItems, setNavItems] = useState<NavItem[]>(profile.websiteNavBar ?? ['home', 'services']);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [navSaving, setNavSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const template = getTemplate(draft.templateId);

  const selectedComponent = draft.components.find(c => c.id === selectedId) ?? null;

  // ── Persist draft to server (debounced via explicit save) ──────────────────
  const saveDraft = useCallback(async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const r = await fetch('/api/website/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft }),
      }).then(x => x.json()) as { success: boolean };
      setStatusMsg(r.success ? '✓ Draft saved' : '✗ Save failed');
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const publish = useCallback(async () => {
    // save draft first, then publish
    setPublishing(true);
    setStatusMsg('');
    try {
      await fetch('/api/website/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: draft }),
      });
      const r = await fetch('/api/website/publish', { method: 'POST' }).then(x => x.json()) as { success: boolean };
      setStatusMsg(r.success ? '✓ Published! Visitors can now see your site.' : '✗ Publish failed');
    } finally {
      setPublishing(false);
    }
  }, [draft]);

  const saveNav = useCallback(async () => {
    setNavSaving(true);
    await fetch('/api/coaches/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ navItems }),
    });
    setNavSaving(false);
  }, [navItems]);

  // ── Template selection — pre-fills account info into components ────────────
  const handleSelectTemplate = useCallback((templateId: string) => {
    setDraft(prev => {
      // Preserve existing components but update templateId
      // If no hero exists yet, auto-insert one pre-filled with account data
      const hasHero = prev.components.some(c => c.type === 'hero');
      const newComponents = hasHero ? prev.components : [
        {
          id: makeId(),
          type: 'hero' as WebsiteComponentType,
          x: 40,
          y: 60,
          w: 680,
          h: 240,
          props: {
            heading: profile.displayName || 'Your Name',
            subheading: profile.bio?.slice(0, 100) || 'Helping you unlock your potential',
            ctaText: 'Book a Free Call',
            ctaUrl: `/coaches/${profile.slug}/book`,
          },
        },
      ];
      return { ...prev, templateId, components: newComponents };
    });
  }, [profile]);

  // ── Component CRUD ─────────────────────────────────────────────────────────
  const handleAddComponent = useCallback((type: WebsiteComponentType) => {
    const def = getComponentDef(type);
    // Find a free vertical slot
    const maxY = draft.components.reduce((m, c) => Math.max(m, c.y + c.h), 60);
    const props = { ...def.defaultProps };
    // Auto-fill from account for hero type
    if (type === 'hero') {
      props.heading = profile.displayName || def.defaultProps.heading;
      props.subheading = profile.bio?.slice(0, 100) || def.defaultProps.subheading;
      props.ctaUrl = `/coaches/${profile.slug}/book`;
    }
    const newComp: WebsiteComponent = {
      id: makeId(),
      type,
      x: 40,
      y: maxY + 16,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      props,
    };
    setDraft(prev => ({ ...prev, components: [...prev.components, newComp] }));
    setSelectedId(newComp.id);
  }, [draft.components, profile]);

  const handleUpdateComponent = useCallback((id: string, partial: Partial<WebsiteComponent>) => {
    setDraft(prev => ({
      ...prev,
      components: prev.components.map(c => c.id === id ? { ...c, ...partial } : c),
    }));
  }, []);

  const handleUpdateComponentProp = useCallback((id: string, key: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c
      ),
    }));
  }, []);

  const handleDeleteComponent = useCallback((id: string) => {
    setDraft(prev => ({ ...prev, components: prev.components.filter(c => c.id !== id) }));
    setSelectedId(null);
  }, []);

  // Clear status message after 4s
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(''), 4000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Website Builder</span>
          {profile.slug && (
            <a
              href={`/coaches/${profile.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-500 hover:underline"
            >
              ↗ View live site
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className={`text-xs ${statusMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {statusMsg}
            </span>
          )}
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Preview canvas — takes ~65% */}
        <div className="flex-1 overflow-hidden p-4">
          <PreviewCanvas
            components={draft.components}
            navItems={navItems}
            template={template}
            slug={profile.slug}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdateComponent={handleUpdateComponent}
            onDeleteComponent={handleDeleteComponent}
          />
        </div>

        {/* Sidebar — fixed 300px */}
        <div className="w-[300px] shrink-0 overflow-y-auto border-l border-gray-200">
          <BuilderSidebar
            currentTemplateId={draft.templateId}
            navItems={navItems}
            navSaving={navSaving}
            selectedComponent={selectedComponent}
            onSelectTemplate={handleSelectTemplate}
            onNavChange={setNavItems}
            onNavSave={saveNav}
            onAddComponent={handleAddComponent}
            onUpdateComponentProp={handleUpdateComponentProp}
            onDeleteComponent={handleDeleteComponent}
          />
        </div>
      </div>
    </div>
  );
}
