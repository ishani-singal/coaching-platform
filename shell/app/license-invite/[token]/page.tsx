'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LicenseInvite {
  license_id: string;
  program_id: string;
  licensor_coach_id: string;
  license_fee_amount: number | null;
  license_fee_currency: string;
  status: string;
  programTitle?: string;
  licensorName?: string;
}

export default function LicenseInvitePage() {
  const params  = useParams<{ token: string }>();
  const router  = useRouter();
  const token   = params.token;

  const [invite,   setInvite]   = useState<LicenseInvite | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);
  const [working,  setWorking]  = useState(false);
  const [message,  setMessage]  = useState('');

  // Load invite details
  useEffect(() => {
    fetch(`/api/license-invite/${token}`)
      .then(r => r.json())
      .then((data: { invite?: LicenseInvite; error?: string }) => {
        if (data.invite) setInvite(data.invite);
        else setMessage(data.error ?? 'Invite not found or already used.');
      })
      .catch(() => setMessage('Failed to load invite.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Load current session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  async function handleAccept() {
    if (!invite) return;
    setWorking(true);
    setMessage('');

    if (!userId) {
      // Redirect to login with return URL
      router.push(`/login?redirect=${encodeURIComponent(`/license-invite/${token}`)}`);
      return;
    }

    const isFree = !invite.license_fee_amount || invite.license_fee_amount <= 0;

    if (isFree) {
      const r = await fetch(`/api/license-invite/${token}/activate`, { method: 'POST' })
        .then(res => res.json()) as { success: boolean; message: string };
      if (r.success) {
        setMessage('✓ License activated! Check your Programs tab.');
      } else {
        setMessage('✗ ' + r.message);
      }
    } else {
      const r = await fetch(`/api/license-invite/${token}/pay`, { method: 'POST' })
        .then(res => res.json()) as { url?: string; error?: string };
      if (r.url) {
        window.location.href = r.url;
      } else {
        setMessage('✗ ' + (r.error ?? 'Could not create checkout session'));
      }
    }

    setWorking(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading invite…</div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Unavailable</h1>
          <p className="text-gray-500 text-sm">{message || 'This invite link is invalid or has already been used.'}</p>
        </div>
      </div>
    );
  }

  const isFree = !invite.license_fee_amount || invite.license_fee_amount <= 0;
  const isUsed = invite.status === 'active';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-900">Program License Invitation</h1>
          {invite.licensorName && (
            <p className="text-gray-500 text-sm mt-1">from <span className="font-medium text-gray-700">{invite.licensorName}</span></p>
          )}
        </div>

        <div className="bg-purple-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-purple-500 uppercase font-medium mb-1">Program</p>
          <p className="text-gray-900 font-semibold">{invite.programTitle ?? invite.program_id}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Licensing Fee</p>
          {isFree
            ? <p className="text-green-700 font-semibold text-lg">Free</p>
            : <p className="text-gray-900 font-semibold text-lg">{invite.license_fee_currency} {(invite.license_fee_amount ?? 0).toFixed(2)}</p>
          }
        </div>

        {isUsed ? (
          <div className="text-center text-green-700 bg-green-50 border border-green-100 rounded-xl p-4">
            ✓ This license has already been activated.
          </div>
        ) : (
          <>
            {!userId && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                You&apos;ll need to sign in (or create an account) before accepting.
              </p>
            )}
            {message && (
              <p className={`text-xs rounded-lg px-3 py-2 mb-4 ${
                message.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>{message}</p>
            )}
            <button
              onClick={handleAccept}
              disabled={working}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              {working ? 'Processing…' : isFree ? 'Accept Free License' : `Pay & Accept — ${invite.license_fee_currency} ${(invite.license_fee_amount ?? 0).toFixed(2)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
