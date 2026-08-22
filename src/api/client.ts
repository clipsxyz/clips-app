/// <reference types="vite/client" />
import { clearLaravelUnreachable, isLaravelApiEnabled, markLaravelUnreachable } from '../config/runtimeEnv';
import { getAuthorizationHeader, persistAuthToken } from '../utils/authTokenBridge';
import { getApiBaseUrl, resolvePublicMediaUrl } from './apiBaseUrl';
import { isMockMode } from './apiMode';

function throwMockConnectionRefused(): never {
    // Mock mode / allowlist miss is not a downed server. Never poison the session
    // (that made likes/views/comments save only in memory while the feed still loaded from Laravel).
    const connectionError = new Error('CONNECTION_REFUSED');
    connectionError.name = 'ConnectionRefused';
    throw connectionError;
}

/**
 * `apiRequest` allowlist. Login / feed / createPost / profile GET use dedicated fetch helpers
 * that skip this. Anything else must match here or it throws CONNECTION_REFUSED and the caller
 * falls back to in-memory mock (likes/views/comments looking saved, then resetting on refresh).
 */
const LIVE_API_REQUEST_PATHS = new Set<string>([
    '/posts',
    '/upload/single',
    '/locations/search',
    '/locations/geocode',
    '/locations/details',
    '/search',
    '/search/places',
    '/search/places/details',
    '/search/places/summary',
    '/notifications/fcm-token',
    '/collections',
    '/chat-groups',
    '/messages/send',
    '/messages/conversations',
    '/notifications/unread-count',
    '/notifications/mark-all-read',
    '/users/privacy/toggle',
    '/users/check-follows-me',
    '/stories',
]);

/** Prefixes for `/resource/{id}/…` routes that already exist in Laravel. */
const LIVE_API_PATH_PREFIXES = [
    '/posts/',
    '/users/',
    '/comments/',
    '/auth/',
    '/messages/',
    '/notifications/',
    '/chat-groups/',
    '/stories/',
    '/collections/',
    '/boost/',
    '/render-jobs/',
    '/public/posts/',
] as const;

