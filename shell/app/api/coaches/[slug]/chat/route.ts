import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json() as { message: string; history: unknown[]; clientProfile?: unknown };

  const port = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
  const upstream = await fetch(`http://localhost:${port}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coachSlug: slug, ...body }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Persona chat unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
