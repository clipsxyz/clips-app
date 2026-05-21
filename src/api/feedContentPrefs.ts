import { apiRequest } from './client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import type { FeedContentPrefsPayload } from '../utils/feedContentPrefsCore';

export async function fetchFeedContentPrefsFromApi(): Promise<FeedContentPrefsPayload | null> {
    if (!isLaravelApiEnabled()) return null;
    try {
        return await apiRequest('/feed-content-preferences');
    } catch (err) {
        console.warn('fetchFeedContentPrefsFromApi failed', err);
        return null;
    }
}

export async function muteAuthorOnServer(handle: string): Promise<void> {
    if (!isLaravelApiEnabled()) return;
    try {
        await apiRequest('/feed-content-preferences/mute', {
            method: 'POST',
            body: JSON.stringify({ handle }),
        });
    } catch (err) {
        console.warn('muteAuthorOnServer failed', err);
    }
}

export async function blockAuthorOnServer(handle: string): Promise<void> {
    if (!isLaravelApiEnabled()) return;
    try {
        await apiRequest('/feed-content-preferences/block', {
            method: 'POST',
            body: JSON.stringify({ handle }),
        });
    } catch (err) {
        console.warn('blockAuthorOnServer failed', err);
    }
}

export async function hidePostOnServer(postId: string): Promise<void> {
    if (!isLaravelApiEnabled()) return;
    try {
        await apiRequest('/feed-content-preferences/hide', {
            method: 'POST',
            body: JSON.stringify({ post_id: postId }),
        });
    } catch (err) {
        console.warn('hidePostOnServer failed', err);
    }
}

export async function markNotInterestedOnServer(postId: string): Promise<void> {
    if (!isLaravelApiEnabled()) return;
    try {
        await apiRequest('/feed-content-preferences/not-interested', {
            method: 'POST',
            body: JSON.stringify({ post_id: postId }),
        });
    } catch (err) {
        console.warn('markNotInterestedOnServer failed', err);
    }
}
