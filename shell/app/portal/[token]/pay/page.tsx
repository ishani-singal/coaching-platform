import { redirect } from 'next/navigation';

interface PayApiResponse {
  alreadyFree?:  boolean;
  alreadyPaid?:  boolean;
  bypassed?:     boolean;
  provider?:     string;
  checkoutUrl?:  string;
  success?:      boolean;
  message?:      string;
}

export default async function PayGatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const domain   = process.env.PLATFORM_DOMAIN?.trim() || 'localhost:3000';
  const protocol = domain.startsWith('localhost') ? 'http' : 'https';
  const portalUrl = `/portal/${token}`;

  const res = await fetch(`${protocol}://${domain}/api/portal/${token}/pay`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    cache:   'no-store',
  });

  const data = await res.json() as PayApiResponse;

  if (data.alreadyFree || data.alreadyPaid || data.bypassed) {
    redirect(portalUrl);
  }

  if (!data.checkoutUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-10 text-center">
          <p className="text-red-500 font-medium">Unable to create payment link.</p>
          <p className="text-gray-400 text-sm mt-2">{data.message ?? 'Please try again or contact support.'}</p>
        </div>
      </div>
    );
  }

  const checkoutUrl = data.checkoutUrl;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-10 text-center">
        <div className="text-5xl mb-4">💳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
        <p className="text-gray-500 text-sm mb-8">
          You&apos;re one step away from accessing your program.
        </p>
        <a
          href={checkoutUrl}
          className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Proceed to Payment
        </a>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <meta httpEquiv="refresh" content={`3; url=${checkoutUrl}`} />
        <p className="text-xs text-gray-400 mt-4">Redirecting automatically in a few seconds…</p>
      </div>
    </div>
  );
}
