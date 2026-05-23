import { NextRequest, NextResponse } from 'next/server';
import { getCoachById, updateCoachProfile, updateSocialMedia } from '@coaching/tools';
import { CoachingType } from '@coaching/sdk';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') ?? '';
  if (!userId) return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
  const profile = await getCoachById(userId);
  return NextResponse.json({ success: true, data: profile });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, displayName, slug, coachingType, customDomain, bio, logo, socialMedia } = await req.json() as {
      userId: string;
      displayName?: string;
      slug?: string;
      coachingType?: CoachingType | string;
      customDomain?: string;
      bio?: string;
      logo?: string | null;
      socialMedia?: Record<string, string>;
    };
    if (!userId) return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });

    if (socialMedia !== undefined) {
      await updateSocialMedia(userId, socialMedia);
      return NextResponse.json({ success: true });
    }

    const profile = await updateCoachProfile(userId, { displayName, slug, coachingType, customDomain, bio, logo });
    return NextResponse.json({ success: true, data: profile });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 400 });
  }
}
