import React from 'react';
import * as Sentry from '@sentry/react';
import { User } from '../types';
import { setProfilePrivacy, initializePrivateMockUser } from '../api/privacy';
import { connectSocket, disconnectSocket } from '../services/socketio';
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
          countryFlag: '🇮🇪',
          avatarUrl: undefined,
          is_private: false
        };
        setUser(testUser);
        localStorage.setItem('user', JSON.stringify(testUser));
        // Sync privacy setting
        setProfilePrivacy(testUser.handle, false);
        // Initialize mock private user for testing
        initializePrivateMockUser();
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
          countryFlag: parsed.countryFlag || undefined,
          avatarUrl: parsed.avatarUrl || undefined,
          placesTraveled: parsed.placesTraveled || undefined,
          is_private: parsed.is_private || false
        };
        setUser(convertedUser);
        // Sync privacy setting
        if (convertedUser.handle) {
          setProfilePrivacy(convertedUser.handle, convertedUser.is_private || false);
        }
      } else {
        setUser(parsed);
        // Sync privacy setting
        if (parsed.handle) {
          setProfilePrivacy(parsed.handle, parsed.is_private || false);
        }
        // Connect to Socket.IO when user is loaded
        if (parsed.handle) {
          connectSocket(parsed.handle);
        }
        // Initialize Firebase notifications when user is loaded
        if (parsed.handle) {
          import('../services/notifications').then(({ initializeNotifications }) => {
            initializeNotifications();
          });
        }
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
    
    // Initialize mock private user for testing (Sarah@Artane)
    initializePrivateMockUser();
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
      countryFlag: userData.countryFlag || undefined,
      avatarUrl: userData.avatarUrl || undefined,
      bio: userData.bio || undefined,
      socialLinks: userData.socialLinks || undefined,
      placesTraveled: userData.placesTraveled || undefined,
      is_private: userData.is_private || false
    };
    setUser(u);
    // Strip large base64 avatar when saving to localStorage to avoid quota exceeded
    const toStore = { ...u };
    if (typeof toStore.avatarUrl === 'string' && toStore.avatarUrl.length > 2000) {
      toStore.avatarUrl = undefined;
    }
    localStorage.setItem('user', JSON.stringify(toStore));
    // Sync privacy setting
    if (u.handle) {
      setProfilePrivacy(u.handle, u.is_private || false);
      // Connect to Socket.IO when user logs in
      connectSocket(u.handle);
      // Initialize Firebase notifications when user logs in
      import('../services/notifications').then(({ initializeNotifications }) => {
        initializeNotifications();
      });
    }
    Sentry.setUser({ id: u.id, username: u.name });
  };

  const logout = () => {
    // Disconnect Socket.IO when user logs out
    disconnectSocket();
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
