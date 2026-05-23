'use client';

/**
 * CertificatePreview — renders a visual certificate in 3 design variants.
 * Uses inline styles only (no Tailwind) so html2canvas captures it faithfully.
 * A4 landscape: 1122 × 794 px at 96 dpi.
 */

import React, { forwardRef } from 'react';
import { CertificateTemplate } from '@coaching/sdk';

export interface EditCallbacks {
  onTitle?:          (v: string) => void;
  onSubtitle?:       (v: string) => void;
  onProgramLabel?:   (v: string) => void;
  onSignatoryLabel?: (v: string) => void;
  onCoachTitle?:     (v: string) => void;
}

export interface CertificatePreviewProps {
  template: CertificateTemplate;
  traineeName: string;
  packageTitle: string;
  completionDate: string;
  /** Overrides template.coachName — used in preview when coachName will be autofilled at graduation */
  coachNameOverride?: string;
  /** When provided, text fields become contentEditable and call these handlers on blur */
  editCallbacks?: EditCallbacks;
}

/** Renders a static div or an inline-editable div depending on whether onBlur is provided. */
function EditableText({
  children,
  style,
  onBlur,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
  onBlur?: (v: string) => void;
}) {
  if (!onBlur) return <div style={style}>{children}</div>;
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        borderBottom: '1.5px dashed rgba(0,0,0,0.18)',
        minWidth: 40,
      }}
      onBlur={e => onBlur(e.currentTarget.textContent ?? '')}
    >
      {children}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Classic variant ────────────────────────────────────────────────────────────

function ClassicCertificate({ t, traineeName, packageTitle, completionDate, ec }: {
  t: CertificateTemplate;
  traineeName: string;
  packageTitle: string;
  completionDate: string;
  ec?: EditCallbacks;
}) {
  const accent = t.accentColor;
  return (
    <div style={{
      width: 1122, height: 794,
      background: '#fdfaf3',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, "Times New Roman", serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ornate outer border */}
      <div style={{
        position: 'absolute', inset: 18,
        border: `4px solid ${accent}`,
        borderRadius: 4,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 26,
        border: `1px solid ${hexToRgba(accent, 0.4)}`,
        borderRadius: 2,
        pointerEvents: 'none',
      }} />

      {/* Corner ornaments */}
      {[
        { top: 22, left: 22 }, { top: 22, right: 22 },
        { bottom: 22, left: 22 }, { bottom: 22, right: 22 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 28, height: 28,
          border: `2px solid ${accent}`,
          borderRadius: '50%',
        }} />
      ))}

      {/* Logo */}
      {t.logoUrl && (
        <img src={t.logoUrl} alt="Logo"
          style={{ height: 64, marginBottom: 16, objectFit: 'contain' }} />
      )}

      {/* Title */}
      <EditableText
        style={{ fontSize: 38, fontWeight: 700, letterSpacing: 4, color: accent, textTransform: 'uppercase', marginBottom: 4 }}
        onBlur={ec?.onTitle}
      >
        {t.title}
      </EditableText>

      {/* Decorative rule */}
      <div style={{ width: 320, height: 2, background: accent, margin: '8px 0 20px' }} />

      {/* Subtitle */}
      <EditableText
        style={{ fontSize: 16, color: '#6b5c3e', marginBottom: 8 }}
        onBlur={ec?.onSubtitle}
      >
        {t.subtitle ?? 'This is to certify that'}
      </EditableText>

      {/* Trainee name */}
      <div style={{
        fontSize: 44, fontStyle: 'italic', color: '#1a1a1a',
        borderBottom: `2px solid ${hexToRgba(accent, 0.5)}`,
        paddingBottom: 6, marginBottom: 16, minWidth: 300, textAlign: 'center',
      }}>
        {traineeName}
      </div>

      {/* Program label */}
      <EditableText
        style={{ fontSize: 15, color: '#4b4030', marginBottom: 4 }}
        onBlur={ec?.onProgramLabel}
      >
        {t.programLabel ?? 'for successfully completing'}
      </EditableText>

      {/* Package title */}
      <div style={{ fontSize: 22, fontWeight: 600, color: '#1a1a1a', marginBottom: 24 }}>
        {packageTitle}
      </div>

      {/* Date */}
      <div style={{ fontSize: 13, color: '#7a6b52', marginBottom: 32 }}>
        Issued on {completionDate}
      </div>

      {/* Signatory */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 180, height: 1, background: '#7a6b52' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{t.coachName}</div>
        {(t.coachTitle || ec?.onCoachTitle) && (
          <EditableText
            style={{ fontSize: 12, color: '#7a6b52' }}
            onBlur={ec?.onCoachTitle}
          >
            {t.coachTitle || 'Coach title'}
          </EditableText>
        )}
        <EditableText
          style={{ fontSize: 11, color: '#9c8c72', fontStyle: 'italic' }}
          onBlur={ec?.onSignatoryLabel}
        >
          {t.signatoryLabel ?? 'Certified by'}
        </EditableText>
      </div>
    </div>
  );
}

// ── Modern variant ─────────────────────────────────────────────────────────────

