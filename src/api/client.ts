/// <reference types="vite/client" />
// Updated API client for Laravel backend
// Use IP address if accessing from network, otherwise localhost
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'https' : 'http';

    // When accessing from phone/tablet via IP (e.g. 192.168.1.5:5173), NEVER use localhost - it points to the device, not the laptop
    const onNetwork = hostname !== 'localhost' && hostname !== '127.0.0.1';
    if (onNetwork) {
        const apiUrl = `${protocol}://${hostname}:8000/api`;
        return apiUrl;
    }

    // On laptop (localhost): use env or proxy
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    // For localhost, use proxy (same origin) - Vite forwards /api to http://localhost:8000/api
    return '/api';
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

// Posts API (6s timeout for faster fallback on slow mobile networks)
export async function fetchPostsPage(cursor: number = 0, limit: number = 10, filter: string = 'Dublin', userId?: string) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
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

/** Check if the user with the given handle follows the current viewer (for mutual-follow DM icon). Requires auth. */
export async function checkFollowsMe(handle: string): Promise<{ follows_me: boolean }> {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API === 'false') {
        return Promise.resolve({ follows_me: false });
    }
    const params = new URLSearchParams({ handle });
    return apiRequest(`/users/check-follows-me?${params}`);
}

export async function createPost(postData: {
    text?: string;
    location?: string;
    venue?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    caption?: string;
    imageText?: string;
    bannerText?: string;
    stickers?: any[];
    templateId?: string;
    mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; text?: string; textStyle?: any }>;
    textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string };
    taggedUsers?: string[];
    videoCaptionsEnabled?: boolean;
    videoCaptionText?: string;
    subtitlesEnabled?: boolean;
    subtitleText?: string;
    editTimeline?: any; // Edit timeline for hybrid editing pipeline
    musicTrackId?: number; // Library music track ID
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
export async function fetchUserProfile(handle: string, userId?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
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

export async function fetchFollowers(handle: string, cursor: number = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
        limit: limit.toString(),
    });
    const encoded = encodeURIComponent(handle);
    return apiRequest(`/users/${encoded}/followers?${params}`);
}

export async function fetchFollowing(handle: string, cursor: number = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
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
export async function fetchConversations(cursor: number = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
        limit: limit.toString(),
    });
    return apiRequest(`/messages/conversations?${params}`);
}

export async function fetchConversation(otherHandle: string) {
    const encoded = encodeURIComponent(otherHandle);
    return apiRequest(`/messages/conversation/${encoded}`);
}

export async function sendMessage(recipientHandle: string, payload: { text?: string; image_url?: string; is_system_message?: boolean }) {
    return apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
            recipient_handle: recipientHandle,
            text: payload.text ?? null,
            image_url: payload.image_url ?? null,
            is_system_message: payload.is_system_message ?? false,
        }),
    });
}

export async function markConversationRead(otherHandle: string) {
    const encoded = encodeURIComponent(otherHandle);
    return apiRequest(`/messages/conversation/${encoded}/read`, {
        method: 'POST',
    });
}

/** Create a Stripe PaymentIntent for boost. Returns { clientSecret }. */
export async function createBoostPaymentIntent(postId: string, feedType: 'local' | 'regional' | 'national') {
    const data = await apiRequest('/boost/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ postId, feedType }),
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
}) {
    return apiRequest('/boost/activate', {
        method: 'POST',
        body: JSON.stringify({
            paymentIntentId: params.paymentIntentId,
            postId: params.postId,
            feedType: params.feedType,
            userId: params.userId,
            price: params.price,
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
