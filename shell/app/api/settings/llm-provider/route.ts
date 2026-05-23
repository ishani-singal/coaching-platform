import { NextRequest, NextResponse } from 'next/server';

const VALID_PROVIDERS = ['gemini', 'azure-openai'] as const;
type Provider = typeof VALID_PROVIDERS[number];

const COOKIE_NAME = 'llm_provider';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  const provider: Provider =
    cookie && VALID_PROVIDERS.includes(cookie.value as Provider)
      ? (cookie.value as Provider)
      : ((process.env.LLM_PROVIDER ?? 'gemini') as Provider);

  return NextResponse.json({ provider });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { provider?: unknown };
  const provider = body.provider;

  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ provider });
  res.cookies.set(COOKIE_NAME, provider as string, {
    httpOnly: false, // readable by JS so ModelPicker can sync state
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}
