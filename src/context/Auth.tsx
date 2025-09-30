import React from 'react';
import * as Sentry from '@sentry/react';

type User = { id: string; name: string };
type AuthCtx = { user: User | null; login: (name: string) => void; logout: () => void };
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  
  const login = (name: string) => {
    const u = { 
      id: name.trim().toLowerCase() || 'me', 
      name: name.trim() || 'Me' 
    };
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    Sentry.setUser({ id: u.id, username: u.name });
  };
  
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    Sentry.setUser(null);
  };
  
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
