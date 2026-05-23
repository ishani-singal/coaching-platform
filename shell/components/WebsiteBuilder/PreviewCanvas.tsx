'use client';
import { useRef, useCallback, useState } from 'react';
import type { WebsiteComponent, NavItem } from '@coaching/sdk';
import type { TemplateDefinition } from './templates';
import ComponentBlock, { type ResizeDir } from './ComponentBlock';

interface Props {
  components: WebsiteComponent[];
  navItems: NavItem[];
  template: TemplateDefinition;
  slug: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateComponent: (id: string, partial: Partial<WebsiteComponent>) => void;
  onDeleteComponent: (id: string) => void;
}

const NAV_LABELS: Record<NavItem, string> = {
  home: 'Home', services: 'Services', events: 'Events', about: 'About',
  blog: 'Blog', faq: 'FAQ', contact: 'Contact', search: 'Search',
};

// ── Drag / Resize state held in refs (no re-render during move) ────────────────
interface DragState {
  id: string;
  startMouseX: number;
  startMouseY: number;
  origX: number;
  origY: number;
}

interface ResizeState {
  id: string;
  dir: ResizeDir;
  startMouseX: number;
  startMouseY: number;
  orig: WebsiteComponent;
}

export default function PreviewCanvas({
  components, navItems, template, slug, selectedId, onSelect, onUpdateComponent, onDeleteComponent,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [, forceRender] = useState(0);

  const handleDragStart = useCallback((id: string, startX: number, startY: number, origX: number, origY: number) => {
    dragRef.current = { id, startMouseX: startX, startMouseY: startY, origX, origY };
  }, []);

  const handleResizeStart = useCallback((id: string, dir: ResizeDir, startX: number, startY: number, orig: WebsiteComponent) => {
    resizeRef.current = { id, dir, startMouseX: startX, startMouseY: startY, orig };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      onUpdateComponent(d.id, { x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) });
      forceRender(n => n + 1);
    }
    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = e.clientX - r.startMouseX;
      const dy = e.clientY - r.startMouseY;
      const { x, y, w, h } = r.orig;
      const MIN = 60;
      const dir = r.dir;
      let nx = x, ny = y, nw = w, nh = h;

      if (dir.includes('e')) nw = Math.max(MIN, w + dx);
      if (dir.includes('s')) nh = Math.max(MIN, h + dy);
      if (dir.includes('w')) { nw = Math.max(MIN, w - dx); nx = x + (w - nw); }
      if (dir.includes('n')) { nh = Math.max(MIN, h - dy); ny = y + (h - nh); }

      onUpdateComponent(r.id, { x: nx, y: ny, w: nw, h: nh });
      forceRender(n => n + 1);
    }
  }, [onUpdateComponent]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-200 rounded-lg overflow-hidden shadow-inner">
      {/* Mock browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-300 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded text-xs text-gray-500 px-3 py-1 font-mono truncate select-all">
          {slug ? `${slug}.yourplatform.com` : 'yoursite.com'}
        </div>
      </div>

      {/* Scrollable canvas area */}
      <div className="flex-1 overflow-auto">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: 760, minHeight: 600, margin: '0 auto' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => onSelect(null)}
        >
          {/* Template page background */}
          <div className={`absolute inset-0 ${template.pageBg}`} />

          {/* Preview navbar */}
          <div className={`relative z-30 flex items-center gap-1 px-4 h-12 ${template.navbarBg}`}>
            <span className={`font-bold text-sm mr-4 ${template.navbarText}`}>{slug || 'Your Brand'}</span>
            {navItems.map(item => (
              <span
                key={item}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-default ${template.navbarText}`}
              >
                {NAV_LABELS[item]}
              </span>
            ))}
          </div>

          {/* Placed components */}
          <div className="relative" style={{ minHeight: 560 }}>
            {components.map(comp => (
              <ComponentBlock
                key={comp.id}
                component={comp}
                isSelected={selectedId === comp.id}
                template={template}
                onSelect={onSelect}
                onUpdate={onUpdateComponent}
                onDelete={onDeleteComponent}
                onDragStart={handleDragStart}
                onResizeStart={handleResizeStart}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
