import { NextRequest, NextResponse } from 'next/server';
import { getEnrollmentByToken } from '@coaching/tools';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const data = await getEnrollmentByToken(token);
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 404 });
  }
}
