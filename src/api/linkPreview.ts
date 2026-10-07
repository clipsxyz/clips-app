import { isMockMode } from '../config/runtimeEnv';
import * as apiClient from './client';
import type { LinkPreview } from '../types';
import {
    extractFirstHttpUrl,
    instagramFallbackPreview,
    isInstagramUrl,
    mapApiLinkPreview,
} from '../utils/linkPreview';

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
    const url = extractFirstHttpUrl(rawUrl) || extractFirstHttpUrl(`https://${rawUrl.trim()}`);
    if (!url || isMockMode()) return null;
    try {
        const payload = isInstagramUrl(url)
            ? await apiClient.parseLinkPreview(url)
            : await apiClient.fetchLinkPreview(url);
        const mapped = mapApiLinkPreview(payload);
        if (mapped) return mapped;
        return isInstagramUrl(url) ? instagramFallbackPreview(url) : null;
    } catch (error) {
        console.warn('fetchLinkPreview failed', error);
        return isInstagramUrl(url) ? instagramFallbackPreview(url) : null;
    }
}
