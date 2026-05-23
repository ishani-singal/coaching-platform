import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    coachSlug:   string;
    history:     { role: 'user' | 'assistant'; content: string }[];
    personType?: 'client' | 'trainee' | 'prospect';
  };

  const llmProvider = req.cookies.get('llm_provider')?.value ?? process.env.LLM_PROVIDER ?? 'gemini';
  const port  = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
  const token = process.env.SHELL_INTERNAL_TOKEN;

  const upstream = await fetch(`http://localhost:${port}/chat/generate-questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...body, llmProvider }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ success: false }, { status: 502 });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}
