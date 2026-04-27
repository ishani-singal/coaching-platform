'use client';
import { useState } from 'react';
import { useSession } from '@/components/SessionProvider';

export default function ProgramsPage() {
  const { userId } = useSession();
  const [tab, setTab] = useState<'modules' | 'programs' | 'packages'>('modules');

  async function callAction(action: string, params: Record<string, unknown>) {
    const res = await fetch('/api/agents/coaching-program-builder/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user-id', config: {}, action, params }),
    });
    return res.json();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Program Builder</h1>
      <div className="flex gap-2 mb-6">
        {(['modules', 'programs', 'packages'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'modules' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Create Module</h2>
          <CreateModuleForm onSubmit={p => callAction('create_module', p)} />
        </div>
      )}

      {tab === 'programs' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Build Program</h2>
          <p className="text-sm text-gray-500">Enter module IDs (comma-separated) and a title to build a program.</p>
          <BuildProgramForm onSubmit={p => callAction('build_program', p)} />
        </div>
      )}

      {tab === 'packages' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-4">Assemble Package</h2>
          <p className="text-sm text-gray-500">Combine programs into a publishable coaching package.</p>
        </div>
      )}
    </div>
  );
}

function CreateModuleForm({ onSubmit }: { onSubmit: (p: Record<string, unknown>) => Promise<unknown> }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const r = await onSubmit({ title, category }) as { success: boolean; message: string };
    setResult(r.success ? '✓ ' + r.message : '✗ ' + r.message);
  }

  return (
    <form onSubmit={handle} className="space-y-3 max-w-sm">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} required />
      <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Create</button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}

function BuildProgramForm({ onSubmit }: { onSubmit: (p: Record<string, unknown>) => Promise<unknown> }) {
  const [title, setTitle] = useState('');
  const [moduleIds, setModuleIds] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const r = await onSubmit({ title, moduleIds: moduleIds.split(',').map(s => s.trim()).filter(Boolean) }) as { success: boolean; message: string };
    setResult(r.success ? '✓ ' + r.message : '✗ ' + r.message);
  }

  return (
    <form onSubmit={handle} className="space-y-3 max-w-sm mt-3">
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Program title" value={title} onChange={e => setTitle(e.target.value)} required />
      <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Module IDs (comma-separated)" value={moduleIds} onChange={e => setModuleIds(e.target.value)} required />
      <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Build</button>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </form>
  );
}
