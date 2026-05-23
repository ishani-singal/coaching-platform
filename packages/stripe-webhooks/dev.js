/**
 * Combined dev runner — starts both services in parallel:
 *   1. Stripe CLI webhook listener  → localhost:3007/webhooks/stripe
 *   2. ngrok tunnel                 → localhost:3007 (prints Razorpay URL)
 *
 * Each service is non-fatal: if Stripe CLI or ngrok auth is missing,
 * the warning is printed and the rest of `pnpm run dev` continues.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { spawn } = require('child_process');

// Run Stripe listener in a child process (keeps its own stdio)
const stripeChild = spawn(process.execPath, [path.join(__dirname, 'stripe-listen.js')], {
  stdio: 'inherit',
  env:   process.env,
});

stripeChild.on('error', () => {}); // errors handled inside stripe-listen.js

// Run ngrok tunnel in a child process so its output is visible via turbo
const ngrokChild = spawn(process.execPath, [path.join(__dirname, 'ngrok-tunnel.js')], {
  stdio: 'inherit',
  env:   process.env,
});

ngrokChild.on('error', () => {});

// Keep process alive until both children exit
function maybeExit() {
  // noop — turbo manages lifetime
}
stripeChild.on('exit', maybeExit);
ngrokChild.on('exit', maybeExit);
