import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Post } from '../types';

const POSTS_STORAGE_KEY = 'clips_app_posts';
const PENDING_CREATED_POST_KEY = 'clips_app_pending_created_post';

/** Clear only posts keys after confirmed corrupt JSON — do not touch collections. */
export async function clearCorruptFeedCachesNative(): Promise<void> {
    await clearCorruptPostsStorageNative();
}

export async function clearCorruptPostsStorageNative(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([POSTS_STORAGE_KEY, PENDING_CREATED_POST_KEY]);
    } catch {
        /* ignore */
    }
}

async function withStorageTimeout<T>(promise: Promise<T>, fallback: T, ms = 2500): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function getPostsFromStorageNative(): Promise<Post[]> {
    try {
        const raw = await withStorageTimeout(AsyncStorage.getItem(POSTS_STORAGE_KEY), null);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as Post[]) : [];
    } catch (error) {
        console.warn('Corrupt clips_app_posts storage — clearing', error);
        await clearCorruptPostsStorageNative();
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

const followsKey = (userId: string) => `clips_app_follows_${userId}`;

export async function getFollowsFromStorageNative(
    userId: string,
): Promise<Record<string, boolean>> {
    try {
        const raw = await AsyncStorage.getItem(followsKey(userId));
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
    } catch {
        return {};
    }
}

export async function saveFollowsToStorageNative(
    userId: string,
    follows: Record<string, boolean>,
): Promise<void> {
    try {
        await AsyncStorage.setItem(followsKey(userId), JSON.stringify(follows));
    } catch {
        // ignore
    }
}

export async function removeFollowsFromStorageNative(userId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(followsKey(userId));
    } catch {
        // ignore
    }
}
