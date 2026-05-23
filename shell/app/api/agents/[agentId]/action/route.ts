import { NextRequest, NextResponse } from 'next/server';

// In production agents run as separate Azure Container Apps.
// AGENT_*_URL env vars are set on the App Service by the deploy workflow.
// Falls back to localhost port for local development.
const AGENT_URL_ENV: Record<string, string> = {
  'coaching-program-builder': 'AGENT_PROGRAM_BUILDER_URL',
  'coaching-program-runner':  'AGENT_PROGRAM_RUNNER_URL',
  'coaching-coach-library':   'AGENT_COACH_LIBRARY_URL',
  'coaching-persona-chat':    'AGENT_PERSONA_CHAT_URL',
  'coaching-crm':             'AGENT_CRM_URL',
  'coaching-licensing':       'AGENT_LICENSING_URL',
  'coaching-payment':         'AGENT_PAYMENT_URL',
};

const AGENT_PORTS: Record<string, number> = {
  'coaching-program-builder': 3001,
  'coaching-program-runner':  3002,
  'coaching-coach-library':   3003,
  'coaching-persona-chat':    3004,
  'coaching-crm':             3005,
  'coaching-licensing':       3006,
  'coaching-payment':         3007,
};

function resolveAgentBase(agentId: string): string | null {
  const envKey = AGENT_URL_ENV[agentId];
  if (envKey && process.env[envKey]) return process.env[envKey]!;
  const port = AGENT_PORTS[agentId];
  return port ? `http://localhost:${port}` : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const base = resolveAgentBase(agentId);
  if (!base) return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

  const body = await req.text();
  const token = process.env.SHELL_INTERNAL_TOKEN;
  try {
    const res = await fetch(`${base}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Agent unreachable';
    return NextResponse.json({ success: false, message: `Agent ${agentId} error: ${msg}` }, { status: 502 });
  }
}
