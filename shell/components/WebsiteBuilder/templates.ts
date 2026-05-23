export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  // CSS class tokens for the canvas
  navbarBg: string;
  navbarText: string;
  navbarActiveBg: string;
  navbarActiveText: string;
  pageBg: string;
  headingFont: string;
  bodyFont: string;
  primaryColor: string;    // Tailwind bg class for primary accents
  primaryText: string;     // Tailwind text class for primary accents
  // Mini-preview palette (CSS hex values for the mini card)
  previewBg: string;
  previewAccent: string;
  previewBar: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean white, Inter font, subtle gray accents',
    navbarBg: 'bg-white border-b border-gray-200',
    navbarText: 'text-gray-700',
    navbarActiveBg: 'bg-gray-100',
    navbarActiveText: 'text-gray-900',
    pageBg: 'bg-white',
    headingFont: 'font-sans',
    bodyFont: 'font-sans',
    primaryColor: 'bg-gray-900',
    primaryText: 'text-gray-900',
    previewBg: '#ffffff',
    previewAccent: '#111827',
    previewBar: '#f3f4f6',
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Dark navy, large typography, high contrast',
    navbarBg: 'bg-slate-900',
    navbarText: 'text-slate-200',
    navbarActiveBg: 'bg-slate-700',
    navbarActiveText: 'text-white',
    pageBg: 'bg-slate-950',
    headingFont: 'font-black',
    bodyFont: 'font-sans',
    primaryColor: 'bg-white',
    primaryText: 'text-white',
    previewBg: '#0f172a',
    previewAccent: '#ffffff',
    previewBar: '#1e293b',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Slate tones, corporate blue, executive feel',
    navbarBg: 'bg-slate-800',
    navbarText: 'text-slate-300',
    navbarActiveBg: 'bg-blue-700',
    navbarActiveText: 'text-white',
    pageBg: 'bg-slate-50',
    headingFont: 'font-semibold',
    bodyFont: 'font-sans',
    primaryColor: 'bg-blue-700',
    primaryText: 'text-blue-700',
    previewBg: '#f8fafc',
    previewAccent: '#1d4ed8',
    previewBar: '#1e293b',
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Indigo gradient, vibrant, modern coach aesthetic',
    navbarBg: 'bg-gradient-to-r from-indigo-600 to-violet-600',
    navbarText: 'text-white',
    navbarActiveBg: 'bg-white/20',
    navbarActiveText: 'text-white',
    pageBg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
    headingFont: 'font-bold',
    bodyFont: 'font-sans',
    primaryColor: 'bg-indigo-600',
    primaryText: 'text-indigo-600',
    previewBg: '#eef2ff',
    previewAccent: '#4f46e5',
    previewBar: '#4f46e5',
  },
  {
    id: 'momentum',
    label: 'Momentum',
    description: 'Orange energy, fitness & performance coaching',
    navbarBg: 'bg-orange-600',
    navbarText: 'text-white',
    navbarActiveBg: 'bg-orange-700',
    navbarActiveText: 'text-white',
    pageBg: 'bg-gray-50',
    headingFont: 'font-extrabold',
    bodyFont: 'font-sans',
    primaryColor: 'bg-orange-500',
    primaryText: 'text-orange-500',
    previewBg: '#fff7ed',
    previewAccent: '#ea580c',
    previewBar: '#ea580c',
  },
];

export const DEFAULT_TEMPLATE_ID = 'minimal';

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
}
