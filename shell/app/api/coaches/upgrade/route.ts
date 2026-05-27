import { NextRequest, NextResponse } from 'next/server';
import { upgradeToCoach } from '@coaching/skills';

export async function POST(req: NextRequest) {
  let step = 'parse';
  try {
    step = 'parse';
    const { userId, slug, displayName, includedProgramIds } = await req.json() as { userId: string; slug: string; displayName: string; includedProgramIds?: string[] };
    if (!userId) return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    step = 'upgradeToCoach';
    const result = await upgradeToCoach(userId, slug, displayName, includedProgramIds);
    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'unknown error';
    return NextResponse.json({ success: false, message: `${step} failed: ${msg}` }, { status: 400 });
  }
}
