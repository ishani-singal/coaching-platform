import { NextRequest, NextResponse } from 'next/server';
import { getCoachBySlug, configureBridge } from '@coaching/tools';
import { enrollClient } from '@coaching/skills';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; packageId: string }> }) {
  try {
    const { slug, packageId } = await params;
    const body = await req.json() as { name: string; email: string; phone?: string; goals?: string };

    const coach = await getCoachBySlug(slug);
    const { enrollment, portalUrl } = await enrollClient(
      packageId,
      coach.userId,
      { name: body.name, email: body.email, phone: body.phone, goals: body.goals },
      'client'
    );

    return NextResponse.redirect(new URL(portalUrl, req.url));
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
