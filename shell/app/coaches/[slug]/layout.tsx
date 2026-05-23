import { getCoachBySlug, configureBridge } from '@coaching/tools';
import type { NavItem } from '@coaching/sdk';
import CoachNavbar from '@/components/CoachNavbar';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

const DEFAULT_NAV_ITEMS: NavItem[] = ['home', 'services', 'library'];

export default async function CoachLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);
  const navItems: NavItem[] = (coach.websiteNavBar && coach.websiteNavBar.length > 0)
    ? coach.websiteNavBar
    : (coach.themeConfig?.navItems ?? DEFAULT_NAV_ITEMS);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <CoachNavbar slug={slug} displayName={coach.displayName} navItems={navItems} />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