function isMigratedApiRequestPath(endpoint: string): boolean {
    const path = (endpoint.split('?')[0] || '').replace(/\/$/, '') || '/';
    if (LIVE_API_REQUEST_PATHS.has(path)) return true;
    return LIVE_API_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Helper function to make API requests (with configurable timeout to avoid long hangs when backend is slow)
export async function apiRequest(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}) {
    // Mock mode, or unmigrated endpoint: keep local mock data; do not hit Laravel.
    if (isMockMode() || !isMigratedApiRequestPath(endpoint)) {
        throwMockConnectionRefused();
    }

    const authHeader = await getAuthorizationHeader();
    const { timeoutMs = 8000, ...fetchOptions } = options;
    const API_BASE_URL = getApiBaseUrl();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config: RequestInit = {
        ...fetchOptions,
        headers: {
            'Content-Type': 'application/json',
            ...authHeader,
            ...fetchOptions.headers,
        },
        signal: controller.signal,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Network error' }));
            const errorMessage = errorData.error || errorData.message || (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = errorData;
            throw error;
        }

        const text = await response.text();
        clearLaravelUnreachable();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            const preview = text.slice(0, 80).replace(/\s+/g, ' ');
            throw new Error(`API returned non-JSON (${response.status}): ${preview}`);
        }
    } catch (error: any) {
        clearTimeout(timeoutId);
        // Suppress connection refused errors when backend isn't running
        // Check for various connection error patterns
        const isAbort = error?.name === 'AbortError';
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));

        if (isAbort) {
            throw error;
        }
        if (isConnectionError) {
            // Re-throw with a specific error type that can be caught and handled gracefully
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

// Auth API
export async function registerUser(userData: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    handle: string;
    locationLocal?: string;
    locationRegional?: string;
    locationNational?: string;
    accountType?: 'personal' | 'business';
    isBusiness?: boolean;
}): Promise<{ user: Record<string, unknown>; token: string }> {
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/auth/register`;

    // Laravel username must be [a-zA-Z0-9_]; never send a raw email.
    const emailLocal = String(userData.email || '')
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 40);
    const username =
        String(userData.username || '')
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .slice(0, 50) ||
        emailLocal ||
        `user_${Date.now()}`;

    const payload = {
        username,
        email: userData.email,
        password: userData.password,
        // `confirmed` rule on AuthController::register
        password_confirmation: userData.password,
        displayName: userData.displayName,
        handle: userData.handle,
        locationLocal: String(userData.locationLocal || '').trim() || undefined,
        locationRegional: String(userData.locationRegional || '').trim() || undefined,
        locationNational: String(userData.locationNational || '').trim() || undefined,
        accountType: userData.accountType,
        isBusiness: userData.isBusiness,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        console.log('[registerUser/client] POST', url, {
            username,
            email: userData.email,
            handle: userData.handle,
            locationLocal: payload.locationLocal,
            locationRegional: payload.locationRegional,
            locationNational: payload.locationNational,
        });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        if (!response.ok) {
            const errorMessage =
                (errorData as any).error ||
                (errorData as any).message ||
                ((errorData as any).errors ? JSON.stringify((errorData as any).errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = errorData;
            console.log('[registerUser/client] failed', { status: response.status, errorMessage });
            throw error;
        }

        const data = errorData as { user?: Record<string, unknown>; token?: string };
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        if (!token) {
            throw new Error('Registration succeeded but no API token was returned');
        }
        await persistAuthToken(token);
        console.log('[registerUser/client] ok', {
            hasToken: true,
            userId: (data.user as any)?.id,
            location_local: (data.user as any)?.location_local,
            location_regional: (data.user as any)?.location_regional,
            location_national: (data.user as any)?.location_national,
        });
        return {
            user: data.user && typeof data.user === 'object' ? data.user : {},
            token,
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error(`CONNECTION_REFUSED registering at ${url}`);
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function loginUser(email: string, password: string): Promise<{
    user: Record<string, unknown>;
    token: string;
}> {
    // Keep existing mock login path (UI falls back to local registrations).
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    // Laravel mounts auth under `/api/auth/*`. `getApiBaseUrl()` already includes `/api`.
    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/auth/login`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ email, password }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
            const errorMessage =
                errorData.error ||
                errorData.message ||
                (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = errorData;
            throw error;
        }

        const data = (await response.json()) as { user?: Record<string, unknown>; token?: string };
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        if (!token) {
            throw new Error('Login succeeded but no API token was returned');
        }

        await persistAuthToken(token);

        return {
            user: data.user && typeof data.user === 'object' ? data.user : {},
            token,
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function resetLocalPassword(email: string, password: string): Promise<{
    user: Record<string, unknown>;
    token: string;
}> {
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/auth/password/reset-local`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                password_confirmation: password,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Reset failed' }));
            const errorMessage =
                errorData.error ||
                errorData.message ||
                (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            throw error;
        }

        const data = (await response.json()) as { user?: Record<string, unknown>; token?: string };
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        if (!token) {
            throw new Error('Password was reset but no API token was returned');
        }
        await persistAuthToken(token);
        return {
            user: data.user && typeof data.user === 'object' ? data.user : {},
            token,
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function requestPasswordResetCode(email: string): Promise<{
    ok: boolean;
    delivery: 'mock' | 'email';
    expires_in_seconds: number;
    debug_code?: string;
}> {
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/auth/password/forgot`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ email }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Could not send code' }));
            const errorMessage =
                errorData.error ||
                errorData.message ||
                (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            throw error;
        }

        return (await response.json()) as {
            ok: boolean;
            delivery: 'mock' | 'email';
            expires_in_seconds: number;
            debug_code?: string;
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function resetPasswordWithCode(
    email: string,
    code: string,
    password: string,
): Promise<{
    user: Record<string, unknown>;
    token: string;
}> {
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/auth/password/reset`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                email,
                code,
                password,
                password_confirmation: password,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Reset failed' }));
            const errorMessage =
                errorData.error ||
                errorData.message ||
                (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            throw error;
        }

        const data = (await response.json()) as { user?: Record<string, unknown>; token?: string };
        const token = typeof data?.token === 'string' ? data.token.trim() : '';
        if (!token) {
            throw new Error('Password was reset but no API token was returned');
        }
        await persistAuthToken(token);
        return {
            user: data.user && typeof data.user === 'object' ? data.user : {},
            token,
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function getCurrentUser() {
    return apiRequest('/auth/me');
}

export type FacebookMatchedFriend = {
    id: string;
    handle: string;
    display_name?: string | null;
    avatar_url?: string | null;
    facebook_id?: string | null;
    facebook_name?: string | null;
    facebook_picture?: string | null;
};

export async function linkFacebookAccount(accessToken: string): Promise<{ ok: boolean; facebook_id?: string; facebook_name?: string | null }> {
    return apiRequest('/auth/facebook/link', {
        method: 'POST',
        body: JSON.stringify({ access_token: accessToken }),
    });
}

export async function fetchFacebookFriendsMatches(accessToken: string): Promise<{
    ok: boolean;
    matched: FacebookMatchedFriend[];
    facebook_friend_count: number;
    matched_count: number;
    message?: string;
}> {
    return apiRequest('/auth/facebook/friends', {
        method: 'POST',
        body: JSON.stringify({ access_token: accessToken }),
    });
}

export async function matchContactPhones(phones: string[]): Promise<{
    ok: boolean;
    matched: Array<{ id: string; handle: string; display_name?: string | null; avatar_url?: string | null; phone_number?: string | null }>;
    submitted_count: number;
    matched_count: number;
}> {
    return apiRequest('/auth/contacts/match', {
        method: 'POST',
        body: JSON.stringify({ phones }),
    });
}

type PhoneSendCodeResponse = {
    ok: boolean;
    delivery: 'sms' | 'mock';
    expires_in_seconds: number;
    debug_code?: string;
};

export async function sendPhoneVerificationCode(phone: string): Promise<PhoneSendCodeResponse> {
    if (!isLaravelApiEnabled()) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        sessionStorage.setItem('clips:mockPhoneOtp', otp);
        sessionStorage.setItem('clips:mockPhoneOtpPhone', phone);
        return { ok: true, delivery: 'mock', expires_in_seconds: 600, debug_code: otp };
    }
    try {
        return await apiRequest('/auth/phone/send-code', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    } catch (err: any) {
        if (err?.name === 'ConnectionRefused') {
            const otp = String(Math.floor(100000 + Math.random() * 900000));
            sessionStorage.setItem('clips:mockPhoneOtp', otp);
            sessionStorage.setItem('clips:mockPhoneOtpPhone', phone);
            return { ok: true, delivery: 'mock', expires_in_seconds: 600, debug_code: otp };
        }
        throw err;
    }
}

export async function verifyPhoneVerificationCode(phone: string, code: string): Promise<{ ok: boolean; phone_number?: string; phone_verified_at?: string }> {
    if (!isLaravelApiEnabled()) {
        const expected = sessionStorage.getItem('clips:mockPhoneOtp');
        const expectedPhone = sessionStorage.getItem('clips:mockPhoneOtpPhone');
        if (!expected || expected !== code || expectedPhone !== phone) {
            throw new Error('Incorrect code. Try again.');
        }
        return { ok: true, phone_number: phone, phone_verified_at: new Date().toISOString() };
    }
    return apiRequest('/auth/phone/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
    });
}

/** Map Laravel `/auth/me` or `/auth/profile` JSON into partial app `User` fields. */
export function mapLaravelUserToAppFields(apiUser: Record<string, unknown>): Record<string, unknown> {
    const pt = apiUser.places_traveled ?? apiUser.placesTraveled;
    const rawAccountType = (apiUser.account_type ?? apiUser.accountType) as string | undefined;
    const accountType =
        rawAccountType === 'business' || rawAccountType === 'personal'
            ? rawAccountType
            : (apiUser.is_business === true ? 'business' : undefined);
    return {
        id: apiUser.id != null ? String(apiUser.id) : undefined,
        name: (apiUser.display_name ?? apiUser.name) as string | undefined,
        email: apiUser.email as string | undefined,
        local: (apiUser.location_local ?? apiUser.local) as string | undefined,
        regional: (apiUser.location_regional ?? apiUser.regional) as string | undefined,
        national: (apiUser.location_national ?? apiUser.national) as string | undefined,
        handle: apiUser.handle as string | undefined,
        bio: apiUser.bio as string | undefined,
        placesTraveled: Array.isArray(pt) ? (pt as string[]).filter((s) => typeof s === 'string') : undefined,
        avatarUrl: (() => {
            const raw = (apiUser.avatar_url ?? apiUser.avatarUrl) as string | undefined;
            return raw ? resolvePublicMediaUrl(raw) || raw : undefined;
        })(),
        profileBackgroundUrl: (apiUser.profile_background_url ?? apiUser.profileBackgroundUrl) as string | undefined,
        socialLinks: (apiUser.social_links ?? apiUser.socialLinks) as Record<string, string> | undefined,
        is_private: apiUser.is_private as boolean | undefined,
        emailDigestEnabled: (apiUser.email_digest_enabled ?? apiUser.emailDigestEnabled) as boolean | undefined,
        is_verified: apiUser.is_verified as boolean | undefined,
        facebook_id: apiUser.facebook_id as string | undefined,
        accountType,
    };
}

export async function updateAuthProfile(data: {
    display_name?: string;
    handle?: string;
    bio?: string | null;
    places_traveled?: string[];
    location_local?: string | null;
    location_regional?: string | null;
    location_national?: string | null;
    social_links?: Record<string, string | undefined>;
    profile_background_url?: string | null;
    avatar_url?: string | null;
    account_type?: 'personal' | 'business';
    is_business?: boolean;
    is_private?: boolean;
    email_digest_enabled?: boolean;
}) {
    return apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// Posts API (6s timeout for faster fallback on slow mobile networks)
export async function fetchPostsPage(
    cursor: number | string | null = 0,
    limit: number = 10,
    filter: string = 'Dublin',
    userId?: string,
) {
    console.log('[fetchPostsPage/client] IS_MOCK=', isMockMode(), {
        EXPO_PUBLIC_USE_MOCK: process.env.EXPO_PUBLIC_USE_MOCK,
        cursor,
        limit,
        filter,
        userId,
    });

    // Keep existing mock feed path (posts.ts falls through to local seed data).
    if (isMockMode()) {
        console.log('[fetchPostsPage/client] short-circuit: IS_MOCK=true → CONNECTION_REFUSED');
        throwMockConnectionRefused();
    }

    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
        filter,
        ...(userId && { userId }),
    });

    // Laravel: GET /api/posts (API_BASE_URL already includes `/api`)
    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/posts?${params}`;
    console.log('[fetchPostsPage/client] request URL=', url);
    const authHeader = await getAuthorizationHeader();
    console.log('[fetchPostsPage/client] Authorization header present=', Boolean(authHeader.Authorization));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...authHeader,
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        let payload: unknown = text;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }
        console.log('[fetchPostsPage/client] response status=', response.status, 'payload=', payload);

        if (!response.ok) {
            const errorData =
                payload && typeof payload === 'object'
                    ? (payload as Record<string, any>)
                    : { error: 'Network error' };
            const errorMessage =
                errorData.error ||
                errorData.message ||
                (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = errorData;
            throw error;
        }

        if (!text) {
            clearLaravelUnreachable();
            return { items: [], nextCursor: null };
        }
        if (payload && typeof payload === 'object') {
            clearLaravelUnreachable();
            return payload;
        }
        const preview = text.slice(0, 80).replace(/\s+/g, ' ');
        throw new Error(`API returned non-JSON (${response.status}): ${preview}`);
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.log('[fetchPostsPage/client] fetch error=', {
            name: error?.name,
            message: error?.message,
            status: error?.status,
        });
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        if (error?.name === 'AbortError') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function fetchPost(postId: string, userId?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);

    return apiRequest(`/posts/${postId}?${params}`);
}

export async function fetchPublicPostByToken(token: string) {
    return apiRequest(`/public/posts/${encodeURIComponent(token)}`);
}

export async function fetchStoriesPage(cursor: string | null = null, limit: number = 20, userId?: string) {
    const params = new URLSearchParams({
        limit: limit.toString(),
        ...(cursor ? { cursor } : {}),
        ...(userId ? { userId } : {}),
    });
    return apiRequest(`/stories/paged?${params}`);
}

/** Check if the user with the given handle follows the current viewer (for mutual-follow DM icon). Requires auth. */
export async function checkFollowsMe(handle: string): Promise<{ follows_me: boolean }> {
    if (!isLaravelApiEnabled()) {
        let viewerHandle = '';
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
            if (raw) viewerHandle = String(JSON.parse(raw)?.handle || '');
        } catch (_) {}
        const { mockAuthorFollowsViewer } = await import('./mockFollowGraph');
        return Promise.resolve({ follows_me: mockAuthorFollowsViewer(handle, viewerHandle) });
    }
    const params = new URLSearchParams({ handle });
    return apiRequest(`/users/check-follows-me?${params}`);
}

export async function createPost(postData: {
    text?: string;
    location?: string;
    placeId?: string;
    place_id?: string;
    latitude?: number;
    longitude?: number;
    venue?: string;
    landmark?: string;
    socialFormat?: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    videoFrameMode?: 'crop' | 'fit' | 'original';
    videoPosterUrl?: string;
    caption?: string;
    imageText?: string;
    bannerText?: string;
    stickers?: any[];
    templateId?: string;
    mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; text?: string; textStyle?: any }>;
    textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string; fontFamily?: string };
    taggedUsers?: string[];
    videoCaptionsEnabled?: boolean;
    videoCaptionText?: string;
    subtitlesEnabled?: boolean;
    subtitleText?: string;
    editTimeline?: any;
    musicTrackId?: number;
    templateStyle?: 'default' | 'polaroid' | 'neon' | 'glass' | 'magazine';
}) {
    if (isMockMode()) {
        console.log('[createPost/client] IS_MOCK=true → skip Laravel');
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/posts`;
    const authHeader = await getAuthorizationHeader();
    if (!authHeader.Authorization) {
        console.log('[createPost/client] missing Sanctum token → 401');
        const error = new Error(
            'Not signed in to the server. Log out and register/log in again so posts can sync.',
        );
        (error as any).status = 401;
        throw error;
    }
    console.log('[createPost/client] POST', url, {
        hasAuth: Boolean(authHeader.Authorization),
        mediaType: postData.mediaType,
        hasMediaUrl: Boolean(postData.mediaUrl),
        mediaUrlPreview:
            typeof postData.mediaUrl === 'string' ? postData.mediaUrl.slice(0, 80) : undefined,
        mediaItems: postData.mediaItems?.length ?? 0,
        location: postData.location,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify(postData),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        let payload: any = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }
        console.log('[createPost/client] response status=', response.status, {
            id: payload?.id,
            user_id: payload?.user_id,
            user_handle: payload?.user_handle || payload?.userHandle,
            errors: payload?.errors,
            error: payload?.error,
        });

        if (!response.ok) {
            const errorMessage =
                payload?.error ||
                payload?.message ||
                (payload?.errors ? JSON.stringify(payload.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = payload;
            throw error;
        }

        return payload;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.log('[createPost/client] fetch error=', {
            url,
            name: error?.name,
            message: error?.message,
            status: error?.status,
            cause: error?.cause,
        });
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error(
                `CONNECTION_REFUSED creating post at ${url}: ${error?.message || 'network error'}`,
            );
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function createStory(storyData: Record<string, unknown>) {
    if (isMockMode()) {
        console.log('[createStory/client] IS_MOCK=true → skip Laravel');
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}/stories`;
    const authHeader = await getAuthorizationHeader();
    if (!authHeader.Authorization) {
        console.log('[createStory/client] missing Sanctum token → 401');
        const error = new Error(
            'Not signed in to the server. Log out and register/log in again so stories can sync.',
        );
        (error as any).status = 401;
        throw error;
    }

    console.log('[createStory/client] POST', url, {
        hasAuth: Boolean(authHeader.Authorization),
        mediaType: storyData.media_type,
        hasMediaUrl: Boolean(storyData.media_url),
        hasText: Boolean(storyData.text),
        stickerCount: Array.isArray(storyData.stickers) ? storyData.stickers.length : 0,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify(storyData),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        let payload: any = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }
        console.log('[createStory/client] response status=', response.status, {
            id: payload?.id,
            user_id: payload?.user_id,
            user_handle: payload?.user_handle,
            errors: payload?.errors,
            error: payload?.error,
        });

        if (!response.ok) {
            const errorMessage =
                payload?.error ||
                payload?.message ||
                (payload?.errors ? JSON.stringify(payload.errors) : `HTTP ${response.status}`);
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = payload;
            throw error;
        }

        return payload;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.log('[createStory/client] fetch error=', {
            url,
            name: error?.name,
            message: error?.message,
            status: error?.status,
        });
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error(
                `CONNECTION_REFUSED creating story at ${url}: ${error?.message || 'network error'}`,
            );
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

export async function toggleLike(postId: string) {
    return apiRequest(`/posts/${postId}/like`, {
        method: 'POST',
    });
}

export type PostLikesApiResponse = {
    items: Array<{
        handle: string;
        display_name?: string;
        avatar_url?: string;
        is_following?: boolean;
    }>;
    total?: number;
    likes_count: number;
    views_count: number;
};

export async function fetchPostLikes(
    postId: string,
    params?: { userId?: string; limit?: number },
): Promise<PostLikesApiResponse> {
    const search = new URLSearchParams();
    if (params?.userId) search.set('userId', params.userId);
    if (params?.limit != null) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest(`/posts/${postId}/likes${qs ? `?${qs}` : ''}`);
}

export async function updatePost(postId: string, postData: {
    text?: string;
    location?: string;
    venue?: string;
    landmark?: string;
}) {
    return apiRequest(`/posts/${postId}`, {
        method: 'PUT',
        body: JSON.stringify(postData),
    });
}

export async function deletePost(postId: string) {
    return apiRequest(`/posts/${postId}`, {
        method: 'DELETE',
    });
}

export async function incrementView(postId: string) {
    return apiRequest(`/posts/${postId}/view`, {
        method: 'POST',
    });
}

export async function sharePost(postId: string) {
    return apiRequest(`/posts/${postId}/share`, {
        method: 'POST',
    });
}

export async function regeneratePostShareToken(postId: string) {
    return apiRequest(`/posts/${postId}/share-token/regenerate`, {
        method: 'POST',
    });
}

export async function reclipPost(postId: string) {
    return apiRequest(`/posts/${postId}/reclip`, {
        method: 'POST',
    });
}

// Render jobs API
export async function getRenderJobStatus(jobId: string) {
    return apiRequest(`/render-jobs/${jobId}`);
}

// Comments API
export async function fetchComments(postId: string, userId?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);

    return apiRequest(`/comments/post/${postId}?${params}`);
}

export async function fetchCommentsPage(
    postId: string,
    cursor: string | null = null,
    limit: number = 30,
    userId?: string,
    repliesLimit: number = 5,
) {
    const params = new URLSearchParams({
        paged: '1',
        limit: String(limit),
        repliesLimit: String(repliesLimit),
    });
    if (cursor) params.append('cursor', cursor);
    if (userId) params.append('userId', userId);
    return apiRequest(`/comments/post/${postId}?${params}`);
}

export async function addComment(postId: string, text: string) {
    return apiRequest(`/comments/post/${postId}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export async function addReply(parentId: string, text: string) {
    return apiRequest(`/comments/reply/${parentId}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export async function toggleCommentLike(commentId: string) {
    return apiRequest(`/comments/${commentId}/like`, {
        method: 'POST',
    });
}

function encodeUserIdentifier(raw: string): string {
    let value = String(raw || '').trim();
    try {
        value = decodeURIComponent(value).trim();
    } catch {
        /* already decoded */
    }
    return encodeURIComponent(value);
}

function isProfileUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.trim(),
    );
}

async function laravelUsersGet(pathAndQuery: string): Promise<any> {
    if (isMockMode()) {
        console.log('[laravelUsersGet] IS_MOCK=true → skip Laravel', pathAndQuery);
        throwMockConnectionRefused();
    }

    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const url = `${API_BASE_URL}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
    const authHeader = await getAuthorizationHeader();
    console.log('[laravelUsersGet] GET', url, { hasAuth: Boolean(authHeader.Authorization) });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...authHeader,
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const text = await response.text();
        let payload: any = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }
        if (!response.ok) {
            const errorMessage =
                payload?.error ||
                payload?.message ||
                (payload?.errors ? JSON.stringify(payload.errors) : `HTTP ${response.status}`);
            console.error('[laravelUsersGet] API error', {
                url,
                status: response.status,
                error: errorMessage,
                payload,
            });
            const error = new Error(errorMessage);
            (error as any).status = response.status;
            (error as any).response = payload;
            throw error;
        }
        return payload;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[laravelUsersGet] fetch error', {
            url,
            name: error?.name,
            message: error?.message,
            status: error?.status,
        });
        if (error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED') {
            throw error;
        }
        if (error?.name === 'AbortError') {
            throw error;
        }
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));
        if (isConnectionError) {
            markLaravelUnreachable();
            const connectionError = new Error('CONNECTION_REFUSED');
            connectionError.name = 'ConnectionRefused';
            throw connectionError;
        }
        throw error;
    }
}

