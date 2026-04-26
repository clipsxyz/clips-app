/// <reference types="vite/client" />
import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl, isLaravelApiEnabled } from '../config/runtimeEnv';

// Updated API client for Laravel backend
// Use IP address if accessing from network, otherwise localhost (web); Metro uses env or RN defaults.
const getApiBaseUrl = () => {
    const envUrl = getRuntimeEnv('VITE_API_URL');
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined' && window.location?.hostname) {
        const hostname = window.location.hostname;
        const isHttps = window.location.protocol === 'https:';
        const protocol = isHttps ? 'https' : 'http';

        const onNetwork = hostname !== 'localhost' && hostname !== '127.0.0.1';
        if (onNetwork) {
            return `${protocol}://${hostname}:8000/api`;
        }

        // localhost in browser: same-origin proxy
        return '/api';
    }

    const rn = getReactNativeDefaultApiBaseUrl();
    if (rn) return rn;

    return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Helper function to make API requests (with configurable timeout to avoid long hangs when backend is slow)
export async function apiRequest(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}) {
    const token = localStorage.getItem('authToken');
    const { timeoutMs = 8000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const config: RequestInit = {
        ...fetchOptions,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
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

        return response.json();
    } catch (error: any) {
        clearTimeout(timeoutId);
        // Suppress connection refused errors when backend isn't running
        // Check for various connection error patterns
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'AbortError' ||
            (error?.name === 'TypeError' && error?.message?.includes('fetch'));

        if (isConnectionError) {
            // Re-throw with a specific error type that can be caught and handled gracefully
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
}) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
}

export async function loginUser(email: string, password: string) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

export async function getCurrentUser() {
    return apiRequest('/auth/me');
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
        avatarUrl: (apiUser.avatar_url ?? apiUser.avatarUrl) as string | undefined,
        profileBackgroundUrl: (apiUser.profile_background_url ?? apiUser.profileBackgroundUrl) as string | undefined,
        socialLinks: (apiUser.social_links ?? apiUser.socialLinks) as Record<string, string> | undefined,
        is_private: apiUser.is_private as boolean | undefined,
        is_verified: apiUser.is_verified as boolean | undefined,
        accountType,
    };
}

export async function updateAuthProfile(data: {
    display_name?: string;
    bio?: string | null;
    places_traveled?: string[];
    location_local?: string | null;
    location_regional?: string | null;
    location_national?: string | null;
    social_links?: Record<string, string | undefined>;
    account_type?: 'personal' | 'business';
    is_business?: boolean;
}) {
    return apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// Posts API (6s timeout for faster fallback on slow mobile networks)
export async function fetchPostsPage(cursor: number | string | null = 0, limit: number = 10, filter: string = 'Dublin', userId?: string) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
        filter,
        ...(userId && { userId }),
    });

    return apiRequest(`/posts?${params}`, { timeoutMs: 6000 });
}

export async function fetchPost(postId: string, userId?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);

    return apiRequest(`/posts/${postId}?${params}`);
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
    editTimeline?: any; // Edit timeline for hybrid editing pipeline
    musicTrackId?: number; // Library music track ID
    templateStyle?: 'default' | 'polaroid' | 'neon' | 'glass' | 'magazine';
}) {
    return apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
    });
}

export async function toggleLike(postId: string) {
    return apiRequest(`/posts/${postId}/like`, {
        method: 'POST',
    });
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
        paged: 'true',
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

// Users API
export async function fetchUserProfile(
    handle: string,
    userId?: string,
    postsCursor?: string | number | null,
    postsLimit?: number,
    sourcePostId?: string,
) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (postsCursor != null) params.append('postsCursor', String(postsCursor));
    if (postsLimit != null) params.append('postsLimit', String(postsLimit));
    if (sourcePostId) params.append('sourcePostId', sourcePostId);
    const encoded = encodeURIComponent(handle);
    return apiRequest(`/users/${encoded}?${params}`);
}

export async function toggleFollow(handle: string) {
    // Encode the handle for URL (handles special characters like @)
    const encodedHandle = encodeURIComponent(handle);
    return apiRequest(`/users/${encodedHandle}/follow`, {
        method: 'POST',
    });
}

export async function fetchFollowers(handle: string, cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    const encoded = encodeURIComponent(handle);
    return apiRequest(`/users/${encoded}/followers?${params}`);
}

export async function fetchFollowing(handle: string, cursor: number | string | null = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: String(cursor ?? 0),
        limit: limit.toString(),
    });
    const encoded = encodeURIComponent(handle);
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

export async function createChatGroupApi(name: string) {
    return apiRequest('/chat-groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
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
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('authToken');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE_URL}/upload/single`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
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
            throw new Error(errorMessage);
        }

        return response.json();
    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
            throw new Error('Upload timed out. Check your connection and try again.');
        }
        const msg = err?.message ?? '';
        const isNetwork =
            msg === 'Failed to fetch' ||
            msg.includes('NetworkError') ||
            msg.includes('Load failed') ||
            err?.name === 'TypeError';
        if (isNetwork) {
            const onNetwork = typeof window !== 'undefined' &&
                window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            throw new Error(
                onNetwork
                    ? "Can't reach the server. Use the same Wi‑Fi as this computer and ensure the backend is running (e.g. http://<this-PC-IP>:8000)."
                    : 'Network error. Check that the backend is running and try again.'
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
                    await toggleFollow(action.userHandle);
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