function ModernCertificate({ t, traineeName, packageTitle, completionDate, ec }: {
  t: CertificateTemplate;
  traineeName: string;
  packageTitle: string;
  completionDate: string;
  ec?: EditCallbacks;
}) {
  const accent = t.accentColor;
  return (
    <div style={{
      width: 1122, height: 794,
      background: '#ffffff',
      display: 'flex',
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Left accent strip */}
      <div style={{
        width: 14, background: accent, flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '48px 60px',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <EditableText
              style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent, marginBottom: 6 }}
              onBlur={ec?.onSignatoryLabel}
            >
              {t.signatoryLabel ?? 'Certificate of Achievement'}
            </EditableText>
            <EditableText
              style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}
              onBlur={ec?.onTitle}
            >
              {t.title}
            </EditableText>
          </div>
          {t.logoUrl && (
            <img src={t.logoUrl} alt="Logo"
              style={{ height: 52, objectFit: 'contain' }} />
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 3, background: accent, width: 80, marginBottom: 32 }} />

        {/* Subtitle */}
        <EditableText
          style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}
          onBlur={ec?.onSubtitle}
        >
          {t.subtitle ?? 'This is to certify that'}
        </EditableText>

        {/* Trainee name */}
        <div style={{
          fontSize: 52, fontWeight: 700, color: '#0f172a',
          letterSpacing: -1, lineHeight: 1, marginBottom: 16,
        }}>
          {traineeName}
        </div>

        {/* Program label + title */}
        <EditableText
          style={{ fontSize: 15, color: '#475569', marginBottom: 4 }}
          onBlur={ec?.onProgramLabel}
        >
          {t.programLabel ?? 'has successfully completed'}
        </EditableText>
        <div style={{ fontSize: 22, fontWeight: 600, color: accent, marginBottom: 'auto' }}>
          {packageTitle}
        </div>

        {/* Footer row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{t.coachName}</div>
            {(t.coachTitle || ec?.onCoachTitle) && (
              <EditableText
                style={{ fontSize: 12, color: '#64748b' }}
                onBlur={ec?.onCoachTitle}
              >
                {t.coachTitle || 'Coach title'}
              </EditableText>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
            <div>Date of Issue</div>
            <div style={{ fontWeight: 600, color: '#475569' }}>{completionDate}</div>
          </div>
        </div>
      </div>

      {/* Right accent strip (thin) */}
      <div style={{ width: 6, background: hexToRgba(accent, 0.25), flexShrink: 0 }} />
    </div>
  );
}

// ── Minimal variant ────────────────────────────────────────────────────────────

function MinimalCertificate({ t, traineeName, packageTitle, completionDate, ec }: {
  t: CertificateTemplate;
  traineeName: string;
  packageTitle: string;
  completionDate: string;
  ec?: EditCallbacks;
}) {
  const accent = t.accentColor;
  return (
    <div style={{
      width: 1122, height: 794,
      background: '#ffffff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Helvetica Neue", Arial, sans-serif',
      padding: '60px 100px',
      boxSizing: 'border-box',
    }}>
      {/* Logo */}
      {t.logoUrl && (
        <img src={t.logoUrl} alt="Logo"
          style={{ height: 40, marginBottom: 24, objectFit: 'contain' }} />
      )}

      {/* Top rule */}
      <div style={{ width: '100%', height: 2, background: accent, marginBottom: 36 }} />

      {/* Title */}
      <EditableText
        style={{ fontSize: 13, letterSpacing: 5, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 16 }}
        onBlur={ec?.onTitle}
      >
        {t.title}
      </EditableText>

      {/* Subtitle */}
      <EditableText
        style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}
        onBlur={ec?.onSubtitle}
      >
        {t.subtitle ?? 'Awarded to'}
      </EditableText>

      {/* Trainee name */}
      <div style={{
        fontSize: 48, fontWeight: 300, color: '#111827',
        letterSpacing: -1, marginBottom: 20,
      }}>
        {traineeName}
      </div>

      {/* Program label */}
      <EditableText
        style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}
        onBlur={ec?.onProgramLabel}
      >
        {t.programLabel ?? 'for completing'}
      </EditableText>

      {/* Package title */}
      <div style={{
        fontSize: 20, fontWeight: 600, color: accent,
        marginBottom: 36,
      }}>
        {packageTitle}
      </div>

      {/* Bottom rule */}
      <div style={{ width: '100%', height: 1, background: '#e5e7eb', marginBottom: 24 }} />

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        width: '100%', fontSize: 12, color: '#9ca3af',
      }}>
        <div>
          <div style={{ fontWeight: 600, color: '#374151' }}>{t.coachName}</div>
          {(t.coachTitle || ec?.onCoachTitle) && (
            <EditableText
              style={{ color: '#9ca3af', fontSize: 12 }}
              onBlur={ec?.onCoachTitle}
            >
              {t.coachTitle || 'Coach title'}
            </EditableText>
          )}
          <EditableText
            style={{ fontStyle: 'italic', fontSize: 12, color: '#9ca3af' }}
            onBlur={ec?.onSignatoryLabel}
          >
            {t.signatoryLabel ?? 'Instructor'}
          </EditableText>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>Date of Issue</div>
          <div style={{ fontWeight: 600, color: '#374151' }}>{completionDate}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

const CertificatePreview = forwardRef<HTMLDivElement, CertificatePreviewProps>(
  function CertificatePreview({ template, traineeName, packageTitle, completionDate, coachNameOverride, editCallbacks }, ref) {
    const resolved = { ...template, coachName: coachNameOverride ?? template.coachName ?? '' };
    const props = { t: resolved, traineeName, packageTitle, completionDate, ec: editCallbacks };
    return (
      <div ref={ref} style={{ display: 'inline-block' }}>
        {template.designVariant === 'classic'  && <ClassicCertificate  {...props} />}
        {template.designVariant === 'modern'   && <ModernCertificate   {...props} />}
        {template.designVariant === 'minimal'  && <MinimalCertificate  {...props} />}
      </div>
    );
  }
);

export default CertificatePreview;