// Users API
export async function fetchUserProfile(
    handle: string,
    userId?: string,
    postsCursor?: string | number | null,
    postsLimit?: number,
    sourcePostId?: string,
    tab: string = 'all',
) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (postsCursor != null && String(postsCursor) !== '') {
        params.append('postsCursor', String(postsCursor));
    }
    if (postsLimit != null) params.append('postsLimit', String(postsLimit));
    params.append('tab', tab || 'all');
    if (sourcePostId && isProfileUuid(sourcePostId)) {
        params.append('sourcePostId', sourcePostId);
    }
    const encoded = encodeUserIdentifier(handle);
    const qs = params.toString();
    const payload = await laravelUsersGet(`/users/${encoded}${qs ? `?${qs}` : ''}`);
    console.log('[fetchUserProfile/client] ok', {
        handle: payload?.handle,
        posts_count: payload?.posts_count ?? payload?.postsCount,
        postsLen: Array.isArray(payload?.posts) ? payload.posts.length : 0,
    });
    return payload;
}

export async function fetchUserPosts(
    identifier: string,
    options: {
        viewerId?: string;
        postsCursor?: string | number | null;
        postsLimit?: number;
        tab?: string;
    } = {},
) {
    const params = new URLSearchParams();
    if (options.viewerId) params.append('userId', options.viewerId);
    if (options.postsCursor != null && String(options.postsCursor) !== '') {
        params.append('postsCursor', String(options.postsCursor));
    }
    if (options.postsLimit != null) params.append('postsLimit', String(options.postsLimit));
    params.append('tab', options.tab || 'all');
    const encoded = encodeUserIdentifier(identifier);
    const qs = params.toString();
    const payload = await laravelUsersGet(`/users/${encoded}/posts${qs ? `?${qs}` : ''}`);
    console.log('[fetchUserPosts/client] ok', {
        identifier,
        posts_count: payload?.posts_count ?? payload?.postsCount,
        postsLen: Array.isArray(payload?.posts) ? payload.posts.length : 0,
        tab: options.tab || 'all',
    });
    return payload;
}

