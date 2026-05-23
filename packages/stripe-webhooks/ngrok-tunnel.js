/**
 * Opens an ngrok tunnel to the payment agent (port 3007) and
 * prints the Razorpay webhook URL to register in the dashboard.
 *
 * Requires NGROK_AUTHTOKEN in .env.
 * Skipped gracefully if the token is missing.
 */

async function startTunnel() {
  const authtoken = process.env.NGROK_AUTHTOKEN;

  if (!authtoken) {
    console.warn(
      '[ngrok] NGROK_AUTHTOKEN not set — skipping tunnel.\n' +
      '  Get a free token at https://dashboard.ngrok.com/get-started/your-authtoken\n' +
      '  then add NGROK_AUTHTOKEN=<token> to your .env'
    );
    return;
  }

  let ngrok;
  try {
    ngrok = require('@ngrok/ngrok');
  } catch {
    console.warn('[ngrok] @ngrok/ngrok not installed — run pnpm install first.');
    return;
  }

  const port = parseInt(process.env.AGENT_PAYMENT_PORT ?? '3007', 10);

  try {
    const listener = await ngrok.forward({
      addr:     port,
      authtoken,
    });

    const url = listener.url();
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║               RAZORPAY WEBHOOK URL (local dev)           ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  ${(url + '/webhooks/razorpay').padEnd(56)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('  Register this URL in: https://dashboard.razorpay.com → Settings → Webhooks');
    console.log('  Events: payment.captured  payment.failed  refund.processed\n');

    // Keep the tunnel alive until the process exits
    await new Promise(() => {});
  } catch (err) {
    console.error('[ngrok] Failed to open tunnel:', err.message);
    process.exit(0); // Non-fatal
  }
}

startTunnel();
