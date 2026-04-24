import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DOMAIN = process.env.PLATFORM_DOMAIN!;

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const url  = req.nextUrl.clone();

  // Subdomain: john.coachplatform.com → /coaches/john
  const sub = host.match(new RegExp(`^([a-z0-9-]+)\\.${DOMAIN.replace(/\./g, '\\.')}$`));
  if (sub && sub[1] !== 'www' && sub[1] !== 'app') {
    url.pathname = `/coaches/${sub[1]}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Custom domain → look up slug in coach_profiles
  if (!host.endsWith(DOMAIN)) {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data } = await sb.from('coach_profiles').select('slug').eq('custom_domain', host).single();
    if (data) {
      url.pathname = `/coaches/${data.slug}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|api|favicon).*)'] };
