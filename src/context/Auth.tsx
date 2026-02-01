import React from 'react';
import * as Sentry from '@sentry/react';
import { User } from '../types';
import { setProfilePrivacy, initializePrivateMockUser } from '../api/privacy';
import { connectSocket, disconnectSocket } from '../services/socketio';
import { db } from '../utils/db';

const AVATAR_KEY = (id: string) => `clips_app_avatar_${id}`;
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
      let userToSet: User;
      if (parsed && !parsed.local) {
        // Old format - create new format with defaults; keep bio/socialLinks/placesTraveled if present
        userToSet = {
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
          bio: parsed.bio || undefined,
          socialLinks: parsed.socialLinks || undefined,
          placesTraveled: parsed.placesTraveled || undefined,
          is_private: parsed.is_private || false
        };
        setUser(userToSet);
        if (userToSet.handle) {
          setProfilePrivacy(userToSet.handle, userToSet.is_private || false);
        }
      } else {
        userToSet = parsed;
        setUser(userToSet);
        if (parsed.handle) {
          setProfilePrivacy(parsed.handle, parsed.is_private || false);
        }
        if (parsed.handle) {
          try {
            connectSocket(parsed.handle);
          } catch (e) {
            console.warn('Socket connect skipped:', e);
          }
        }
        if (parsed.handle) {
          import('../services/notifications').then(({ initializeNotifications }) => {
            initializeNotifications();
          });
        }
        // If we have an auth token (Laravel), refresh user from API so handle and profile are correct (fixes Share/DM list after refresh)
        const token = localStorage.getItem('authToken');
        if (token && import.meta.env.VITE_USE_LARAVEL_API !== 'false') {
          import('../api/client').then(({ getCurrentUser }) => {
            getCurrentUser()
              .then((apiUser: any) => {
                const updated = {
                  ...userToSet,
                  handle: apiUser.handle ?? userToSet.handle,
                  name: apiUser.display_name ?? apiUser.name ?? apiUser.username ?? userToSet.name,
                  email: apiUser.email ?? userToSet.email,
                  local: apiUser.location_local ?? userToSet.local,
                  regional: apiUser.location_regional ?? userToSet.regional,
                  national: apiUser.location_national ?? userToSet.national,
                  avatarUrl: apiUser.avatar_url ?? userToSet.avatarUrl,
                  is_private: apiUser.is_private ?? userToSet.is_private,
                };
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
              })
              .catch(() => {});
          });
        }
        // Restore profile pic from IndexedDB (survives refresh on phone)
        if (!userToSet.avatarUrl) {
          db.get(AVATAR_KEY(userToSet.id))
            .then((avatarUrl: string | undefined) => {
              if (avatarUrl) {
                setUser((prev) => (prev && prev.id === userToSet.id ? { ...prev, avatarUrl } : prev));
              }
            })
            .catch(() => {});
        }
        return;
      }
      // For converted (old-format) user: restore profile pic from IndexedDB if missing
      if (!userToSet.avatarUrl) {
        db.get(AVATAR_KEY(userToSet.id))
          .then((avatarUrl: string | undefined) => {
            if (avatarUrl) {
              setUser((prev) => (prev && prev.id === userToSet.id ? { ...prev, avatarUrl } : prev));
            }
          })
          .catch(() => {});
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
    // Persist large base64 avatar in IndexedDB (survives refresh); strip from localStorage to avoid quota exceeded
    const toStore = { ...u };
    if (typeof toStore.avatarUrl === 'string' && toStore.avatarUrl.length > 2000) {
      db.set(AVATAR_KEY(u.id), toStore.avatarUrl).catch(() => {});
      toStore.avatarUrl = undefined;
    }
    localStorage.setItem('user', JSON.stringify(toStore));
    // Sync privacy setting
    if (u.handle) {
      setProfilePrivacy(u.handle, u.is_private || false);
      try {
        connectSocket(u.handle);
      } catch (e) {
        console.warn('Socket connect skipped:', e);
      }
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
