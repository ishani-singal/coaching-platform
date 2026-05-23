'use client';

import { useEffect, useState } from 'react';

type Provider = 'gemini' | 'azure-openai';

const LABELS: Record<Provider, string> = {
  'gemini':       'Gemini 2.5 Flash',
  'azure-openai': 'Phi-4 (Azure)',
};

export function ModelPicker() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/llm-provider')
      .then(r => r.json())
      .then((d: { provider: Provider }) => setProvider(d.provider))
      .catch(() => setProvider('gemini'));
  }, []);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Provider;
    setSaving(true);
    try {
      await fetch('/api/settings/llm-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: next }),
      });
      setProvider(next);
    } finally {
      setSaving(false);
    }
  }

  if (provider === null) return null;

  return (
    <select
      value={provider}
      onChange={handleChange}
      disabled={saving}
      title="Select AI model"
      aria-label="Select AI model"
      className="text-xs theme-nav-link border border-current rounded-md px-2 py-1 bg-transparent cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {(Object.keys(LABELS) as Provider[]).map(p => (
        <option key={p} value={p}>{LABELS[p]}</option>
      ))}
    </select>
  );
}