export async function toggleFollow(handle: string, following?: boolean) {
    const encodedHandle = encodeUserIdentifier(handle);
    return apiRequest(`/users/${encodedHandle}/follow`, {
        method: 'POST',
        ...(typeof following === 'boolean' ? { body: JSON.stringify({ following }) } : {}),
    });
}

export async function fetchFollowers(handle: string, cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    const encoded = encodeUserIdentifier(handle);
    return apiRequest(`/users/${encoded}/followers?${params}`);
}

export async function fetchFollowing(handle: string, cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    const encoded = encodeUserIdentifier(handle);
    return apiRequest(`/users/${encoded}/following?${params}`);
}

export async function togglePrivacy() {
    return apiRequest('/users/privacy/toggle', {
        method: 'POST',
    });
}

export async function acceptFollowRequest(handle: string) {
    const encoded = encodeURIComponent(handle);
    return apiRequest(`/users/${encoded}/follow/accept`, {
        method: 'POST',
    });
}

export async function denyFollowRequest(handle: string) {
    const encoded = encodeURIComponent(handle);
    return apiRequest(`/users/${encoded}/follow/deny`, {
        method: 'POST',
    });
}

// Messages API (DMs)
export async function fetchConversations(cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    return apiRequest(`/messages/conversations?${params}`);
}

