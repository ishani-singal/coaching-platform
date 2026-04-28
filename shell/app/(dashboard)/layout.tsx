import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SessionProvider } from '@/components/SessionProvider';
import { Navbar } from '@/components/Navbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <SessionProvider userId={user.id}>
      <div className="flex flex-col h-screen">
        <Navbar email={user.email ?? ''} />
        <main className="flex-1 overflow-auto bg-gray-50 p-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
