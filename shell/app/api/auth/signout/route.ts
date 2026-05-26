import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const host  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'https';
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL('/', origin));
}
