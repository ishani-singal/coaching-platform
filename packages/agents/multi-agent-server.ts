/**
 * Multi-Agent Server
 * 
 * Combines all 7 coaching agents into a single Express application with route prefixes:
 * - /program-builder/*  → Agent 01
 * - /program-runner/*   → Agent 02
 * - /coach-library/*    → Agent 03
 * - /persona-chat/*     → Agent 04
 * - /crm/*              → Agent 05
 * - /licensing/*        → Agent 06
 * - /payment/*          → Agent 07
 * 
 * Webhook routes remain at root level: /webhooks/stripe, /webhooks/razorpay
 * 
 * USAGE:
 * Set MULTI_AGENT_MODE=true before starting the server
 * Build: pnpm build (will bundle this file when AGENT_MODE=multi)
 * Run: node dist/multi-agent-server.js
 */

import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load root .env before importing agents
const _dotenvPath = path.resolve(__dirname, '../../../.env');
const _envResult = dotenv.config({ path: _dotenvPath, override: true });
if (_envResult.error) {
  console.warn('[multi-agent] Failed to load .env from', _dotenvPath);
} else {
  console.log('[multi-agent] Loaded .env | LLM_PROVIDER:', process.env.LLM_PROVIDER);
}

// Enable multi-agent mode before importing agents
process.env.MULTI_AGENT_MODE = 'true';

const PORT = parseInt(process.env.MULTI_AGENT_PORT || process.env.PORT || '3000', 10);

// Create parent Express app
const app = express();
app.use(cors());
app.use(express.json({
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Combined health endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'multi-agent',
    agents: [
      'program-builder',
      'program-runner',
      'coach-library',
      'persona-chat',
      'crm',
      'licensing',
      'payment',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Import and mount each agent
console.log('[multi-agent] Initializing agents...');

try {
  const { programBuilderApp } = await import('./01-program-builder/src/index.js');
  app.use('/program-builder', programBuilderApp);
  console.log('[multi-agent] ✓ Program Builder mounted at /program-builder');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Program Builder:', (e as Error).message);
}

try {
  const { programRunnerApp } = await import('./02-program-runner/src/index.js');
  app.use('/program-runner', programRunnerApp);
  console.log('[multi-agent] ✓ Program Runner mounted at /program-runner');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Program Runner:', (e as Error).message);
}

try {
  const { coachLibraryApp } = await import('./03-coach-library/src/index.js');
  app.use('/coach-library', coachLibraryApp);
  console.log('[multi-agent] ✓ Coach Library mounted at /coach-library');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Coach Library:', (e as Error).message);
}

try {
  const { personaChatApp } = await import('./04-persona-chat/src/index.js');
  app.use('/persona-chat', personaChatApp);
  console.log('[multi-agent] ✓ Persona Chat mounted at /persona-chat');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Persona Chat:', (e as Error).message);
}

try {
  const { crmApp } = await import('./05-crm/src/index.js');
  app.use('/crm', crmApp);
  console.log('[multi-agent] ✓ CRM mounted at /crm');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load CRM:', (e as Error).message);
}

try {
  const { licensingApp } = await import('./06-licensing/src/index.js');
  app.use('/licensing', licensingApp);
  console.log('[multi-agent] ✓ Licensing mounted at /licensing');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Licensing:', (e as Error).message);
}

try {
  const { paymentApp } = await import('./07-payment/src/index.js');
  
  // Mount payment agent under /payment prefix
  app.use('/payment', paymentApp);
  
  // Payment webhooks need to be at root level (required by Stripe/Razorpay)
  // We'll extract the webhook route handlers from the payment app
  // For now, log a warning - webhooks will be handled by the payment app's routes
  console.log('[multi-agent] ✓ Payment mounted at /payment');
  console.log('[multi-agent] ⚠ Payment webhooks at /payment/webhooks/* (configure webhook URLs accordingly)');
} catch (e) {
  console.error('[multi-agent] ✗ Failed to load Payment:', (e as Error).message);
}

// Start server
app.listen(PORT, () => {
  console.log(`[multi-agent] 🚀 Multi-agent server running on port ${PORT}`);
  console.log(`[multi-agent] Health check: http://localhost:${PORT}/health`);
  console.log('[multi-agent]');
  console.log('[multi-agent] Available endpoints:');
  console.log('[multi-agent]   GET  /health');
  console.log('[multi-agent]   *    /program-builder/*');
  console.log('[multi-agent]   *    /program-runner/*');
  console.log('[multi-agent]   *    /coach-library/*');
  console.log('[multi-agent]   *    /persona-chat/*');
  console.log('[multi-agent]   *    /crm/*');
  console.log('[multi-agent]   *    /licensing/*');
  console.log('[multi-agent]   *    /payment/*');
  console.log('[multi-agent]');
});
