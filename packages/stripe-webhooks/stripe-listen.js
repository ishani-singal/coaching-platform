/**
 * Starts the Stripe CLI webhook listener as part of `pnpm run dev`.
 * Skipped automatically when STRIPE_CLI_PATH is unset or in CI/production.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Resolve stripe binary: prefer env override, then common install locations
const stripeBin =
  process.env.STRIPE_CLI_PATH ||
  path.join(os.homedir(), 'AppData', 'Local', 'stripe', 'stripe.exe');

const forwardTo =
  process.env.STRIPE_WEBHOOK_FORWARD_TO || 'localhost:3007/webhooks/stripe';

const appointmentsForwardTo =
  process.env.STRIPE_APPOINTMENTS_WEBHOOK_FORWARD_TO || 'localhost:3000/api/appointments/webhook/stripe';

const events = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'checkout.session.completed',
  'checkout.session.expired',
].join(',');

console.log(`[stripe-webhooks] Forwarding Stripe events → ${forwardTo}`);
console.log(`[stripe-webhooks] Forwarding appointment events → ${appointmentsForwardTo}`);

const child = spawn(
  stripeBin,
  ['listen', '--forward-to', forwardTo, '--events', events],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Redirect Stripe CLI config away from ~/.config (may be restricted on Windows)
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(os.homedir(), 'AppData', 'Roaming'),
    },
  }
);

// Second listener: forwards checkout events to the shell app's appointments webhook
const appointmentsEvents = 'checkout.session.completed,checkout.session.expired';
const child2 = spawn(
  stripeBin,
  ['listen', '--forward-to', appointmentsForwardTo, '--events', appointmentsEvents],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(os.homedir(), 'AppData', 'Roaming'),
    },
  }
);

child2.on('error', (err) => {
  if (err.code === 'ENOENT') return; // already handled by child
  console.error('[stripe-webhooks:appointments]', err.message);
});

child2.on('exit', (code) => {
  if (code) console.warn(`[stripe-webhooks:appointments] exited with code ${code}`);
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.warn(
      `[stripe-webhooks] Stripe CLI not found at "${stripeBin}" — skipping webhook listener.\n` +
      `  Set STRIPE_CLI_PATH to the stripe binary if it is installed elsewhere.`
    );
    process.exit(0); // Non-fatal: rest of dev pipeline continues
  }
  console.error('[stripe-webhooks]', err.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
