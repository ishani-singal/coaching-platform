import { NextRequest, NextResponse } from 'next/server';

function resolveSkillzUrl(agentId: string): string | null {
  const envKey = `SKILLZ_AGENT_${agentId.toUpperCase().replace(/-/g, '_')}_URL`;
  return process.env[envKey] ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const baseUrl = resolveSkillzUrl(agentId);
  if (!baseUrl) return NextResponse.json({ error: `No URL for skillz agent: ${agentId}` }, { status: 404 });

  const body = await req.text();
  const token = process.env.SKILLZ_AGENT_AUTH_TOKEN;
  const res = await fetch(`${baseUrl}/context`, {
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
