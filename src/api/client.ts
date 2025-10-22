// Updated API client for production backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper function to make API requests
async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('authToken');

    const config: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
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

export async function createPost(postData: {
    text?: string;
    location?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
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

    return apiRequest(`/users/${handle}?${params}`);
}

export async function toggleFollow(handle: string) {
    return apiRequest(`/users/${handle}/follow`, {
        method: 'POST',
    });
}

export async function fetchFollowers(handle: string, cursor: number = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
        limit: limit.toString(),
    });

    return apiRequest(`/users/${handle}/followers?${params}`);
}

export async function fetchFollowing(handle: string, cursor: number = 0, limit: number = 20) {
    const params = new URLSearchParams({
        cursor: cursor.toString(),
        limit: limit.toString(),
    });

    return apiRequest(`/users/${handle}/following?${params}`);
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
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
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

    const processed = [];
    const failed = [];

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
    const remainingQueue = queue.filter(action => !processed.includes(action.id));
    await set('mutationQueue', remainingQueue);

    return { processed: processed.length, failed: failed.length };
}
