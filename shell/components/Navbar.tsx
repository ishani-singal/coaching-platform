'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { ModelPicker } from './ModelPicker';

const LEFT_NAV = [
  { href: '/programs?tab=programs', label: 'Programs' },
  { href: '/programs?tab=packages', label: 'Packages' },
  { href: '/library',               label: 'Library'  },
  { href: '/persona',               label: 'Chat'     },
  { href: '/booking',               label: 'Booking'  },
  { href: '/crm',                   label: 'CRM'      },
  { href: '/website',               label: 'Website'  },
];

interface NavbarProps {
  email: string;
}

export function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = (href: string) => {
    if (href.includes('?')) {
      const [hrefPath, hrefQuery] = href.split('?');
      if (pathname !== hrefPath) return false;
      const tab = new URLSearchParams(hrefQuery).get('tab');
      const currentTab = searchParams.get('tab') ?? 'programs';
      return currentTab === tab;
    }
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  const linkClass = (href: string) =>
    `text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${
      isActive(href)
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'theme-nav-link'
    }`;

  const initials = email ? email[0].toUpperCase() : '?';

  return (
    <nav className="theme-nav border-b h-16 flex items-center px-6 shrink-0 shadow-lg">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 mr-8 shrink-0 group">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-indigo-500 transition-colors">
          S
        </div>
        <span className="text-sm font-semibold theme-nav-brand tracking-wide">Skillz</span>
      </Link>

      {/* Divider */}
      <div className="w-px h-5 theme-nav-divider mr-6 shrink-0" />

      {/* Left-aligned nav links */}
      <div className="flex items-center gap-0.5 flex-1">
        {LEFT_NAV.map(n => (
          <Link key={n.href} href={n.href} className={linkClass(n.href)}>
            {n.label}
          </Link>
        ))}
      </div>

      {/* Right-aligned: Settings + theme toggle + user */}
      <div className="flex items-center gap-1 ml-4 shrink-0">
        <ModelPicker />

        <Link
          href="/settings"
          title="Settings"
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
            isActive('/settings') ? 'bg-indigo-600 text-white' : 'theme-nav-link'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>

        <ThemeToggle />

        {/* User section */}
        <div className="flex items-center gap-2.5">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-md theme-nav-link transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
