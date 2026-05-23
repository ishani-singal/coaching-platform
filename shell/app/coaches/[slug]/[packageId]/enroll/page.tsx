'use client';
import { use, useState } from 'react';
import Link from 'next/link';

export default function EnrollPage({ params }: { params: Promise<{ slug: string; packageId: string }> }) {
  const { slug, packageId } = use(params);

  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [goals, setGoals] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [portalUrl, setPortalUrl] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const r = await fetch(`/api/coaches/${slug}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, name, email, goals: goals || undefined }),
    }).then(res => res.json()) as { success: boolean; message?: string; portalUrl?: string };

    setSubmitting(false);

    if (r.success && r.portalUrl) {
      setPortalUrl(r.portalUrl);
    } else {
      setError(r.message ?? 'Enrollment failed. Please try again.');
    }
  }

  if (portalUrl) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-10 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re enrolled!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Check your email for your portal link, or access it directly below.
          </p>
          <a
            href={portalUrl}
            className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors mb-3"
          >
            Go to My Portal
          </a>
          <Link href={`/coaches/${slug}`} className="text-sm text-gray-400 hover:text-indigo-600">
            Back to coach page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8 py-16">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Enroll Now</h1>
        <p className="text-gray-500 text-sm mb-8">
          Fill in your details to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Full Name *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Email Address *</label>
            <input
              type="email"
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase">Your Goals (optional)</label>
            <textarea
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
              rows={3}
              placeholder="What do you hope to achieve?"
              value={goals}
              onChange={e => setGoals(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Enrolling…' : 'Enroll Now'}
          </button>

          <Link
            href={`/coaches/${slug}/${packageId}`}
            className="block text-center text-sm text-gray-400 hover:text-indigo-600 mt-2"
          >
            ← Back to program
          </Link>
        </form>
      </div>
    </div>
  );
}