export async function fetchNotifications(cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    return apiRequest(`/notifications?${params}`);
}

export async function fetchUnreadNotificationCount() {
    return apiRequest('/notifications/unread-count');
}

export async function markNotificationReadApi(notificationId: string) {
    return apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
    });
}

export async function markAllNotificationsReadApi() {
    return apiRequest('/notifications/mark-all-read', {
        method: 'POST',
    });
}

export async function fetchConversation(otherHandle: string) {
    const encoded = encodeURIComponent(otherHandle);
    return apiRequest(`/messages/conversation/${encoded}`);
}

export async function fetchConversationPage(otherHandle: string, cursor: string | null = null, limit: number = 50) {
    const encoded = encodeURIComponent(otherHandle);
    const params = new URLSearchParams({
        limit: limit.toString(),
        ...(cursor ? { cursor } : {}),
    });
    return apiRequest(`/messages/conversation/${encoded}/paged?${params}`);
}

export async function sendMessage(recipientHandle: string, payload: { text?: string; image_url?: string; is_system_message?: boolean; source_post_id?: string }) {
    return apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
            recipient_handle: recipientHandle,
            text: payload.text ?? null,
            image_url: payload.image_url ?? null,
            is_system_message: payload.is_system_message ?? false,
            source_post_id: payload.source_post_id ?? null,
        }),
    });
}

