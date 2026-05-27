'use client';
import { useState, useEffect, use } from 'react';

type Step = 'loading' | 'signup' | 'profile' | 'done';

export default function GraduatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [step, setStep] = useState<Step>('loading');
  const [userId, setUserId] = useState('');
  const [includedProgramIds, setIncludedProgramIds] = useState<string[] | undefined>();

  // Sign-up fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupError, setSignupError] = useState('');

  // Profile fields
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then((res: { success: boolean; data: { userId?: string; pkg?: { includedProgramIds?: string[] } } }) => {
        setIncludedProgramIds(res.data?.pkg?.includedProgramIds);
        if (res.data?.userId) {
          setUserId(res.data.userId);
          setStep('profile');
        } else {
          setStep('signup');
        }
      });
  }, [token]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()) as { id?: string; error?: string };

    if (!res.id) {
      setSignupError(res.error ?? 'Signup failed. Please try again.');
      return;
    }

    // Link the new Supabase account to the trainee's client_profile row
    await fetch(`/api/portal/${token}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: res.id }),
    });

    setUserId(res.id);
    setStep('profile');
  }

  async function checkSlug() {
    const r = await fetch(`/api/coaches/slug-check?slug=${encodeURIComponent(slug)}`).then(r => r.json()) as { available: boolean };
    setSlugStatus(r.available ? '✓ Available' : '✗ Taken');
  }

  async function handleGraduate(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/coaches/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, slug, displayName, includedProgramIds }),
    }).then(r => r.json()) as { success: boolean; data?: { subdomainUrl: string }; message?: string };
    if (r.success) {
      setResult(`🎉 Welcome, Coach! Your site: ${r.data?.subdomainUrl}`);
      setStep('done');
    } else {
      setResult(`✗ Failed — ${r.message ?? 'unknown error'}`);
      setStep('done');
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Become a Coach</h1>
        <p className="text-gray-500 text-sm mb-6">Set up your coaching profile to start delivering programs.</p>

        {step === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <p className="text-sm text-gray-600">First, create your account.</p>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2 text-sm mt-1" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input type="password" className="w-full border rounded px-3 py-2 text-sm mt-1" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            {signupError && <p className="text-red-600 text-sm">{signupError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">Create Account</button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleGraduate} className="space-y-4">
            <p className="text-sm text-gray-600">Now set up your coach profile.</p>
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <input className="w-full border rounded px-3 py-2 text-sm mt-1" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium">Your URL slug</label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 border rounded px-3 py-2 text-sm" value={slug} onChange={e => setSlug(e.target.value)} required />
                <button type="button" onClick={checkSlug} className="border rounded px-3 py-2 text-sm">Check</button>
              </div>
              {slugStatus && <p className="text-xs mt-1 text-gray-600">{slugStatus}</p>}
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium">Create My Profile</button>
          </form>
        )}

        {step === 'done' && (
          <p className={result.startsWith('🎉') ? 'text-green-700 font-medium break-all' : 'text-red-600 font-medium'}>{result}</p>
        )}
      </div>
    </div>
  );
}
