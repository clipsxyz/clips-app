import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Post } from '../types';

const POSTS_STORAGE_KEY = 'clips_app_posts';
const PENDING_CREATED_POST_KEY = 'clips_app_pending_created_post';

export async function getPostsFromStorageNative(): Promise<Post[]> {
    try {
        const raw = await AsyncStorage.getItem(POSTS_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Post[]) : [];
    } catch {
        return [];
    }
}

export async function savePostsToStorageNative(postsToSave: Post[]): Promise<void> {
    try {
        await AsyncStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(postsToSave));
    } catch {
        // ignore
    }
}

export async function markPendingCreatedPostNative(post: Post): Promise<void> {
    try {
        await AsyncStorage.setItem(PENDING_CREATED_POST_KEY, JSON.stringify(post));
    } catch {
        // ignore
    }
}

export async function consumePendingCreatedPostNative(): Promise<Post | null> {
    try {
        const raw = await AsyncStorage.getItem(PENDING_CREATED_POST_KEY);
        if (!raw) return null;
        await AsyncStorage.removeItem(PENDING_CREATED_POST_KEY);
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Post) : null;
    } catch {
        return null;
    }
}
