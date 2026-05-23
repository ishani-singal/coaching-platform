import { redirect } from 'next/navigation';
import { Suspense } from 'react';
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
          <Suspense fallback={null}>
            <Navbar email={user.email ?? ''} />
          </Suspense>
        <main className="flex-1 overflow-auto theme-main p-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
