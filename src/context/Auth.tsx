import React from 'react';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { isMockMode } from '../api/apiMode';
import { User } from '../types';
import { setProfilePrivacy, initializePrivateMockUser, isProfilePrivate, hydratePrivacyStorage } from '../api/privacy';
import { hydrateFollowsStorage, clearUserState, getState, syncFollowsFromLaravel } from '../api/posts';
import { connectSocket, disconnectSocket } from '../services/socketio';
import { db } from '../utils/db';
import { normalizeCountryFlagInput } from '../utils/countryFlag';
import { setAvatarForHandle } from '../api/users';
import {
  clearAuthToken,
  getAuthTokenAsync,
  hydrateAuthTokenFromStorage,
} from '../utils/authTokenBridge';
import { logoutFromServer } from '../api/client';
import { isLocalDeviceUri } from '../utils/syncHostedAvatar';

const AVATAR_KEY = (id: string) => `clips_app_avatar_${id}`;
const AVATAR_HANDLE_KEY = (handle: string) =>
  `clips_app_avatar_handle_${String(handle || '').trim().toLowerCase()}`;
const USER_STORAGE_KEY = 'user';

function displayNameFromAuthPayload(userData: any): string {
  const raw = userData?.name ?? userData?.display_name ?? userData?.displayName ?? '';
  const fromName = String(raw).trim();
  if (fromName) return fromName;
  const handle = String(userData?.handle || '').trim();
  if (handle) {
    const at = handle.indexOf('@');
    const fromHandle = (at >= 0 ? handle.slice(0, at) : handle).trim();
    if (fromHandle) return fromHandle;
  }
  const email = String(userData?.email || '').trim();
  if (email.includes('@')) {
    const localPart = email.split('@')[0]?.trim();
    if (localPart) return localPart;
  }
  return 'Me';
}

function isPlaceholderTestUser(parsed: { id?: unknown; handle?: unknown } | null): boolean {
  const id = parsed?.id != null ? String(parsed.id) : '';
  const handle = parsed?.handle != null ? String(parsed.handle) : '';
  return id === 'test-user' || handle === 'TestUser@Dublin';
}

/** Overlay Laravel /auth/me onto the cached profile. Token identity always wins. */
function applyLaravelIdentity(local: User, fromApi: Record<string, unknown>): User {
  const next: User = { ...local };
  const localId = local.id != null ? String(local.id) : '';
  const apiId = fromApi.id != null ? String(fromApi.id) : '';
  if (apiId && localId && apiId !== localId) {
    next.avatarUrl = undefined;
    next.profileBackgroundUrl = undefined;
  }
  for (const [key, val] of Object.entries(fromApi)) {
    if (key === 'phone_number' || key === 'phone_verified_at') {
      (next as Record<string, unknown>)[key] = val ?? null;
      continue;
    }
    if (val === undefined || val === null) continue;
    if (key === 'placesTraveled' && Array.isArray(val)) {
      next.placesTraveled = val.length > 0 ? (val as string[]) : undefined;
      continue;
    }
    (next as Record<string, unknown>)[key] = val;
  }
  return next;
}

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

async function persistUserToNativeStorage(userJson: string | null): Promise<void> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    if (userJson == null) {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(USER_STORAGE_KEY, userJson);
  } catch {
    // web / unavailable
  }
}

async function readStoredAvatar(userId: string, handle?: string): Promise<string | undefined> {
  try {
    const byId = await db.get<string>(AVATAR_KEY(userId));
    const idRaw = typeof byId === 'string' ? byId.trim() : '';
    if (idRaw) return idRaw;
    const handleKey = handle ? AVATAR_HANDLE_KEY(handle) : '';
    if (!handleKey || handleKey.endsWith('_')) return undefined;
    const byHandle = await db.get<string>(handleKey);
    const handleRaw = typeof byHandle === 'string' ? byHandle.trim() : '';
    return handleRaw || undefined;
  } catch {
    return undefined;
  }
}

