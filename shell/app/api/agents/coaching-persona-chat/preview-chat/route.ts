import { NextRequest, NextResponse } from 'next/server';
import { getCoachById } from '@coaching/tools';

export async function POST(req: NextRequest) {
  try {
    const { userId, message, history } = await req.json() as {
      userId: string;
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const coach = await getCoachById(userId);
    if (!coach?.slug) return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 });

    const llmProvider = req.cookies.get('llm_provider')?.value ?? process.env.LLM_PROVIDER ?? 'gemini';
    const port = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
    const token = process.env.SHELL_INTERNAL_TOKEN;

    const upstream = await fetch(`http://localhost:${port}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ coachSlug: coach.slug, message, history: history ?? [], llmProvider }),
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
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
