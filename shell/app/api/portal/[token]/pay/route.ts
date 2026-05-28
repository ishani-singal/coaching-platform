import { NextRequest, NextResponse } from 'next/server';
import { getEnrollmentByToken } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

const PAYMENT_AGENT_URL = process.env.SKILLZ_AGENT_COACHING_PAYMENT_URL ?? 'http://localhost:3007';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const enrollment = await getEnrollmentByToken(token);
    const { clientId, pkg } = enrollment;

    // Free packages don't need payment
    if (!pkg.priceUsd || pkg.priceUsd <= 0) {
      return NextResponse.json({ alreadyFree: true });
    }

    const domain   = process.env.PLATFORM_DOMAIN?.trim() || 'localhost:3000';
    const protocol = domain.startsWith('localhost') ? 'http' : 'https';
    const portalUrl = `${protocol}://${domain}/portal/${token}`;

    // Check if a succeeded payment already exists for this client
    const { data: succeeded } = await supabase
      .from('payment_records')
      .select('external_id')
      .eq('client_id', clientId)
      .eq('status', 'succeeded')
      .limit(1);

    if (succeeded && succeeded.length > 0) {
      return NextResponse.json({ alreadyPaid: true });
    }

    // Reuse existing pending checkout (idempotency) — valid for both Stripe and Razorpay Payment Links
    const { data: pending } = await supabase
      .from('payment_records')
      .select('external_id, metadata, provider')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pending && pending.length > 0) {
      const meta = pending[0].metadata as Record<string, unknown> | null;
      const checkoutUrl = meta?.checkoutUrl as string | undefined;
      if (checkoutUrl) {
        return NextResponse.json({ provider: pending[0].provider, checkoutUrl });
      }
    }

    // Create new checkout via the payment agent
    const agentRes = await fetch(`${PAYMENT_AGENT_URL}/action`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.SHELL_INTERNAL_TOKEN ?? ''}`,
      },
      body: JSON.stringify({
        userId: clientId,
        action: 'create_payment_link',
        params: {
          // Use INR (Razorpay) as the default; amount stored in paise (price × 100)
          amount:      Math.round(pkg.priceUsd * 100),
          currency:    pkg.currencies?.[0] ?? 'INR',
          description: pkg.title,
          redirectUrl: portalUrl,
          packageId:   pkg.packageId,
        },
      }),
    });

    if (!agentRes.ok) {
      const text = await agentRes.text();
      return NextResponse.json({ success: false, message: `Payment agent error: ${text}` }, { status: 502 });
    }

    const agentData = await agentRes.json() as {
      success: boolean;
      message: string;
      data?: {
        provider:       string;
        paymentLinkUrl?: string;
        paymentLinkId:  string;
        paymentIntentId?: string;
        orderId?:       string;
        razorpayKeyId?: string;
      };
    };

    if (!agentData.success || !agentData.data) {
      return NextResponse.json({ success: false, message: agentData.message }, { status: 502 });
    }

    const { provider, paymentLinkUrl, paymentIntentId, paymentLinkId, orderId, razorpayKeyId } = agentData.data;
    const externalId = paymentIntentId ?? paymentLinkId ?? orderId!;

    // Patch client_id onto the freshly created payment_records row
    await supabase
      .from('payment_records')
      .update({ client_id: clientId })
      .eq('external_id', externalId);

    // Both Stripe and Razorpay now return a hosted checkout URL — treat identically
    const checkoutUrl = paymentLinkUrl!;
    await supabase
      .from('payment_records')
      .update({ metadata: { checkoutUrl, packageId: pkg.packageId } })
      .eq('external_id', externalId);

    return NextResponse.json({ provider, checkoutUrl });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