function persistAvatarBackup(userId: string, handle: string | undefined, url: string): void {
  const trimmed = String(url || '').trim();
  if (!trimmed || !userId) return;
  db.set(AVATAR_KEY(userId), trimmed).catch(() => {});
  if (handle) db.set(AVATAR_HANDLE_KEY(handle), trimmed).catch(() => {});
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
type AuthCtx = {
  user: User | null;
  login: (userData: any) => void;
  logout: () => Promise<void>;
  sessionReady: boolean;
};
const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [sessionReady, setSessionReady] = React.useState(false);
  const authRefreshGenRef = React.useRef(0);

  const hydrateAndSyncAvatar = React.useCallback(
    (userId: string, handle: string | undefined, currentAvatar: string | undefined) => {
      const gen = authRefreshGenRef.current;
      const apply = (url: string) => {
        if (authRefreshGenRef.current !== gen) return;
        if (handle) setAvatarForHandle(handle, url);
        setUser((prev) => (prev && prev.id === userId ? { ...prev, avatarUrl: url } : prev));
      };

      void (async () => {
        let avatar = String(currentAvatar || '').trim() || undefined;
        if (!avatar) {
          avatar = await readStoredAvatar(userId, handle);
        }
        if (!avatar) return;
        apply(avatar);
        persistAvatarBackup(userId, handle, avatar);
        if (!handle) return;
        try {
          const { persistLocalAvatarToLaravel } = await import('../utils/syncHostedAvatar');
          const hosted = await persistLocalAvatarToLaravel(handle, avatar);
          if (!hosted || hosted === avatar) return;
          apply(hosted);
          persistAvatarBackup(userId, handle, hosted);
        } catch {
          /* keep restored local avatar even if Laravel upload fails */
        }
      })();
    },
    [],
  );

  React.useEffect(() => {
    void hydrateAuthTokenFromStorage();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const refreshGen = authRefreshGenRef.current;

    void (async () => {
      try {
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
          // Live Laravel: stay signed out so Splash → Landing/Login. Mock mode keeps a local test user.
          if (isLaravelApiEnabled()) {
            if (cancelled) return;
            setUser(null);
            return;
          }
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

        let parsed = JSON.parse(s);
        if (isLaravelApiEnabled() && isPlaceholderTestUser(parsed)) {
          const token = await getAuthTokenAsync();
          if (!token) {
            localStorage.removeItem(USER_STORAGE_KEY);
            await persistUserToNativeStorage(null);
            if (cancelled) return;
            setUser(null);
            return;
          }
        }
        if (isLaravelApiEnabled() && !isMockMode()) {
          const token = await getAuthTokenAsync();
          if (!token) {
            localStorage.removeItem(USER_STORAGE_KEY);
            await persistUserToNativeStorage(null);
            if (cancelled) return;
            setUser(null);
            return;
          }
          try {
            const { getCurrentUser, mapLaravelUserToAppFields } = await import('../api/client');
            const apiUser = await Promise.race([
              getCurrentUser(),
              new Promise((_, reject) => {
                setTimeout(() => {
                  const err = new Error('auth/me timeout');
                  (err as { status?: number }).status = 0;
                  reject(err);
                }, 5000);
              }),
            ]);
            if (cancelled || refreshGen !== authRefreshGenRef.current) return;
            const fromApi = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
            if (fromApi.id && parsed?.id && String(fromApi.id) !== String(parsed.id)) {
              console.warn('[auth] saved profile did not match Laravel token', {
                savedHandle: parsed.handle,
                laravelHandle: fromApi.handle,
              });
            }
            parsed = applyLaravelIdentity(parsed, fromApi);
            const syncedJson = JSON.stringify(parsed);
            localStorage.setItem(USER_STORAGE_KEY, syncedJson);
            await persistUserToNativeStorage(syncedJson);
          } catch (err: any) {
            if (err?.status === 401) {
              localStorage.removeItem(USER_STORAGE_KEY);
              await persistUserToNativeStorage(null);
              await clearAuthToken();
              if (cancelled) return;
              setUser(null);
              return;
            }
          }
        }
        const previewId =
          parsed?.id != null && String(parsed.id).trim() !== ''
            ? String(parsed.id)
            : null;
        if (previewId) {
          await hydrateFollowsStorage(previewId);
          if (cancelled) return;
          const previewHandle = typeof parsed?.handle === 'string' ? parsed.handle.trim() : '';
          if (previewHandle && !isMockMode()) {
            try {
              await syncFollowsFromLaravel(previewId, previewHandle);
            } catch {
              // Following feed still loads from Laravel even if this cache warm fails.
            }
            if (cancelled) return;
          }
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
            import('../services/notifications').then((mod) => {
              const init = mod.initializeNotifications;
              const register =
                'registerFcmTokenForCurrentUser' in mod
                  ? (mod as { registerFcmTokenForCurrentUser?: () => Promise<string | null> })
                      .registerFcmTokenForCurrentUser
                  : undefined;
              void init?.();
              void register?.();
            });
          }
          // Restore a device-only avatar, then host it on Laravel so logout/login keeps it.
          hydrateAndSyncAvatar(userToSet.id, userToSet.handle, userToSet.avatarUrl);
          // Initialize mock private user for testing (Sarah@Artane)
          initializePrivateMockUser();
          return;
        }
        hydrateAndSyncAvatar(userToSet.id, userToSet.handle, userToSet.avatarUrl);
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
      }

      // Initialize mock private user for testing (Sarah@Artane)
      initializePrivateMockUser();
      } finally {
        if (!cancelled) setSessionReady(true);
      }
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
    const name = displayNameFromAuthPayload(userData);
    const nextId =
      userData.id != null && String(userData.id).trim() !== ''
        ? String(userData.id)
        : name.toLowerCase() || 'me';
    const sameUser = user != null && String(user.id) === nextId;
    const u: User = {
      id: nextId,
      name,
      email: userData.email || '',
      password: userData.password || '',
      age: userData.age || 18,
      interests: userData.interests || [],
      local: userData.local || '',
      regional: userData.regional || '',
      national: userData.national || '',
      handle: userData.handle || `${name.split(/\s+/)[0] || name || 'User'}@Unknown`,
      countryFlag:
        normalizeCountryFlagInput(userData.countryFlag || '', userData.national || '') || undefined,
      avatarUrl: userData.avatarUrl || (sameUser ? user?.avatarUrl : undefined) || undefined,
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
    authRefreshGenRef.current += 1;
    const loginGen = authRefreshGenRef.current;
    clearUserState(u.id);
    setUser(u);
    hydrateAndSyncAvatar(u.id, u.handle, u.avatarUrl);
    const toStore = { ...u };
    if (typeof toStore.avatarUrl === 'string' && toStore.avatarUrl.length > 0) {
      persistAvatarBackup(u.id, u.handle, toStore.avatarUrl);
      if (toStore.avatarUrl.length > 2000 || isLocalDeviceUri(toStore.avatarUrl)) {
        toStore.avatarUrl = undefined;
      }
    }
    localStorage.setItem('user', JSON.stringify(toStore));

    void (async () => {
      let sessionUser = u;
      try {
        await persistUserToNativeStorage(JSON.stringify(toStore));
      } catch {
        // continue even if native storage persist fails
      }
      if (loginGen !== authRefreshGenRef.current) return;
      try {
        await Promise.all([hydrateFollowsStorage(sessionUser.id), hydratePrivacyStorage()]);
        if (sessionUser.handle && !isMockMode()) {
          try {
            await syncFollowsFromLaravel(sessionUser.id, sessionUser.handle);
          } catch {
            // Following feed still loads from Laravel even if this cache warm fails.
          }
        }
      } catch {
        // continue even if native storage hydrate fails
      }
      // Warm cache from hydrated storage (hydrateFollowsStorage also merges if cache already exists).
      getState(sessionUser.id);
      if (sessionUser.handle) {
        setProfilePrivacy(sessionUser.handle, !!sessionUser.is_private);
        try {
          connectSocket(sessionUser.handle);
        } catch (e) {
          console.warn('Socket connect skipped:', e);
        }
        import('../services/notifications').then((mod) => {
          const init = mod.initializeNotifications;
          const register =
            'registerFcmTokenForCurrentUser' in mod
              ? (mod as { registerFcmTokenForCurrentUser?: () => Promise<string | null> })
                  .registerFcmTokenForCurrentUser
              : undefined;
          void init?.();
          void register?.();
        });
      }
      setSentryUser({ id: sessionUser.id, username: sessionUser.name });
    })();
  };

  const logout = async () => {
    authRefreshGenRef.current += 1;
    const prevId = user?.id;
    try {
      const { clearNotificationSession } = await import('../services/notifications');
      await clearNotificationSession?.();
    } catch {
      // FCM cleanup is best-effort and must run while the token still exists.
    }
    await logoutFromServer();
    disconnectSocket();
    setUser(null);
    if (prevId) clearUserState(prevId);
    localStorage.removeItem('user');
    try {
      localStorage.removeItem('clips_app_stable_uid');
    } catch (_) {}
    setSentryUser(null);
    void persistUserToNativeStorage(null);
    void clearAuthToken();
  };

  return <Ctx.Provider value={{ user, login, logout, sessionReady }}>{children}</Ctx.Provider>;
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
