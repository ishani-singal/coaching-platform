'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavItem } from '@coaching/sdk';

const NAV_LABELS: Record<NavItem, string> = {
  home:     'Home',
  services: 'Services',
  events:   'Events',
  about:    'About Us',
  blog:     'Blog',
  faq:      'FAQ',
  contact:  'Contact Us',
  search:   'Search',
  library:  'Library',
};

function navHref(slug: string, item: NavItem): string | null {
  switch (item) {
    case 'home':     return `/coaches/${slug}`;
    case 'services': return `/coaches/${slug}/services`;
    case 'events':   return `/coaches/${slug}/events`;
    case 'about':    return `/coaches/${slug}/about`;
    case 'blog':     return `/coaches/${slug}/blog`;
    case 'faq':      return `/coaches/${slug}/faq`;
    case 'contact':  return `/coaches/${slug}/contact`;
    case 'library':  return `/coaches/${slug}/library`;
    case 'search':   return null; // handled via toggle
  }
}

interface Props {
  slug: string;
  displayName: string;
  navItems: NavItem[];
}

export default function CoachNavbar({ slug, displayName, navItems }: Props) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(item: NavItem): boolean {
    const href = navHref(slug, item);
    if (!href) return false;
    if (item === 'home') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / coach name */}
          <Link href={`/coaches/${slug}`} className="font-bold text-lg text-gray-900 hover:text-indigo-600 transition-colors truncate max-w-[200px]">
            {displayName}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              if (item === 'search') {
                return (
                  <button
                    key="search"
                    onClick={() => setSearchOpen(o => !o)}
                    className={
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
                      (searchOpen
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50')
                    }
                    aria-label="Search"
                  >
                    <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1 0 4 10a7 7 0 0 0 12.65 6.65z" />
                    </svg>
                    Search
                  </button>
                );
              }

              const href = navHref(slug, item)!;
              const active = isActive(item);

              return (
                <Link
                  key={item}
                  href={href}
                  className={
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
                    (active
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50')
                  }
                >
                  {NAV_LABELS[item]}
                </Link>
              );
            })}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1 0 4 10a7 7 0 0 0 12.65 6.65z" />
              </svg>
              <input
                autoFocus
                type="search"
                placeholder="Search programs, resources…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-gray-400 mt-2 px-1">
                Press Enter or navigate to{' '}
                <Link
                  href={`/coaches/${slug}/services`}
                  className="text-indigo-500 hover:underline"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                >
                  Services
                </Link>{' '}
                or{' '}
                <Link
                  href={`/coaches/${slug}`}
                  className="text-indigo-500 hover:underline"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                >
                  Home
                </Link>{' '}
                to find what you&#39;re looking for.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {navItems.map(item => {
            if (item === 'search') {
              return (
                <button
                  key="search"
                  onClick={() => { setSearchOpen(o => !o); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1 0 4 10a7 7 0 0 0 12.65 6.65z" />
                  </svg>
                  Search
                </button>
              );
            }

            const href = navHref(slug, item)!;
            const active = isActive(item);

            return (
              <Link
                key={item}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ' +
                  (active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50')
                }
              >
                {NAV_LABELS[item]}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
