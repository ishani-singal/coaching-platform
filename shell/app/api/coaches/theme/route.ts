import { NextRequest, NextResponse } from 'next/server';
import { updateCoachNavItems } from '@coaching/tools';
import { NavItem } from '@coaching/sdk';

export async function POST(req: NextRequest) {
  try {
    const { userId, navItems } = await req.json() as { userId: string; navItems: NavItem[] };
    if (!userId) return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
    if (!Array.isArray(navItems)) return NextResponse.json({ success: false, message: 'navItems must be an array' }, { status: 400 });
    await updateCoachNavItems(userId, navItems);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 400 });
  }
}
