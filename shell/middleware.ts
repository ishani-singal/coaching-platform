import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DOMAIN = process.env.PLATFORM_DOMAIN?.trim() || 'coaching-platform-prod-shell.azurewebsites.net';

// ── In-memory rate limiter (per-IP, no Redis required) ────────────────────
// Limits POST /api/coaches/*/chat to 60 requests per minute per IP.
const RATE_LIMIT_MAX      = 60;
const RATE_LIMIT_WINDOW   = 60_000; // 1 minute in ms
const ipCounters          = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now    = Date.now();
  const record = ipCounters.get(ip);
  if (!record || now >= record.resetAt) {
    ipCounters.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
}

const CHAT_ROUTE_RE = /^\/api\/coaches\/[^/]+\/chat$/;

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const url  = req.nextUrl.clone();

  // ── Rate-limit POST /api/coaches/*/chat ─────────────────────────────────
  if (req.method === 'POST' && CHAT_ROUTE_RE.test(url.pathname)) {
    // x-forwarded-for may contain a comma-separated list; take the first (client) IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip        = (forwarded ? forwarded.split(',')[0] : '127.0.0.1').trim();
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests — please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
  }

  // Subdomain: john.coachplatform.com → /coaches/john
  // Skip rewrite for /portal routes so client portal links work from subdomain dashboards
  const sub = host.match(new RegExp(`^([a-z0-9-]+)\.${DOMAIN.replace(/\./g, '\\.')}$`));
  if (sub && sub[1] !== 'www' && sub[1] !== 'app' && !url.pathname.startsWith('/portal')) {
    url.pathname = `/coaches/${sub[1]}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Custom domain → look up slug in user_profiles
  if (DOMAIN && !host.endsWith(DOMAIN) && !host.startsWith('localhost')) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from('user_profiles').select('slug').eq('custom_domain', host).single();
    if (data) {
      url.pathname = `/coaches/${data.slug}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // Auth: refresh session + protect dashboard routes
  const isDashboard =
    url.pathname !== '/' &&
    !url.pathname.startsWith('/login') &&
    !url.pathname.startsWith('/coaches') &&
    !url.pathname.startsWith('/portal') &&
    !url.pathname.startsWith('/api');

  if (isDashboard) {
    let response = NextResponse.next({ request: req });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            response = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|api|favicon).*)'] };
