'use client';
import { createContext, useContext } from 'react';

const SessionContext = createContext<{ userId: string }>({ userId: '' });

export function SessionProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return <SessionContext.Provider value={{ userId }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
