import { getRuntimeEnv } from '../config/runtimeEnv';
import type { Post } from '../types';

/** Public web origin for share/copy links (RN has no window.location). */
export function getPublicWebBaseUrl(): string {
    const fromEnv =
        getRuntimeEnv('VITE_PUBLIC_APP_URL') ||
        getRuntimeEnv('PUBLIC_WEB_ORIGIN') ||
        getRuntimeEnv('EXPO_PUBLIC_WEB_ORIGIN');
    if (fromEnv) return String(fromEnv).replace(/\/$/, '');
    try {
        if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    } catch {
        /* ignore */
    }
    return 'https://clips.app';
}

export function buildShareablePostUrl(post: Pick<Post, 'id' | 'publicShareToken'>): string {
    const origin = getPublicWebBaseUrl();
    if (post.publicShareToken) return `${origin}/p/${post.publicShareToken}`;
    return `${origin}/post/${post.id}`;
}
