'use client';

import React, { useRef, useState, useCallback } from 'react';
import { CertificateTemplate, CertificateDesignVariant } from '@coaching/sdk';
import CertificatePreview, { EditCallbacks } from './CertificatePreview';

export interface CertificateBuilderProps {
  /** Initial values when editing an existing template */
  initial?: Partial<CertificateTemplate>;
  /** Package title shown in the live preview */
  packageTitle: string;
  /** Called whenever the template changes (parent stores it) */
  onChange: (template: CertificateTemplate) => void;
  /** Hide the coach name field â€” autofilled from the coach profile at graduation */
  hideCoachName?: boolean;  /** Logo URL from the coach’s profile — auto-included on the certificate */
  profileLogoUrl?: string;}

const DEFAULT_ACCENT = '#4F46E5';

const VARIANT_LABELS: Record<CertificateDesignVariant, string> = {
  classic: 'Classic',
  modern:  'Modern',
  minimal: 'Minimal',
};

const TODAY = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

// Scale to fit inside the modal form body (90vw modal - 64px padding â‰ˆ enough room at 0.65)
const SCALE = 0.65;

export default function CertificateBuilder({ initial, packageTitle, onChange, hideCoachName, profileLogoUrl }: CertificateBuilderProps) {
  const [variant,        setVariant]        = useState<CertificateDesignVariant>(initial?.designVariant    ?? 'modern');
  const [title,          setTitle]          = useState(initial?.title            ?? 'Certificate of Completion');
  const [subtitle,       setSubtitle]       = useState(initial?.subtitle         ?? 'This is to certify that');
  const [programLabel,   setProgramLabel]   = useState(initial?.programLabel     ?? 'for successfully completing');
  const [coachName,      setCoachName]      = useState(initial?.coachName        ?? '');
  const [coachTitle,     setCoachTitle]     = useState(initial?.coachTitle       ?? '');
  // Profile logo takes precedence; falls back to any previously saved logoUrl
  const [logoUrl,        setLogoUrl]        = useState(profileLogoUrl ?? initial?.logoUrl ?? '');
  const [accentColor,    setAccentColor]    = useState(initial?.accentColor      ?? DEFAULT_ACCENT);
  const [signatoryLabel, setSignatoryLabel] = useState(initial?.signatoryLabel   ?? 'Certified by');
  const [exporting,      setExporting]      = useState(false);
  const [showLogoInput,  setShowLogoInput]  = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef  = useRef<HTMLDivElement>(null);

  const buildTemplate = useCallback((): CertificateTemplate => ({
    designVariant:  variant,
    title,
    subtitle:       subtitle       || undefined,
    programLabel:   programLabel   || undefined,
    coachName:      hideCoachName ? undefined : (coachName || undefined),
    coachTitle:     coachTitle     || undefined,
    logoUrl:        logoUrl        || undefined,
    accentColor,
    signatoryLabel: signatoryLabel || undefined,
  }), [variant, title, subtitle, programLabel, hideCoachName, coachName, coachTitle, logoUrl, accentColor, signatoryLabel]);

  /** Build and emit the current template, merging in an overridden field. */
  function emit(override?: Partial<CertificateTemplate>) {
    onChange({ ...buildTemplate(), ...override });
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1122,
        height: 794,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`certificate-preview-${Date.now()}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const template = buildTemplate();

  const editCallbacks: EditCallbacks = {
    onTitle:          v => { setTitle(v);          emit({ title: v }); },
    onSubtitle:       v => { setSubtitle(v);       emit({ subtitle: v || undefined }); },
    onProgramLabel:   v => { setProgramLabel(v);   emit({ programLabel: v || undefined }); },
    onSignatoryLabel: v => { setSignatoryLabel(v); emit({ signatoryLabel: v || undefined }); },
    onCoachTitle:     hideCoachName ? undefined : (v => { setCoachTitle(v); emit({ coachTitle: v || undefined }); }),
  };

  return (
    <div className="space-y-3 p-4">
      {/* â”€â”€ Compact toolbar â”€â”€ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Variant pills */}
        <div className="flex gap-1">
          {(['classic', 'modern', 'minimal'] as CertificateDesignVariant[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => { setVariant(v); emit({ designVariant: v }); }}
              className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                variant === v
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {VARIANT_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Accent colour */}
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={accentColor}
            title="Accent colour"
            onChange={e => { setAccentColor(e.target.value); emit({ accentColor: e.target.value }); }}
            className="h-7 w-9 rounded border border-gray-200 cursor-pointer p-0.5 bg-white"
          />
          <input
            type="text"
            value={accentColor}
            onChange={e => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { setAccentColor(v); emit({ accentColor: v }); }
            }}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="#4F46E5"
          />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Logo — from profile (auto) or manual URL toggle */}
        {profileLogoUrl ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-green-200 bg-green-50 text-xs text-green-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profileLogoUrl} alt="" className="h-4 w-4 object-contain" />
            Logo (from profile)
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLogoInput(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Logo
          </button>
        )}

        {/* Export PDF */}
        <button
          type="button"
          onClick={exportPdf}
          disabled={exporting}
          className="ml-auto px-3 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Generating...' : 'Export PDF'}
        </button>
      </div>

      {/* Logo URL input (shown when toggled, only when no profile logo) */}
      {!profileLogoUrl && showLogoInput && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={logoUrl}
            onChange={e => { setLogoUrl(e.target.value); emit({ logoUrl: e.target.value || undefined }); }}
            placeholder="https://example.com/logo.png"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {logoUrl && (
            <button
              type="button"
              onClick={() => { setLogoUrl(''); emit({ logoUrl: undefined }); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Editable hint */}
      <p className="text-xs text-gray-400 italic">Click on text in the certificate to edit it.</p>

      {/* â”€â”€ Certificate preview (inline editable) â”€â”€ */}
      <div
        className="rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{
          width:  Math.round(1122 * SCALE),
          height: Math.round(794  * SCALE),
        }}
      >
        <div style={{
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          width: 1122,
          height: 794,
        }}>
          <CertificatePreview
            ref={previewRef}
            template={template}
            traineeName="[Trainee Name]"
            packageTitle={packageTitle || '[Package Title]'}
            completionDate={TODAY}
            coachNameOverride={hideCoachName ? '[Coach Name]' : (coachName || '[Coach Name]')}
            editCallbacks={editCallbacks}
          />
        </div>
      </div>

      {/* Hidden full-size static certificate — used only by exportPdf, never visible */}
      <div
        aria-hidden
        style={{ position: 'fixed', left: -99999, top: 0, width: 1122, height: 794, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}
      >
        <CertificatePreview
          ref={exportRef}
          template={template}
          traineeName="[Trainee Name]"
          packageTitle={packageTitle || '[Package Title]'}
          completionDate={TODAY}
          coachNameOverride={hideCoachName ? '[Coach Name]' : (coachName || '[Coach Name]')}
        />
      </div>
    </div>
  );
}

