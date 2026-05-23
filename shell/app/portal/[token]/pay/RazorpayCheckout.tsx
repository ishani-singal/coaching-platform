'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RazorpayCheckoutProps {
  orderId:       string;
  razorpayKeyId: string;
  currency:      string;
  description:   string;
  name:          string;
  portalUrl:     string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function RazorpayCheckout({
  orderId, razorpayKeyId, currency, description, name, portalUrl,
}: RazorpayCheckoutProps) {
  const router = useRouter();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const rzp = new window.Razorpay({
        key:         razorpayKeyId,
        order_id:    orderId,
        currency,
        name,
        description,
        theme:       { color: '#4f46e5' },
        handler: () => {
          // Payment succeeded — redirect to portal
          router.replace(portalUrl);
        },
        modal: {
          ondismiss: () => {
            // User closed the modal — stay on pay page
          },
        },
      });
      rzp.open();
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [orderId, razorpayKeyId, currency, description, name, portalUrl, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md w-full p-10 text-center">
        <div className="text-5xl mb-4">💳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
        <p className="text-gray-500 text-sm mb-8">
          Opening payment window… If it doesn&apos;t open automatically, click below.
        </p>
        <p className="text-xs text-gray-400">Powered by Razorpay</p>
      </div>
    </div>
  );
}
