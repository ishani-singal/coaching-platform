'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function ProspectAccountPage({ params }: { params: { slug: string } }) {
  const { slug }     = params;
  const router       = useRouter();
  const searchParams = useSearchParams();
  const welcome      = searchParams.get('welcome') === 'true';

  const [loading,      setLoading]      = useState(true);
  const [user,         setUser]         = useState<{ email?: string; id: string } | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push(`/coaches/${slug}/account/login`);
        return;
      }
      setUser({ id: data.user.id, email: data.user.email });
      setLoading(false);
    });
  }, [slug, router]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/coaches/${slug}/account/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `chat-history-${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(
      'This will permanently delete all your chat history with this coach and cannot be undone. Continue?'
    )) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/coaches/${slug}/account/delete`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Delete failed');
      }
      // Sign out and redirect
      await getSupabase().auth.signOut();
      router.push(`/coaches/${slug}?deleted=true`);
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    router.push(`/coaches/${slug}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="max-w-lg mx-auto pt-12">
        {welcome && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            Welcome! Your account has been created and your chat history is saved.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your account</h1>
          <p className="text-sm text-gray-500 mb-6">{user?.email}</p>

          <Link
            href={`/coaches/${slug}`}
            className="inline-block bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors mb-6"
          >
            Back to chat
          </Link>

          <div className="border-t pt-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Data & Privacy</h2>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              <span>{exporting ? 'Preparing export…' : 'Download my chat history'}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            <p className="text-xs text-gray-400 px-1">
              Download a JSON file containing all your chat messages with this coach.
              Your right under GDPR Art. 20 / CCPA.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-4">
          <h2 className="text-sm font-semibold text-red-700 mb-3">Danger zone</h2>

          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{deleteError}</p>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete all my chats & account data'}
          </button>
          <p className="text-xs text-gray-400 mt-2 px-1">
            Permanently erases all your chat history with this coach. This cannot be undone.
            Your right under GDPR Art. 17 (right to erasure) / CCPA.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
