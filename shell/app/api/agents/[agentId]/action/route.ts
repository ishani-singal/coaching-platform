import { NextRequest, NextResponse } from 'next/server';

const AGENT_PORTS: Record<string, number> = {
  'coaching-program-builder': 3001,
  'coaching-program-runner':  3002,
  'coaching-coach-library':   3003,
  'coaching-persona-chat':    3004,
  'coaching-crm':             3005,
  'coaching-licensing':       3006,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const port = AGENT_PORTS[agentId];
  if (!port) return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });

  const body = await req.text();
  const token = process.env.SHELL_INTERNAL_TOKEN;
  const res = await fetch(`http://localhost:${port}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
