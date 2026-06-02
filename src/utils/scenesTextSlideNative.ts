import type { PostMediaItem } from '../types';

/** Decode `data:text/plain;base64,...` slide URLs (web ScenesModal parity). */
export function decodeScenesTextSlideContent(
    item: Pick<PostMediaItem, 'url' | 'text'>,
): string {
    if (item.text?.trim()) return item.text.trim();
    const url = item.url || '';
    if (!url.startsWith('data:text/plain;base64,')) return '';
    const base64 = url.slice('data:text/plain;base64,'.length);
    try {
        const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
        if (typeof atobFn === 'function') {
            return atobFn(base64);
        }
    } catch {
        /* fall through */
    }
    return '';
}
