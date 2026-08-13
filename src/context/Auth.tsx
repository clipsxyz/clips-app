import React from 'react';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { User } from '../types';
import { setProfilePrivacy, initializePrivateMockUser, isProfilePrivate, hydratePrivacyStorage } from '../api/privacy';
import { hydrateFollowsStorage, clearUserState, getState } from '../api/posts';
import { connectSocket, disconnectSocket } from '../services/socketio';
import { db } from '../utils/db';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
import {
  clearAuthToken,
  getAuthTokenAsync,
  hydrateAuthTokenFromStorage,
} from '../utils/authTokenBridge';

const AVATAR_KEY = (id: string) => `clips_app_avatar_${id}`;
const USER_STORAGE_KEY = 'user';

async function hydrateUserFromNativeStorage(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(USER_STORAGE_KEY)) return;
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (raw) localStorage.setItem(USER_STORAGE_KEY, raw);
  } catch {
    // web / unavailable
  }
}

function persistUserToNativeStorage(userJson: string | null): void {
  void import('@react-native-async-storage/async-storage')
    .then(({ default: AsyncStorage }) => {
      if (userJson == null) return AsyncStorage.removeItem(USER_STORAGE_KEY);
      return AsyncStorage.setItem(USER_STORAGE_KEY, userJson);
    })
    .catch(() => {});
}