export async function markConversationRead(otherHandle: string) {
    const encoded = encodeURIComponent(otherHandle);
    return apiRequest(`/messages/conversation/${encoded}/read`, {
        method: 'POST',
    });
}

/** Group thread: metadata + messages array */
export async function fetchGroupConversation(groupId: string) {
    return apiRequest(`/messages/group/${encodeURIComponent(groupId)}`);
}

export async function fetchGroupConversationPage(groupId: string, cursor: string | null = null, limit: number = 50) {
    const params = new URLSearchParams({
        limit: limit.toString(),
        ...(cursor ? { cursor } : {}),
    });
    return apiRequest(`/messages/group/${encodeURIComponent(groupId)}/paged?${params}`);
}

export async function sendGroupMessage(
    groupId: string,
    payload: { text?: string | null; image_url?: string | null; is_system_message?: boolean },
) {
    return apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
            chat_group_id: groupId,
            text: payload.text ?? null,
            image_url: payload.image_url ?? null,
            is_system_message: payload.is_system_message ?? false,
        }),
    });
}

export async function markGroupConversationRead(groupId: string) {
    return apiRequest(`/messages/group/${encodeURIComponent(groupId)}/read`, {
        method: 'POST',
    });
}

// —— Chat groups (community / WhatsApp-style) ——
export async function fetchChatGroups() {
    return apiRequest('/chat-groups');
}

export async function createChatGroupApi(name: string, avatarUrl?: string | null) {
    return apiRequest('/chat-groups', {
        method: 'POST',
        body: JSON.stringify({
            name,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        }),
    });
}

