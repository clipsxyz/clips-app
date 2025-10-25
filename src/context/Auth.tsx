import React from 'react';
import * as Sentry from '@sentry/react';
import { User } from '../types';
type AuthCtx = { user: User | null; login: (userData: any) => void; logout: () => void };
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    try {
      const s = localStorage.getItem('user');
      if (!s) {
        // Create a test user if no user exists
        const testUser: User = {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          password: '',
          age: 25,
          interests: ['Technology', 'Travel', 'Food'],
          local: 'Finglas',
          regional: 'Dublin',
          national: 'Ireland',
          handle: 'TestUser@Dublin',
          avatarUrl: undefined
        };
        setUser(testUser);
        localStorage.setItem('user', JSON.stringify(testUser));
        return;
      }

      const parsed = JSON.parse(s);
      // Handle backward compatibility for old user format
      if (parsed && !parsed.local) {
        // Old format - create new format with defaults
        const convertedUser: User = {
          id: parsed.id || parsed.name?.toLowerCase() || 'me',
          name: parsed.name || 'Me',
          email: parsed.email || '',
          password: '',
          age: parsed.age || 18,
          interests: parsed.interests || [],
          local: '',
          regional: '',
          national: '',
          handle: `${parsed.name || 'User'}@Unknown`,
          avatarUrl: parsed.avatarUrl || undefined
        };
        setUser(convertedUser);
      } else {
        setUser(parsed);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
  }, []);

  const login = (userData: any) => {
    const u: User = {
      id: userData.name.trim().toLowerCase() || 'me',
      name: userData.name.trim() || 'Me',
      email: userData.email || '',
      password: userData.password || '',
      age: userData.age || 18,
      interests: userData.interests || [],
      local: userData.local || '',
      regional: userData.regional || '',
      national: userData.national || '',
      handle: userData.handle || `${userData.name.trim()}@Unknown`,
      avatarUrl: userData.avatarUrl || undefined
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
