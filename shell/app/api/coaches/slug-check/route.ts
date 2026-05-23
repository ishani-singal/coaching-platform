import { NextRequest, NextResponse } from 'next/server';
import { checkSlugAvailable } from '@coaching/tools';

export async function GET(req: NextRequest) {
  const slug           = req.nextUrl.searchParams.get('slug') ?? '';
  const excludeCoachId = req.nextUrl.searchParams.get('excludeCoachId') ?? undefined;
  const available      = await checkSlugAvailable(slug, excludeCoachId);
  return NextResponse.json({ available });
}