export async function deleteChatGroup(id: string) {
    return apiRequest(`/chat-groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function leaveChatGroup(id: string) {
    if (!isLaravelApiEnabled()) {
        const { mockLeaveChatGroup } = await import('./messages');
        mockLeaveChatGroup(id);
        return Promise.resolve({ ok: true });
    }
    return apiRequest(`/chat-groups/${encodeURIComponent(id)}/leave`, { method: 'POST' });
}

export async function inviteToChatGroup(groupId: string, inviteeHandle: string) {
    if (!isLaravelApiEnabled()) {
        const { mockInviteToChatGroup } = await import('./messages');
        return mockInviteToChatGroup(groupId, inviteeHandle);
    }
    return apiRequest(`/chat-groups/${encodeURIComponent(groupId)}/invites`, {
        method: 'POST',
        body: JSON.stringify({ invitee_handle: inviteeHandle }),
    });
}

export async function fetchPendingChatGroupInvites() {
    return apiRequest('/chat-groups/invites/pending');
}

export async function acceptChatGroupInvite(inviteId: string) {
    return apiRequest(`/chat-groups/invites/${encodeURIComponent(inviteId)}/accept`, { method: 'POST' });
}

export async function declineChatGroupInvite(inviteId: string) {
    return apiRequest(`/chat-groups/invites/${encodeURIComponent(inviteId)}/decline`, { method: 'POST' });
}

// Collections API
export async function fetchCollections() {
    return apiRequest('/collections');
}

export async function fetchCollection(collectionId: string) {
    return apiRequest(`/collections/${encodeURIComponent(collectionId)}`);
}

export async function createCollectionApi(data: {
    name: string;
    isPrivate?: boolean;
    is_private?: boolean;
    postId?: string;
    post_id?: string;
}) {
    return apiRequest('/collections', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateCollectionApi(collectionId: string, data: {
    name?: string;
    isPrivate?: boolean;
    is_private?: boolean;
}) {
    return apiRequest(`/collections/${encodeURIComponent(collectionId)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteCollectionApi(collectionId: string) {
    return apiRequest(`/collections/${encodeURIComponent(collectionId)}`, {
        method: 'DELETE',
    });
}

export async function addPostToCollectionApi(collectionId: string, postId: string) {
    return apiRequest(`/collections/${encodeURIComponent(collectionId)}/posts`, {
        method: 'POST',
        body: JSON.stringify({ postId, post_id: postId }),
    });
}

export async function removePostFromCollectionApi(collectionId: string, postId: string) {
    return apiRequest(`/collections/${encodeURIComponent(collectionId)}/posts`, {
        method: 'DELETE',
        body: JSON.stringify({ postId, post_id: postId }),
    });
}

export async function estimateBoostPriceApi(params: {
    feedType: 'local' | 'regional' | 'national';
    userId: string;
    radiusKm: number;
    durationHours: 6 | 12 | 24 | 72;
}) {
    const data = await apiRequest('/boost/estimate', {
        method: 'POST',
        body: JSON.stringify({
            feedType: params.feedType,
            userId: params.userId,
            radiusKm: params.radiusKm,
            durationHours: params.durationHours,
        }),
    }) as {
        eligibleUsersCount?: number;
        priceEur?: number;
        priceCents?: number;
        error?: string;
    };
    if ((data as any).error) throw new Error((data as any).error);
    return data;
}

/** Create a Stripe PaymentIntent for boost. Returns { clientSecret }. */
export async function createBoostPaymentIntent(params: {
    postId: string;
    feedType: 'local' | 'regional' | 'national';
    userId: string;
    radiusKm: number;
    durationHours: 6 | 12 | 24 | 72;
}) {
    const data = await apiRequest('/boost/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({
            postId: params.postId,
            feedType: params.feedType,
            userId: params.userId,
            radiusKm: params.radiusKm,
            durationHours: params.durationHours,
        }),
    }) as { clientSecret?: string; client_secret?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const clientSecret = data.clientSecret ?? data.client_secret;
    if (!clientSecret) throw new Error('No client secret returned');
    return { clientSecret };
}

/** Activate boost after Stripe payment. Requires paymentIntentId from redirect URL. */
export async function activateBoostApi(params: {
    paymentIntentId: string;
    postId: string;
    feedType: 'local' | 'regional' | 'national';
    userId: string;
    price: number;
    radiusKm?: number;
    eligibleUsersCount?: number;
    durationHours?: 6 | 12 | 24 | 72;
    centerLocal?: string;
}) {
    return apiRequest('/boost/activate', {
        method: 'POST',
        body: JSON.stringify({
            paymentIntentId: params.paymentIntentId,
            postId: params.postId,
            feedType: params.feedType,
            userId: params.userId,
            price: params.price,
            radiusKm: params.radiusKm,
            eligibleUsersCount: params.eligibleUsersCount,
            durationHours: params.durationHours,
            centerLocal: params.centerLocal,
        }),
    }) as Promise<{ boost: { id: number; postId: string; feedType: string; activatedAt: string; expiresAt: string } }>;
}

/** Get active boosted post IDs for a feed type. */
export async function getActiveBoostedPostIdsApi(feedType: 'local' | 'regional' | 'national'): Promise<string[]> {
    const data = await apiRequest(`/boost/active-ids?feedType=${encodeURIComponent(feedType)}`) as { postIds?: string[] };
    return data.postIds ?? [];
}

/** Get boost status for a single post. */
export async function getBoostStatusApi(postId: string): Promise<{
    isActive: boolean;
    timeRemaining: number;
    feedType: string | null;
    activatedAt: string | null;
    expiresAt: string | null;
}> {
    const data = await apiRequest(`/boost/status/${encodeURIComponent(postId)}`) as {
        isActive: boolean;
        timeRemaining: number;
        feedType: string | null;
        activatedAt: string | null;
        expiresAt: string | null;
    };
    return data;
}

/** Get boost analytics for a post owned by the current user. */
export async function getBoostAnalyticsApi(postId: string, range: '24h' | '7d' | 'all' = 'all'): Promise<{
    hasBoost: boolean;
    isActive: boolean;
    postId: string;
    range?: '24h' | '7d' | 'all';
    feedType?: 'local' | 'regional' | 'national' | null;
    activatedAt?: string | null;
    expiresAt?: string | null;
    spendEur?: number;
    analytics: {
        impressions: number;
        likes: number;
        comments: number;
        shares: number;
        profileVisits: number;
        messageStarts: number;
        costPerProfileVisit: number | null;
        costPerMessageStart: number | null;
        lastUpdatedAt?: string | null;
        trend?: {
            impressions?: Array<{ bucket: string; value: number }>;
            likes?: Array<{ bucket: string; value: number }>;
            comments?: Array<{ bucket: string; value: number }>;
            shares?: Array<{ bucket: string; value: number }>;
        };
        sourceMatchedEventsCount?: number;
    } | null;
}> {
    return apiRequest(`/boost/analytics/${encodeURIComponent(postId)}?range=${encodeURIComponent(range)}`);
}

// Upload API (with timeout and clearer errors for phone/network)
const UPLOAD_TIMEOUT_MS = 60000; // 60s for slow connections

export async function uploadFile(file: File) {
    if (isMockMode()) {
        throwMockConnectionRefused();
    }

    const formData = new FormData();
    formData.append('file', file);

    const authHeader = await getAuthorizationHeader();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '');
    const uploadUrl = `${API_BASE_URL}/upload/single`;

    try {
        // Do NOT set Content-Type — browser sets multipart boundary automatically.
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ...authHeader,
            },
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = 'Upload failed';
            try {
                const errorData = await response.json();
                const parts = [errorData.error, errorData.message].filter(Boolean);
                if (errorData.detail) parts.push(errorData.detail);
                errorMessage = parts.join(': ') || JSON.stringify(errorData);
            } catch (e) {
                errorMessage = `Upload failed: HTTP ${response.status} ${response.statusText}`;
            }
            console.log('[uploadFile/web] response status=', response.status, errorMessage);
            throw new Error(errorMessage);
        }

        return response.json();
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.log('[uploadFile/web] fetch error=', {
            url: uploadUrl,
            name: err?.name,
            message: err?.message,
        });
        if (err?.name === 'AbortError') {
            throw new Error('Upload timed out. Check your connection and try again.');
        }
        const msg = err?.message ?? '';
        const isNetwork =
            msg === 'Failed to fetch' ||
            msg.includes('Network request failed') ||
            msg.includes('NetworkError') ||
            msg.includes('Load failed') ||
            err?.name === 'TypeError';
        if (isNetwork) {
            const onNetwork = typeof window !== 'undefined' &&
                window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            throw new Error(
                onNetwork
                    ? `Can't reach the server at ${uploadUrl}. Use the same Wi‑Fi as this computer and ensure the backend is running.`
                    : `Network error uploading to ${uploadUrl}. Check that the backend is running and try again.`,
            );
        }
        throw err;
    }
}

