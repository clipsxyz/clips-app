import { Platform } from 'react-native';
import { toFileUri } from './ffmpegNative';
import { copyLocalUriToCacheFile } from './localFileNative';

/**
 * Ensure FFmpeg / compression gets a real on-disk `file://` path.
 * Android gallery picks are often `content://…` which FFmpeg cannot open.
 */
export async function resolveLocalMediaUriForFfmpeg(uri: string): Promise<string> {
    const trimmed = String(uri || '').trim();
    if (!trimmed) {
        throw new Error('Empty media URI');
    }
    if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('file://')) {
        return trimmed;
    }
    if (trimmed.startsWith('/') && !trimmed.includes('://')) {
        return toFileUri(trimmed);
    }

    const needsCopy =
        trimmed.startsWith('content://') ||
        trimmed.startsWith('ph://') ||
        (Platform.OS === 'android' && !trimmed.startsWith('file://'));

    if (!needsCopy) {
        return toFileUri(trimmed);
    }

    return copyLocalUriToCacheFile(trimmed);
}
