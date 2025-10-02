import React from 'react';
// import * as Sentry from '@sentry/react';
import { apiClient } from '../utils/api';

type User = { 
  id: string; 
  name: string; 
  username?: string;
  bio?: string;
  website?: string;
  location?: string;
  profileImage?: string;
};
type AuthCtx = { 
  user: User | null; 
  login: (name: string) => void; 
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
};
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  
  const login = async (credentials: { login: string; password: string; remember_me?: boolean }) => {
    try {
      const response = await apiClient.login(credentials);
      if (response.success && response.user) {
        const u = {
          id: response.user.id,
          name: response.user.name,
          username: response.user.username,
          bio: response.user.bio,
          website: response.user.website,
          location: response.user.location,
          profileImage: response.user.profile_image
        };
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
        // Sentry.setUser({ id: u.id, username: u.name });
        return response;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    // Sentry.setUser({ id: updatedUser.id, username: updatedUser.name });
  };
  
  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      // Sentry.setUser(null);
    }
  };
  
  return <Ctx.Provider value={{ user, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