// Offline queue functions (keep existing implementation)
export async function enqueue(action: any) {
    // Keep existing offline queue implementation
    const { get, set } = await import('idb-keyval');
    const queue = await get('mutationQueue') || [];
    const { randomUUID } = await import('../utils/uuid');
    queue.push({ ...action, id: randomUUID(), timestamp: Date.now() });
    await set('mutationQueue', queue);
}

export async function processQueue() {
    const { get, set } = await import('idb-keyval');
    const queue = await get('mutationQueue') || [];

    if (queue.length === 0) return;

    const processed: string[] = [];
    const failed: string[] = [];

    for (const action of queue) {
        try {
            switch (action.type) {
                case 'like':
                    await toggleLike(action.postId);
                    processed.push(action.id);
                    break;
                case 'follow':
                    await toggleFollow(action.userHandle, action.following);
                    processed.push(action.id);
                    break;
                case 'comment':
                    await addComment(action.postId, action.text);
                    processed.push(action.id);
                    break;
                case 'view':
                    await incrementView(action.postId);
                    processed.push(action.id);
                    break;
                case 'share':
                    await sharePost(action.postId);
                    processed.push(action.id);
                    break;
                case 'reclip':
                    await reclipPost(action.postId);
                    processed.push(action.id);
                    break;
                case 'commentLike':
                    await toggleCommentLike(action.commentId);
                    processed.push(action.id);
                    break;
                case 'reply':
                    await addReply(action.parentId, action.text);
                    processed.push(action.id);
                    break;
                default:
                    failed.push(action.id);
            }
        } catch (error) {
            console.error('Failed to process action:', action, error);
            failed.push(action.id);
        }
    }

    // Remove processed actions from queue
    const remainingQueue = queue.filter((action: any) => !processed.includes(action.id));
    await set('mutationQueue', remainingQueue);

    return { processed: processed.length, failed: failed.length };
}
