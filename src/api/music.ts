import * as apiClient from './client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export type MusicTrack = {
    id: number;
    title: string;
    artist: string | null;
    genre: string | null;
    mood: string | null;
    duration: number | null;
    url: string;
    preview_url?: string | null; // Preview URL for library tracks
    thumbnail_url: string | null;
    usage_count: number;
    is_ai_generated: boolean;
    ai_service: string | null;
    metadata: Record<string, any> | null;
    is_active: boolean;
    license_type?: string | null; // CC0, CC-BY, CC-BY-SA, Public Domain
    license_url?: string | null;
    license_requires_attribution?: boolean;
    attribution_text?: string | null;
    created_at: string;
    updated_at: string;
};

export type MusicLibraryResponse = {
    success: boolean;
    data: MusicTrack[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};

export type GenerateMusicRequest = {
    mood: 'happy' | 'energetic' | 'calm' | 'dramatic' | 'romantic' | 'upbeat';
    genre: 'pop' | 'rock' | 'electronic' | 'hip-hop' | 'jazz' | 'classical';
    duration?: number; // Duration in seconds (5-90)
};

export type UploadMusicRequest = {
    file: File;
    title?: string;
    artist?: string;
    genre?: string;
    mood?: string;
};

/**
 * Generate AI music
 */
export async function generateAiMusic(params: GenerateMusicRequest): Promise<{ success: boolean; message?: string; status?: string; data?: MusicTrack }> {
    const token = localStorage.getItem('authToken');

    // Debug logging
    console.log('🎵 generateAiMusic called with params:', params);
    console.log('🎵 API URL:', `${API_BASE_URL}/music/generate`);
    console.log('🎵 Request body (stringified):', JSON.stringify(params));
    console.log('🎵 Params type check:', {
        mood: { value: params.mood, type: typeof params.mood },
        genre: { value: params.genre, type: typeof params.genre },
        duration: { value: params.duration, type: typeof params.duration }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/music/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify(params),
        }).catch((fetchError) => {
            // Network error (backend not running, CORS, etc.)
            console.error('Fetch error:', fetchError);
            throw new Error(`Failed to connect to backend server at ${API_BASE_URL}. Please ensure the Laravel backend is running (php artisan serve).`);
        });

        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `HTTP ${response.status}: ${response.statusText}`
            }));

            // Handle 401 Unauthorized
            if (response.status === 401) {
                throw new Error('Authentication required. Please log in to generate music.');
            }

            // Handle 400 Bad Request (validation errors)
            if (response.status === 400) {
                const data = await response.json().catch(() => ({}));
                console.error('❌ Validation error response:', data);

                let errorMessage = data.message || 'Validation failed';

                if (data.errors) {
                    const errorDetails = Object.entries(data.errors).map(([key, value]: [string, any]) => {
                        const errorText = Array.isArray(value) ? value.join(', ') : value;
                        return `${key}: ${errorText}`;
                    }).join('; ');
                    errorMessage = `${errorMessage}\n\nDetails: ${errorDetails}`;
                }

                if (data.received_data) {
                    console.error('📥 Received data:', data.received_data);
                    errorMessage = `${errorMessage}\n\nReceived: ${JSON.stringify(data.received_data)}`;
                }

                if (data.debug) {
                    console.error('🐛 Debug info:', data.debug);
                    errorMessage = `${errorMessage}\n\nDebug: ${JSON.stringify(data.debug)}`;
                }

                throw new Error(`Validation error: ${errorMessage}`);
            }

            // Handle 501 Not Implemented (expected for now)
            if (response.status === 501) {
                const data = await response.json().catch(() => ({}));
                return {
                    success: false,
                    message: data.message || 'AI music generation is not yet integrated.',
                    status: 'not_implemented'
                };
            }

            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        // Re-throw if it's already our custom error
        if (error.message && (error.message.includes('Failed to connect') || error.message.includes('Authentication required'))) {
            throw error;
        }

        // Handle other fetch errors
        if (error instanceof TypeError || error.name === 'TypeError') {
            throw new Error(`Failed to connect to backend server at ${API_BASE_URL}. Please ensure the Laravel backend is running (cd laravel-backend && php artisan serve).`);
        }

        throw error;
    }
}

/**
 * Get music library with filters (license-safe tracks only)
 */
export async function getMusicLibrary(params?: {
    genre?: string;
    mood?: string;
    search?: string;
}): Promise<{ success: boolean; data: MusicTrack[]; count: number }> {
    const token = localStorage.getItem('authToken');

    const queryParams = new URLSearchParams();
    if (params?.genre) queryParams.append('genre', params.genre);
    if (params?.mood) queryParams.append('mood', params.mood);
    if (params?.search) queryParams.append('search', params.search);

    try {
        const response = await fetch(`${API_BASE_URL}/music/library?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error('getMusicLibrary error:', error);
        // Re-throw with more context
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Cannot connect to server. Make sure the backend is running at http://localhost:8000');
        }
        throw error;
    }
}

/**
 * Get single music track
 */
export async function getMusicTrack(id: number): Promise<{ success: boolean; data: MusicTrack }> {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/music/${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
}

/**
 * Upload custom audio file
 */
export async function uploadMusic(params: UploadMusicRequest): Promise<{ success: boolean; data: MusicTrack; fileUrl: string }> {
    const token = localStorage.getItem('authToken');

    const formData = new FormData();
    formData.append('file', params.file);
    if (params.title) formData.append('title', params.title);
    if (params.artist) formData.append('artist', params.artist);
    if (params.genre) formData.append('genre', params.genre);
    if (params.mood) formData.append('mood', params.mood);

    const response = await fetch(`${API_BASE_URL}/music/upload`, {
        method: 'POST',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.errors || `HTTP ${response.status}`);
    }

    return data;
}

/**
 * Increment usage count when music is used
 */
export async function incrementMusicUsage(id: number): Promise<{ success: boolean; usage_count: number }> {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}/music/${id}/use`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
}

