import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SessionProvider } from '@/components/SessionProvider';

const NAV = [
  { href: '/',           label: '🏠 Home' },
  { href: '/programs',   label: '📚 Programs' },
  { href: '/clients',    label: '🎯 Clients' },
  { href: '/library',    label: '🎬 Library' },
  { href: '/persona',    label: '🧠 Persona' },
  { href: '/booking',    label: '📅 Booking' },
  { href: '/licensing',  label: '💰 Licensing' },
  { href: '/crm',        label: '👥 CRM' },
  { href: '/settings',   label: '⚙️ Settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <SessionProvider userId={user.id}>
      <div className="flex h-screen">
        <aside className="w-56 bg-gray-900 text-white flex flex-col p-4 gap-1 shrink-0">
          <div className="text-lg font-bold mb-6">Coaching Platform</div>
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded hover:bg-gray-700 text-sm transition-colors"
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-auto pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <main className="flex-1 overflow-auto bg-gray-50 p-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