function setSentryUser(user: { id: string; username?: string } | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react');
    if (user) Sentry.setUser(user);
    else Sentry.setUser(null);
  } catch {
    /* Sentry optional on native */
  }
}
type AuthCtx = { user: User | null; login: (userData: any) => void; logout: () => void };
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const authRefreshGenRef = React.useRef(0);

  React.useEffect(() => {
    void hydrateAuthTokenFromStorage();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const refreshGen = authRefreshGenRef.current;

    void (async () => {
      await Promise.all([hydratePrivacyStorage(), hydrateUserFromNativeStorage()]);
      if (cancelled) return;

      // Prefetch common follow keys so getState() sees persisted follows on RN.
      await Promise.all([
        hydrateFollowsStorage('test-user'),
        hydrateFollowsStorage('anon'),
      ]);
      if (cancelled) return;

      try {
        const s = localStorage.getItem(USER_STORAGE_KEY);
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
            is_private: false,
          };
          if (cancelled) return;
          setUser(testUser);
          const testJson = JSON.stringify(testUser);
          localStorage.setItem(USER_STORAGE_KEY, testJson);
          persistUserToNativeStorage(testJson);
          await hydrateFollowsStorage(testUser.id);
          // Sync privacy setting
          setProfilePrivacy(testUser.handle, false);
          // Initialize mock private user for testing
          initializePrivateMockUser();
          return;
        }

        const parsed = JSON.parse(s);
        const previewId =
          parsed?.id != null && String(parsed.id).trim() !== ''
            ? String(parsed.id)
            : null;
        if (previewId) {
          await hydrateFollowsStorage(previewId);
          if (cancelled) return;
        }
        // Handle backward compatibility for old user format
        let userToSet: User;
        if (parsed && !parsed.local) {
          // Old format - create new format with defaults; keep bio/socialLinks/placesTraveled if present
          const migratedHandle = `${parsed.name || 'User'}@Unknown`;
          const migratedPrivate =
            typeof parsed.is_private === 'boolean'
              ? parsed.is_private
              : isProfilePrivate(migratedHandle);
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
            handle: migratedHandle,
            countryFlag:
              normalizeCountryFlagInput(parsed.countryFlag || '', parsed.national || '') || undefined,
            avatarUrl: parsed.avatarUrl || undefined,
            profileBackgroundUrl: parsed.profileBackgroundUrl || undefined,
            bio: parsed.bio || undefined,
            socialLinks: parsed.socialLinks || undefined,
            placesTraveled: parsed.placesTraveled || undefined,
            accountType:
              parsed.accountType === 'business' || parsed.account_type === 'business' || parsed.is_business === true
                ? 'business'
                : parsed.accountType === 'personal' || parsed.account_type === 'personal'
                  ? 'personal'
                  : undefined,
            is_private: migratedPrivate,
          };
          if (cancelled) return;
          setUser(userToSet);
          if (userToSet.handle) {
            setProfilePrivacy(userToSet.handle, !!userToSet.is_private);
          }
        } else {
          const resolvedPrivate =
            typeof parsed.is_private === 'boolean'
              ? parsed.is_private
              : parsed.handle
                ? isProfilePrivate(parsed.handle)
                : false;
          const normalizedFlag = normalizeCountryFlagInput(
            parsed.countryFlag || '',
            parsed.national || '',
          );
          userToSet = {
            ...parsed,
            is_private: resolvedPrivate,
            countryFlag: normalizedFlag || undefined,
          };
          if (cancelled) return;
          setUser(userToSet);
          if (normalizedFlag && normalizedFlag !== parsed.countryFlag) {
            try {
              const stored = { ...userToSet };
              if (stored.avatarUrl && String(stored.avatarUrl).length > 2000) {
                delete (stored as { avatarUrl?: string }).avatarUrl;
              }
              const storedJson = JSON.stringify(stored);
              localStorage.setItem(USER_STORAGE_KEY, storedJson);
              persistUserToNativeStorage(storedJson);
            } catch {
              /* ignore */
            }
          }
          if (userToSet.handle) {
            setProfilePrivacy(userToSet.handle, !!userToSet.is_private);
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
          void getAuthTokenAsync().then((token) => {
            if (cancelled || refreshGen !== authRefreshGenRef.current || !token || !isLaravelApiEnabled())
              return;
            import('../api/client').then(({ getCurrentUser, mapLaravelUserToAppFields }) => {
              getCurrentUser()
                .then((apiUser: any) => {
                  if (cancelled || refreshGen !== authRefreshGenRef.current) return;
                  void getAuthTokenAsync().then((stillToken) => {
                    if (cancelled || refreshGen !== authRefreshGenRef.current || !stillToken) return;
                    const fromApi = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
                    const updated: User = { ...userToSet };
                    for (const [key, val] of Object.entries(fromApi)) {
                      if (val === undefined || val === null) continue;
                      if (key === 'placesTraveled' && Array.isArray(val)) {
                        updated.placesTraveled = val.length > 0 ? val : undefined;
                        continue;
                      }
                      (updated as Record<string, unknown>)[key] = val;
                    }
                    setUser(updated);
                    const updatedJson = JSON.stringify(updated);
                    localStorage.setItem(USER_STORAGE_KEY, updatedJson);
                    persistUserToNativeStorage(updatedJson);
                    if (updated.handle && typeof updated.is_private === 'boolean') {
                      setProfilePrivacy(updated.handle, updated.is_private);
                    }
                  });
                })
                .catch(() => {});
            });
          });
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
          // Initialize mock private user for testing (Sarah@Artane)
          initializePrivateMockUser();
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (userData: any) => {
    const resolvedAccountType =
      userData.accountType === 'business' ||
      userData.account_type === 'business' ||
      userData.isBusiness === true ||
      userData.is_business === true
        ? 'business'
        : userData.accountType === 'personal' || userData.account_type === 'personal'
          ? 'personal'
          : undefined;
    const u: User = {
      id:
        userData.id != null && String(userData.id).trim() !== ''
          ? String(userData.id)
          : (userData.name || '').trim().toLowerCase() || 'me',
      name: userData.name.trim() || 'Me',
      email: userData.email || '',
      password: userData.password || '',
      age: userData.age || 18,
      interests: userData.interests || [],
      local: userData.local || '',
      regional: userData.regional || '',
      national: userData.national || '',
      handle: userData.handle || `${(userData.name || '').trim().split(/\s+/)[0] || userData.name || 'User'}@Unknown`,
      countryFlag:
        normalizeCountryFlagInput(userData.countryFlag || '', userData.national || '') || undefined,
      avatarUrl: userData.avatarUrl || undefined,
      profileBackgroundUrl: userData.profileBackgroundUrl || undefined,
      bio: userData.bio || undefined,
      socialLinks: userData.socialLinks || undefined,
      placesTraveled: userData.placesTraveled || undefined,
      accountType: resolvedAccountType,
      is_private:
        typeof userData.is_private === 'boolean'
          ? userData.is_private
          : userData.handle
            ? isProfilePrivate(String(userData.handle))
            : false,
      termsAcceptedAt: userData.termsAcceptedAt,
      guidelinesAcceptedAt: userData.guidelinesAcceptedAt,
    };
    // Drop stale in-memory follows before AsyncStorage hydrate so getState() reloads cleanly.
    clearUserState(u.id);
    setUser(u);
    // Persist large base64 avatar in IndexedDB (survives refresh); strip from localStorage to avoid quota exceeded
    const toStore = { ...u };
    if (typeof toStore.avatarUrl === 'string' && toStore.avatarUrl.length > 2000) {
      db.set(AVATAR_KEY(u.id), toStore.avatarUrl).catch(() => {});
      toStore.avatarUrl = undefined;
    }
    localStorage.setItem('user', JSON.stringify(toStore));
    persistUserToNativeStorage(JSON.stringify(toStore));

    void (async () => {
      try {
        await Promise.all([hydrateFollowsStorage(u.id), hydratePrivacyStorage()]);
      } catch {
        // continue even if native storage hydrate fails
      }
      // Warm cache from hydrated storage (hydrateFollowsStorage also merges if cache already exists).
      getState(u.id);
      if (u.handle) {
        setProfilePrivacy(u.handle, !!u.is_private);
        try {
          connectSocket(u.handle);
        } catch (e) {
          console.warn('Socket connect skipped:', e);
        }
        import('../services/notifications').then(({ initializeNotifications }) => {
          initializeNotifications();
        });
      }
      setSentryUser({ id: u.id, username: u.name });
    })();
  };

  const logout = () => {
    authRefreshGenRef.current += 1;
    const prevId = user?.id;
    // Disconnect Socket.IO when user logs out
    disconnectSocket();
    import('../services/notifications')
      .then(({ clearNotificationSession }) => clearNotificationSession?.())
      .catch(() => {});
    setUser(null);
    if (prevId) clearUserState(prevId);
    localStorage.removeItem('user');
    persistUserToNativeStorage(null);
    void clearAuthToken();
    try {
      localStorage.removeItem('clips_app_stable_uid');
    } catch (_) {}
    setSentryUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Safe variant: returns null when outside AuthProvider instead of throwing */
export function useAuthOptional() {
  return React.useContext(Ctx);
}
