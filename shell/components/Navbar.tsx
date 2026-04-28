'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LEFT_NAV = [
  { href: '/',          label: 'Home' },
  { href: '/programs',  label: 'Programs' },
  { href: '/clients',   label: 'Clients' },
  { href: '/library',   label: 'Library' },
  { href: '/persona',   label: 'Chat' },
  { href: '/booking',   label: 'Booking' },
  { href: '/licensing', label: 'Licensing' },
  { href: '/crm',       label: 'CRM' },
];

interface NavbarProps {
  email: string;
}

export function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${
      isActive(href)
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  // Get initials from email for the avatar
  const initials = email ? email[0].toUpperCase() : '?';

  return (
    <nav className="bg-gray-900 border-b border-gray-800 text-white h-16 flex items-center px-6 shrink-0 shadow-lg">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 mr-8 shrink-0 group">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-indigo-500 transition-colors">
          S
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">Skillz</span>
      </Link>

      {/* Divider */}
      <div className="w-px h-5 bg-gray-700 mr-6 shrink-0" />

      {/* Left-aligned nav links */}
      <div className="flex items-center gap-0.5 flex-1">
        {LEFT_NAV.map(n => (
          <Link key={n.href} href={n.href} className={linkClass(n.href)}>
            {n.label}
          </Link>
        ))}
      </div>

      {/* Right-aligned: Settings + user */}
      <div className="flex items-center gap-1 ml-4 shrink-0">
        <Link href="/settings" className={linkClass('/settings')}>
          Settings
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700 mx-3 shrink-0" />

        {/* User section */}
        <div className="flex items-center gap-2.5">
          <div
            title={email}
            className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-semibold text-white shrink-0"
          >
            {initials}
          </div>
          <span className="text-xs text-gray-400 hidden lg:block max-w-[160px] truncate">
            {email}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-gray-200 transition-colors ml-1 border border-gray-700 hover:border-gray-500 rounded px-2 py-1"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
