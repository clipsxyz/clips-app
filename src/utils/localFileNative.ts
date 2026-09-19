import { NativeModules } from 'react-native';
import { toFileUri } from './ffmpegNative';

type GalleryRollFs = {
    copyUriToCache?: (uri: string) => Promise<{ uri?: string; fileSize?: number }>;
    statUri?: (uri: string) => Promise<{ exists?: boolean; size?: number }>;
};

const GalleryFs = NativeModules.GalleryRollPicker as GalleryRollFs | undefined;

function isRemoteOrData(uri: string): boolean {
    return /^https?:\/\//i.test(uri) || /^data:/i.test(uri);
}

function parsePositiveSize(raw: unknown): number | null {
    const n = typeof raw === 'string' ? Number(raw) : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Byte size of a local file:// or content:// URI. Never loads Expo. */
export async function statLocalFileBytes(uri: string): Promise<number | null> {
    const trimmed = String(uri || '').trim();
    if (!trimmed || isRemoteOrData(trimmed)) return null;

    if (typeof GalleryFs?.statUri === 'function') {
        try {
            const info = await GalleryFs.statUri(trimmed);
            if (info?.exists) {
                const size = parsePositiveSize(info.size);
                if (size != null) return size;
            }
        } catch (err) {
            console.warn('[statLocalFileBytes] native stat failed', err);
        }
    }

    return null;
}

/**
 * Materialize gallery `content://` / `ph://` into a real `file://` path for FFmpeg.
 */
export async function copyLocalUriToCacheFile(uri: string): Promise<string> {
    const trimmed = String(uri || '').trim();
    if (!trimmed) {
        throw new Error('Empty media URI');
    }
    if (isRemoteOrData(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('file://')) {
        return trimmed;
    }
    if (trimmed.startsWith('/') && !trimmed.includes('://')) {
        return toFileUri(trimmed);
    }

    if (typeof GalleryFs?.copyUriToCache === 'function') {
        const copied = await GalleryFs.copyUriToCache(trimmed);
        const dest = String(copied?.uri || '').trim();
        if (dest) {
            return dest.startsWith('file://') ? dest : toFileUri(dest);
        }
    }

    throw new Error(
        'Cannot copy gallery media to a local file. Rebuild the app so GalleryRollPicker.copyUriToCache is available.',
    );
}

