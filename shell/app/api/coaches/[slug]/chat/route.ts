import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceClient() {
  return createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Sanitise message content: strip HTML tags, limit length
function sanitiseMessage(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')          // strip HTML
    .replace(/javascript:/gi, '')      // strip js: URIs
    .slice(0, 4000)                    // max length
    .trim();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json() as {
    message:        string;
    history:        unknown[];
    clientProfile?: unknown;
    sessionId?:     string;
    questionState?: unknown;
  };

  // Validate sessionId ownership before forwarding to agent
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  if (sessionId) {
    const cookieName = `chat-session-${slug}`;
    const anonToken  = req.cookies.get(cookieName)?.value;
    const sb         = await createClient();
    const service    = serviceClient();

    const { data: { user } } = await sb.auth.getUser();

    const { data: session } = await service
      .from('prospect_chat_sessions')
      .select('prospect_user_id, anonymous_token')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isOwner =
      (user && session.prospect_user_id === user.id) ||
      (anonToken && session.anonymous_token === anonToken);

    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  // Sanitise user message
  const sanitisedBody = {
    ...body,
    message: sanitiseMessage(String(body.message ?? '')),
  };

  const llmProvider = req.cookies.get('llm_provider')?.value ?? process.env.LLM_PROVIDER ?? 'gemini';
  const port  = parseInt(process.env.AGENT_PERSONA_CHAT_PORT ?? '3004', 10);
  const token = process.env.SHELL_INTERNAL_TOKEN;

  const upstream = await fetch(`http://localhost:${port}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ coachSlug: slug, ...sanitisedBody, llmProvider }),
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
