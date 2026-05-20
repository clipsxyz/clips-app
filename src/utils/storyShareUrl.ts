import { getPublicWebBaseUrl } from './shareUrls';

/** Public web URL for a specific story (matches StoriesPage share links). */
export function buildStoryShareUrl(userHandle: string, storyId: string): string {
    const base = getPublicWebBaseUrl();
    const handle = encodeURIComponent(userHandle.replace(/^@/, '').trim());
    const id = encodeURIComponent(storyId);
    return `${base}/stories?user=${handle}&story=${id}`;
}
