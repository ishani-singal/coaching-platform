import { NextRequest, NextResponse } from 'next/server';
import { getEnrollmentByToken, configureBridge } from '@coaching/tools';
import { completeSection } from '@coaching/skills';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { sectionId, responseData } = await req.json() as { sectionId: string; responseData?: Record<string, unknown> };

    const enrollment = await getEnrollmentByToken(token);
    const flags = await completeSection(enrollment.enrollmentId, sectionId, responseData);
    return NextResponse.json({ success: true, ...flags });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
