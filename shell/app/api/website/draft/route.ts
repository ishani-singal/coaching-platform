import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWebsiteDraft, saveWebsiteDraft, configureBridge } from '@coaching/tools';
import type { WebsiteConfig } from '@coaching/sdk';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const draft = await getWebsiteDraft(user.id);
  return NextResponse.json({ success: true, data: draft });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { config: WebsiteConfig };
  if (!body.config) return NextResponse.json({ success: false, message: 'Missing config' }, { status: 400 });

  await saveWebsiteDraft(user.id, body.config);
  return NextResponse.json({ success: true });
}
