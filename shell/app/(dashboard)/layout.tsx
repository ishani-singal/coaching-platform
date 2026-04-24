import Link from 'next/link';

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
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
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50 p-8">{children}</main>
    </div>
  );
}
