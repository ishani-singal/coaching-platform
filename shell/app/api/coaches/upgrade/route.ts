import { NextRequest, NextResponse } from 'next/server';
import { upgradeToCoach } from '@coaching/skills';

export async function POST(req: NextRequest) {
  try {
    const { userId, slug, displayName, includedProgramIds } = await req.json() as { userId: string; slug: string; displayName: string; includedProgramIds?: string[] };
    const result = await upgradeToCoach(userId, slug, displayName, includedProgramIds);
    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 400 });
  }
}
