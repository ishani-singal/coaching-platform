import { NextRequest, NextResponse } from 'next/server';
import { checkSlugAvailable } from '@coaching/tools';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const available = await checkSlugAvailable(slug);
  return NextResponse.json({ available });
}
