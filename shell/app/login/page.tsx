'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    setError('');
    setInfo('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    const supabase = createClient();

    if (mode === 'signin') {
      let { error } = await supabase.auth.signInWithPassword({ email, password });

      // Supabase returns 400 "Email not confirmed" for accounts created before
      // SMTP was configured. Auto-confirm via admin API and retry sign-in once.
      if (error && (error.message.toLowerCase().includes('email not confirmed') || (error as { code?: string }).code === 'email_not_confirmed')) {
        const confirmRes = await fetch('/api/auth/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (confirmRes.ok) {
          ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        }
      }

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push('/programs');
        router.refresh();
      }
    } else {
      // Use server-side signup (service role key) so email confirmation is not required.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Signup failed.');
        setLoading(false);
      } else {
        // Account created — sign in immediately.
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
        } else {
          router.push('/programs');
          router.refresh();
        }
      }
    }
  }

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-900 relative overflow-hidden">

      {/* Decorative blur blobs — cosmetic only */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-700 rounded-full opacity-20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] bg-purple-700 rounded-full opacity-20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-600 rounded-full opacity-10 blur-2xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">

        {/* Branding above the card */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <p className="text-2xl font-bold text-white tracking-wide">Skillz</p>
          <p className="text-indigo-300 text-sm mt-1">
            {isSignIn ? 'Sign in to your coaching dashboard' : 'Create your coaching account'}
          </p>
        </div>

        {/* White card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder={isSignIn ? '••••••••' : 'Min. 6 characters'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {info && (
              <div className="flex items-start gap-2.5 border border-green-200 bg-green-50 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-green-800">{info}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (isSignIn ? 'Signing in…' : 'Creating account…')
                : (isSignIn ? 'Sign in' : 'Create account')}
            </button>

            <p className="text-center text-sm text-gray-500 pt-1">
              {isSignIn ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => switchMode(isSignIn ? 'signup' : 'signin')}
                className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline transition-colors"
              >
                {isSignIn ? 'Sign up' : 'Sign in'}
              </button>
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}
