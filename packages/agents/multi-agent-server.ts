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
 */

import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cors = require('cors');

// Load root .env before importing agents
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

// Enable multi-agent mode before importing agents
process.env.MULTI_AGENT_MODE = 'true';

const PORT = parseInt(process.env.MULTI_AGENT_PORT || process.env.PORT || '3000', 10);

const app = express();
app.use(cors());
app.use(express.json({
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'multi-agent',
    agents: ['program-builder', 'program-runner', 'coach-library', 'persona-chat', 'crm', 'licensing', 'payment'],
    timestamp: new Date().toISOString(),
  });
});

console.log('[multi-agent] Initializing agents...');

function mountAgent(name: string, mountPath: string, exportKey: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`./${name}/dist/index.js`);
    app.use(mountPath, mod[exportKey]);
    console.log(`[multi-agent] ✓ ${exportKey} mounted at ${mountPath}`);
  } catch (e) {
    console.error(`[multi-agent] ✗ Failed to load ${name}:`, (e as Error).message);
  }
}

mountAgent('01-program-builder', '/program-builder', 'programBuilderApp');
mountAgent('02-program-runner',  '/program-runner',  'programRunnerApp');
mountAgent('03-coach-library',   '/coach-library',   'coachLibraryApp');
mountAgent('04-persona-chat',    '/persona-chat',     'personaChatApp');
mountAgent('05-crm',             '/crm',              'crmApp');
mountAgent('06-licensing',       '/licensing',        'licensingApp');
mountAgent('07-payment',         '/payment',          'paymentApp');

app.listen(PORT, () => {
  console.log(`[multi-agent] Multi-agent server running on port ${PORT}`);
});
