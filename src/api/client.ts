/// <reference types="vite/client" />
// Updated API client for Laravel backend
// Use IP address if accessing from network, otherwise localhost
const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        console.log('Using VITE_API_URL from env:', import.meta.env.VITE_API_URL);
        return import.meta.env.VITE_API_URL;
    }
    // Check if frontend is using HTTPS
    const isHttps = window.location.protocol === 'https:';
    const protocol = isHttps ? 'https' : 'http';

    // If accessing from a different host (like phone on network), use IP address
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // Extract IP from current URL (e.g., 192.168.1.3:5173 -> 192.168.1.3:8000)
        const ip = hostname;
        // For network access, use the same protocol as frontend but direct to backend port
        const apiUrl = `${protocol}://${ip}:8000/api`;
        console.log('Using network IP for API:', apiUrl, '(from hostname:', hostname, ', protocol:', protocol, ')');
        return apiUrl;
    }
    // For localhost, use proxy (same origin) to avoid mixed content issues
    // The Vite proxy will forward /api requests to http://localhost:8000/api
    const localhostUrl = '/api';
    console.log('Using proxy for API (localhost):', localhostUrl, '(frontend protocol:', protocol, ')');
    return localhostUrl;
};

const API_BASE_URL = getApiBaseUrl();
console.log('🌐 API Base URL:', API_BASE_URL);

// Helper function to make API requests
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('authToken');

    const config: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

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
        // Suppress connection refused errors when backend isn't running
        // Check for various connection error patterns
        const isConnectionError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('NetworkError') ||
            error?.name === 'TypeError' && error?.message?.includes('fetch');

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

// Posts API
export async function fetchPostsPage(cursor: number = 0, limit: number = 10, filter: string = 'Dublin', userId?: string) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
        limit: limit.toString(),
        filter,
        ...(userId && { userId }),
    });

    return apiRequest(`/posts?${params}`);
}

export async function fetchPost(postId: string, userId?: string) {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);

    return apiRequest(`/posts/${postId}?${params}`);
}

/** Check if the user with the given handle follows the current viewer (for mutual-follow DM icon). Requires auth. */
export async function checkFollowsMe(handle: string): Promise<{ follows_me: boolean }> {
    const params = new URLSearchParams({ handle });
    return apiRequest(`/users/check-follows-me?${params}`);
}

export async function createPost(postData: {
    text?: string;
    location?: string;
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

// Upload API
export async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/upload/single`, {
        method: 'POST',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
        } catch (e) {
            errorMessage = `Upload failed: HTTP ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

// Offline queue functions (keep existing implementation)
export async function enqueue(action: any) {
    // Keep existing offline queue implementation
    const { get, set } = await import('idb-keyval');
    const queue = await get('mutationQueue') || [];
    queue.push({ ...action, id: crypto.randomUUID(), timestamp: Date.now() });
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
