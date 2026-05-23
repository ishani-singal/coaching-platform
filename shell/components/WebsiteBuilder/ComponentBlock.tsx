'use client';
import { useRef, useCallback } from 'react';
import type { WebsiteComponent } from '@coaching/sdk';
import type { TemplateDefinition } from './templates';
import { getComponentDef } from './componentDefs';

interface Props {
  component: WebsiteComponent;
  isSelected: boolean;
  template: TemplateDefinition;
  onSelect: (id: string) => void;
  onUpdate: (id: string, partial: Partial<WebsiteComponent>) => void;
  onDelete: (id: string) => void;
  // canvas-level drag/resize coordination
  onDragStart: (id: string, startX: number, startY: number, origX: number, origY: number) => void;
  onResizeStart: (id: string, dir: ResizeDir, startX: number, startY: number, orig: WebsiteComponent) => void;
}

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLE_DIRS: ResizeDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

function handleCursor(dir: ResizeDir): string {
  const map: Record<ResizeDir, string> = {
    n: 'cursor-n-resize', s: 'cursor-s-resize',
    e: 'cursor-e-resize', w: 'cursor-w-resize',
    ne: 'cursor-ne-resize', nw: 'cursor-nw-resize',
    se: 'cursor-se-resize', sw: 'cursor-sw-resize',
  };
  return map[dir];
}

function handlePos(dir: ResizeDir): React.CSSProperties {
  const half = -4;
  const mid = 'calc(50% - 4px)';
  const map: Record<ResizeDir, React.CSSProperties> = {
    n:  { top: half, left: mid },
    s:  { bottom: half, left: mid },
    e:  { right: half, top: mid },
    w:  { left: half, top: mid },
    ne: { top: half, right: half },
    nw: { top: half, left: half },
    se: { bottom: half, right: half },
    sw: { bottom: half, left: half },
  };
  return map[dir];
}

function ComponentContent({ component, template }: { component: WebsiteComponent; template: TemplateDefinition }) {
  const def = getComponentDef(component.type);
  const p = component.props;

  switch (component.type) {
    case 'hero':
      return (
        <div className={`flex flex-col items-center justify-center h-full p-6 text-center ${template.pageBg}`}>
          <h1 className={`text-2xl ${template.headingFont} ${template.primaryText} mb-2`}>{p.heading || def.defaultProps.heading}</h1>
          <p className="text-sm text-gray-500 mb-4">{p.subheading || def.defaultProps.subheading}</p>
          {(p.ctaText || def.defaultProps.ctaText) && (
            <span className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${template.primaryColor}`}>
              {p.ctaText || def.defaultProps.ctaText}
            </span>
          )}
        </div>
      );
    case 'ribbon':
      return (
        <div
          className="flex items-center justify-center h-full px-4 text-sm font-medium text-center"
          style={{ backgroundColor: p.bgColor || '#fef08a', color: p.textColor || '#78350f' }}
        >
          {p.text || def.defaultProps.text}
        </div>
      );
    case 'cta_button':
      return (
        <div className="flex items-center justify-center h-full">
          <span
            className="px-6 py-3 rounded-xl font-semibold text-sm shadow"
            style={{
              backgroundColor: p.bgColor || undefined,
              color: p.textColor || undefined,
            }}
          >
            {p.text || def.defaultProps.text}
          </span>
        </div>
      );
    case 'testimonial':
      return (
        <div className="flex flex-col justify-center h-full p-5 bg-white rounded-xl shadow-sm">
          <p className="text-sm italic text-gray-700 mb-3">"{p.quote || def.defaultProps.quote}"</p>
          <p className="text-xs font-semibold text-gray-900">{p.name || def.defaultProps.name}</p>
          {(p.title || def.defaultProps.title) && (
            <p className="text-xs text-gray-500">{p.title || def.defaultProps.title}</p>
          )}
        </div>
      );
    case 'feature_block':
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center bg-white rounded-xl shadow-sm">
          <span className="text-3xl mb-2">{p.icon || def.defaultProps.icon}</span>
          <p className={`text-sm font-semibold ${template.primaryText} mb-1`}>{p.heading || def.defaultProps.heading}</p>
          <p className="text-xs text-gray-500">{p.body || def.defaultProps.body}</p>
        </div>
      );
    case 'image_text':
      return (
        <div className="flex h-full overflow-hidden rounded-xl bg-white shadow-sm">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.imageAlt || ''} className="w-1/3 object-cover shrink-0" />
          ) : (
            <div className="w-1/3 bg-gray-100 flex items-center justify-center shrink-0 text-gray-400 text-xs">Image</div>
          )}
          <div className="flex flex-col justify-center p-4">
            <p className={`text-sm font-semibold ${template.primaryText} mb-1`}>{p.heading || def.defaultProps.heading}</p>
            <p className="text-xs text-gray-600">{p.body || def.defaultProps.body}</p>
          </div>
        </div>
      );
    case 'custom_html':
      return (
        <div
          className="h-full p-3 text-xs text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: p.html || def.defaultProps.html }}
        />
      );
    default:
      return <div className="flex items-center justify-center h-full text-xs text-gray-400">{def.label}</div>;
  }
}

export default function ComponentBlock({ component, isSelected, template, onSelect, onDelete, onDragStart, onResizeStart }: Props) {
  const blockRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(component.id);
    onDragStart(component.id, e.clientX, e.clientY, component.x, component.y);
  }, [component, onSelect, onDragStart]);

  return (
    <div
      ref={blockRef}
      style={{ position: 'absolute', left: component.x, top: component.y, width: component.w, height: component.h, zIndex: isSelected ? 20 : 10 }}
      className={`group select-none ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : 'hover:ring-1 hover:ring-indigo-300'}`}
    >
      {/* Drag handle — top bar */}
      <div
        className={`absolute inset-x-0 top-0 h-6 flex items-center justify-between px-2 cursor-move z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ background: 'rgba(79,70,229,0.85)', borderRadius: '4px 4px 0 0' }}
        onMouseDown={handleMouseDown}
      >
        <span className="text-white text-[10px] font-medium leading-none">{getComponentDef(component.type).label}</span>
        <button
          type="button"
          className="text-white/80 hover:text-white text-xs leading-none"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(component.id); }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="w-full h-full overflow-hidden rounded" onClick={e => { e.stopPropagation(); onSelect(component.id); }}>
        <ComponentContent component={component} template={template} />
      </div>

      {/* Resize handles — only shown when selected */}
      {isSelected && HANDLE_DIRS.map(dir => (
        <div
          key={dir}
          className={`absolute w-2 h-2 bg-white border-2 border-indigo-500 rounded-sm z-20 ${handleCursor(dir)}`}
          style={{ ...handlePos(dir) }}
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(component.id, dir, e.clientX, e.clientY, { ...component });
          }}
        />
      ))}
    </div>
  );
}
