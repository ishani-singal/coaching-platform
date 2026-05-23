import { NextRequest, NextResponse } from 'next/server';
import { getCoachBySlug, getPublishedPackagesForCoach, configureBridge } from '@coaching/tools';
import { enrollClient } from '@coaching/skills';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { packageId, name, email, goals } = await req.json() as {
      packageId: string;
      name: string;
      email: string;
      goals?: string;
    };

    if (!packageId || !name || !email) {
      return NextResponse.json({ success: false, message: 'packageId, name and email are required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 });
    }

    const coach = await getCoachBySlug(slug);

    const packages = await getPublishedPackagesForCoach(coach.userId);
    const pkg = packages.find(p => p.packageId === packageId);
    if (!pkg) {
      return NextResponse.json({ success: false, message: 'Program not found or not available' }, { status: 404 });
    }

    const result = await enrollClient(packageId, coach.userId, { name, email, goals }, 'client');

    return NextResponse.json({ success: true, portalUrl: result.portalUrl });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
