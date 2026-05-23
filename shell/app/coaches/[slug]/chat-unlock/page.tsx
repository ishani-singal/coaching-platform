'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ChatUnlockResultPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const success      = searchParams.get('success') === 'true';
  const cancelled    = searchParams.get('cancelled') === 'true';
  const { slug }     = params;

  useEffect(() => {
    if (success) {
      // Redirect back to the coach page after 3s
      const t = setTimeout(() => router.push(`/coaches/${slug}`), 3000);
      return () => clearTimeout(t);
    }
  }, [success, slug, router]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-md w-full text-center p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Chat Unlocked!</h1>
          <p className="text-gray-500 mb-6">
            You now have unlimited chat access. Redirecting you back…
          </p>
          <Link
            href={`/coaches/${slug}`}
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Go back to chat
          </Link>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-md w-full text-center p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-gray-500 mb-6">No charge was made. You can still use your free messages.</p>
          <Link
            href={`/coaches/${slug}`}
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Back to chat
          </Link>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Link href={`/coaches/${slug}`} className="text-indigo-600 underline">
        Back to chat
      </Link>
    </div>
  );
}
