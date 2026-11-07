import type { User } from '../types';

/** Last successful profile, including avatar_url and name, for cold start. */
export const USER_PROFILE_CACHE_KEY = '@gazetteer_user_profile';

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function avatarFromProfileRecord(row: Record<string, unknown> | null | undefined): string | undefined {
    const avatar = text(row?.avatarUrl) || text(row?.avatar_url);
    return avatar || undefined;
}

export function nameFromProfileRecord(row: Record<string, unknown> | null | undefined): string | undefined {
    const name = text(row?.name) || text(row?.display_name);
    return name || undefined;
}

/** App user from either the stored app shape or a raw `/auth/me` payload. */
export function userFromProfileCache(raw: Record<string, unknown> | null | undefined): User | null {
    if (!raw) return null;
    const id = text(raw.id);
    if (!id || id === 'test-user') return null;
    const handle = text(raw.handle);
    const email = text(raw.email);
    if (handle === 'TestUser@Dublin' || email === 'test@example.com') return null;
    const name = nameFromProfileRecord(raw) || 'Me';
    return {
        id,
        name,
        email,
        password: '',
        age: typeof raw.age === 'number' ? raw.age : 18,
        interests: Array.isArray(raw.interests) ? (raw.interests as string[]) : [],
        local: text(raw.local) || text(raw.location_local),
        regional: text(raw.regional) || text(raw.location_regional),
        national: text(raw.national) || text(raw.location_national),
        handle: handle || `${name.split(/\s+/)[0] || 'User'}@Unknown`,
        avatarUrl: avatarFromProfileRecord(raw),
        profileBackgroundUrl: text(raw.profileBackgroundUrl) || text(raw.profile_background_url) || undefined,
        bio: text(raw.bio) || undefined,
        is_private: typeof raw.is_private === 'boolean' ? raw.is_private : undefined,
        accountType:
            raw.accountType === 'business' || raw.account_type === 'business'
                ? 'business'
                : raw.accountType === 'personal' || raw.account_type === 'personal'
                  ? 'personal'
                  : undefined,
    };
}

export async function readCachedUserProfile(): Promise<Record<string, unknown> | null> {
    try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        const raw = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/** Persist the profile that should paint the passport before `/auth/me` returns. */
export async function writeCachedUserProfile(user: User | Record<string, unknown> | null): Promise<void> {
    try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        if (!user) {
            await AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY);
            return;
        }
        const row = user as Record<string, unknown>;
        const avatar = avatarFromProfileRecord(row) || '';
        const name = nameFromProfileRecord(row) || '';
        const { password: _password, ...rest } = row;
        await AsyncStorage.setItem(
            USER_PROFILE_CACHE_KEY,
            JSON.stringify({
                ...rest,
                name: name || undefined,
                avatarUrl: avatar || undefined,
                avatar_url: avatar || undefined,
            }),
        );
    } catch {
        /* Storage can be unavailable during a reload. Keep the in-memory user. */
    }
}
