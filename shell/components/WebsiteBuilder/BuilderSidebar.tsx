'use client';
import { useState, useCallback } from 'react';
import type { NavItem, WebsiteComponent, WebsiteComponentType } from '@coaching/sdk';
import type { TemplateDefinition } from './templates';
import { TEMPLATES } from './templates';
import { COMPONENT_DEFS, getComponentDef, type EditField } from './componentDefs';

const ALL_NAV_ITEMS: { value: NavItem; label: string }[] = [
  { value: 'home',     label: 'Home' },
  { value: 'services', label: 'Services' },
  { value: 'events',   label: 'Events' },
  { value: 'about',    label: 'About Us' },
  { value: 'blog',     label: 'Blog' },
  { value: 'faq',      label: 'FAQ' },
  { value: 'contact',  label: 'Contact Us' },
  { value: 'search',   label: 'Search' },
];

interface Props {
  currentTemplateId: string;
  navItems: NavItem[];
  navSaving: boolean;
  selectedComponent: WebsiteComponent | null;
  onSelectTemplate: (id: string) => void;
  onNavChange: (items: NavItem[]) => void;
  onNavSave: () => void;
  onAddComponent: (type: WebsiteComponentType) => void;
  onUpdateComponentProp: (id: string, key: string, value: string) => void;
  onDeleteComponent: (id: string) => void;
}

type SectionId = 'templates' | 'navigation' | 'components' | 'edit';

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
    >
      <span>{label}</span>
      <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function TemplateMiniPreview({ tpl, selected, onSelect }: { tpl: TemplateDefinition; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-indigo-500 shadow-md' : 'border-gray-200 hover:border-indigo-300'}`}
    >
      {/* Mini chrome */}
      <div className="flex gap-1 px-2 py-1.5" style={{ background: tpl.previewBar }}>
        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
      </div>
      {/* Mini page */}
      <div className="h-12 flex flex-col px-2 py-1 gap-1" style={{ background: tpl.previewBg }}>
        <div className="h-1.5 rounded-full w-1/2" style={{ background: tpl.previewAccent, opacity: 0.9 }} />
        <div className="h-1 rounded-full w-3/4 bg-gray-300" />
        <div className="h-1 rounded-full w-1/2 bg-gray-200" />
        <div className="mt-0.5 h-2 rounded w-1/3" style={{ background: tpl.previewAccent }} />
      </div>
      <div className="px-2 py-1.5 bg-white">
        <p className="text-xs font-medium text-gray-700">{tpl.label}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{tpl.description}</p>
      </div>
    </button>
  );
}

function EditPanel({ component, onUpdateProp, onDelete }: {
  component: WebsiteComponent;
  onUpdateProp: (key: string, value: string) => void;
  onDelete: () => void;
}) {
  const def = getComponentDef(component.type);

  function renderField(field: EditField) {
    const value = component.props[field.key] ?? def.defaultProps[field.key] ?? '';
    if (field.type === 'textarea') {
      return (
        <textarea
          key={field.key}
          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-indigo-400"
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={e => onUpdateProp(field.key, e.target.value)}
        />
      );
    }
    if (field.type === 'color') {
      return (
        <div key={field.key} className="flex items-center gap-2">
          <input
            type="color"
            className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
            value={value || '#000000'}
            onChange={e => onUpdateProp(field.key, e.target.value)}
          />
          <input
            type="text"
            className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="#000000"
            value={value}
            onChange={e => onUpdateProp(field.key, e.target.value)}
          />
        </div>
      );
    }
    return (
      <input
        key={field.key}
        type={field.type === 'url' ? 'url' : 'text'}
        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        placeholder={field.placeholder}
        value={value}
        onChange={e => onUpdateProp(field.key, e.target.value)}
      />
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-700">{def.label}</p>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 font-medium"
        >
          Delete
        </button>
      </div>
      {def.editFields.map(field => (
        <div key={field.key}>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-0.5">{field.label}</label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}

export default function BuilderSidebar({
  currentTemplateId, navItems, navSaving, selectedComponent,
  onSelectTemplate, onNavChange, onNavSave, onAddComponent,
  onUpdateComponentProp, onDeleteComponent,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    templates: true,
    navigation: true,
    components: true,
    edit: true,
  });

  const toggle = useCallback((id: SectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 overflow-y-auto">
      {/* Edit panel — shown when a component is selected */}
      {selectedComponent && (
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <span className="text-xs font-semibold text-indigo-700">Edit Component</span>
          </div>
          <EditPanel
            component={selectedComponent}
            onUpdateProp={(key, value) => onUpdateComponentProp(selectedComponent.id, key, value)}
            onDelete={() => onDeleteComponent(selectedComponent.id)}
          />
        </div>
      )}

      {/* Templates section */}
      <div className="border-b border-gray-200">
        <SectionHeader label="Templates" open={openSections.templates} onToggle={() => toggle('templates')} />
        {openSections.templates && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-2.5">
            {TEMPLATES.map(tpl => (
              <TemplateMiniPreview
                key={tpl.id}
                tpl={tpl}
                selected={tpl.id === currentTemplateId}
                onSelect={() => onSelectTemplate(tpl.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Navigation section */}
      <div className="border-b border-gray-200">
        <SectionHeader label="Navigation" open={openSections.navigation} onToggle={() => toggle('navigation')} />
        {openSections.navigation && (
          <div className="px-4 pb-4">
            <p className="text-[10px] text-gray-400 mb-3 uppercase tracking-wide">Choose which tabs appear on your public site</p>
            <div className="space-y-1.5">
              {ALL_NAV_ITEMS.map(item => (
                <label key={item.value} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-indigo-600"
                    checked={navItems.includes(item.value)}
                    disabled={item.value === 'home'}
                    onChange={e => {
                      if (item.value === 'home') return;
                      onNavChange(
                        e.target.checked
                          ? [...navItems, item.value]
                          : navItems.filter(v => v !== item.value)
                      );
                    }}
                  />
                  <span className={`text-xs ${item.value === 'home' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {item.label}
                    {item.value === 'home' && <span className="ml-1 text-[10px] text-gray-400">(always on)</span>}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={onNavSave}
              disabled={navSaving}
              className="mt-3 w-full bg-indigo-600 text-white rounded-md py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {navSaving ? 'Saving…' : 'Save Navigation'}
            </button>
          </div>
        )}
      </div>

      {/* Add Components section */}
      <div>
        <SectionHeader label="Add Components" open={openSections.components} onToggle={() => toggle('components')} />
        {openSections.components && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            {COMPONENT_DEFS.map(def => (
              <button
                key={def.type}
                type="button"
                onClick={() => onAddComponent(def.type)}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={def.icon} />
                </svg>
                <span className="text-[10px] text-gray-600 font-medium leading-tight">{def.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
