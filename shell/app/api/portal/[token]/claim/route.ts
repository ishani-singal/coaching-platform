import { NextRequest, NextResponse } from 'next/server';
import { linkClientAccountByToken } from '@coaching/tools';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { userId } = await req.json() as { userId?: string };
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const profile = await linkClientAccountByToken(token, userId);
    return NextResponse.json({ success: true, data: profile });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 400 });
  }
}
