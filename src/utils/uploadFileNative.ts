import { Platform } from 'react-native';
import { getApiBaseUrl } from '../api/apiBaseUrl';
import { isMockMode } from '../api/apiMode';
import { getAuthorizationHeader } from './authTokenBridge';

export type NativeUploadResult = {
    success?: boolean;
    fileUrl?: string;
    url?: string;
    error?: string;
};

/** RN multipart file shape — must not be sent as a Blob/JSON. */
type RnFormFile = {
    uri: string;
    type: string;
    name: string;
};

function normalizeUploadUri(uri: string): string {
    const trimmed = String(uri || '').trim();
    if (!trimmed) return trimmed;
    // Remote / Android content / Photos stay as-is
    if (/^(https?|content|ph):\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('file://')) return trimmed;
    // Absolute filesystem path → file:// (required by Android OkHttp)
    if (trimmed.startsWith('/')) return `file://${trimmed}`;
    return trimmed;
}

function inferMimeAndName(
    uri: string,
    mimeType?: string,
    fileName?: string,
): { type: string; name: string } {
    const hint = `${uri} ${fileName || ''} ${mimeType || ''}`.toLowerCase();
    const isVideo =
        (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/')) ||
        /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(hint);

    if (isVideo) {
        const name =
            fileName && /\.(mp4|mov|m4v|webm)$/i.test(fileName)
                ? fileName.replace(/\.(mov|m4v|webm)$/i, '.mp4')
                : `clip-${Date.now()}.mp4`;
        // Always advertise video/mp4 for RN uploads (Laravel accepts mp4 extension).
        return { type: 'video/mp4', name: name.replace(/[^\w.\-]+/g, '_') };
    }

    const name =
        fileName && /\.(jpe?g|png|gif|webp)$/i.test(fileName)
            ? fileName
            : `photo-${Date.now()}.jpg`;
    const type =
        mimeType && mimeType.startsWith('image/')
            ? mimeType
            : /\.png$/i.test(name)
              ? 'image/png'
              : 'image/jpeg';
    return { type, name: name.replace(/[^\w.\-]+/g, '_') };
}

/**
 * Auth-only headers for multipart upload.
 * Never set Content-Type — fetch must add multipart/form-data with boundary.
 */
async function uploadAuthHeaders(): Promise<Record<string, string>> {
    const auth = await getAuthorizationHeader();
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (auth.Authorization) {
        headers.Authorization = auth.Authorization;
    }
    // Strip any Content-Type that might leak from shared helpers.
    delete (headers as any)['Content-Type'];
    delete (headers as any)['content-type'];
    return headers;
}

/** Upload a local file URI to Laravel `/upload/single` (React Native FormData). */
export async function uploadFileFromUri(
    uri: string,
    mimeType = 'image/jpeg',
    fileName = 'upload.jpg',
): Promise<NativeUploadResult> {
    if (isMockMode()) {
        const err = new Error('CONNECTION_REFUSED');
        err.name = 'ConnectionRefused';
        throw err;
    }

    const normalizedUri = normalizeUploadUri(uri);
    const { type, name } = inferMimeAndName(normalizedUri, mimeType, fileName);
    let apiBase = '';
    try {
        apiBase = String(getApiBaseUrl() || '').replace(/\/$/, '');
    } catch (err) {
        console.log('[uploadFileFromUri] getApiBaseUrl failed', err);
    }
    if (!apiBase || apiBase === '/api') {
        apiBase = 'http://localhost:8000/api';
    }
    const uploadUrl = `${apiBase}/upload/single`;
    if (!/^https?:\/\//i.test(uploadUrl)) {
        throw new Error(`Invalid upload URL (missing host): ${uploadUrl}`);
    }

    const formFile: RnFormFile = {
        uri: normalizedUri,
        type,
        name,
    };

    const formData = new FormData();
    // React Native FormData accepts { uri, type, name } — cast for TypeScript DOM typings.
    formData.append('file', formFile as unknown as Blob);

    const headers = await uploadAuthHeaders();
    console.log('[uploadFileFromUri] POST', uploadUrl, {
        platform: Platform.OS,
        apiBase,
        uriPreview: normalizedUri.slice(0, 80),
        type,
        name,
        headerKeys: Object.keys(headers),
        hasContentType: Object.keys(headers).some((k) => k.toLowerCase() === 'content-type'),
    });

    const controller = new AbortController();
    const timeoutMs = type.startsWith('video/') ? 120000 : 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let message = `Upload failed (${response.status})`;
            try {
                const data = await response.json();
                message =
                    [data.error, data.message, data.detail].filter(Boolean).join(': ') || message;
                console.log('[uploadFileFromUri] error body', data);
            } catch {
                /* ignore parse errors */
            }
            console.log('[uploadFileFromUri] response status=', response.status, message);
            if (response.status === 413) {
                const err = new Error(
                    'This clip is too large to upload. Try a shorter video.',
                );
                err.name = 'UploadTooLarge';
                throw err;
            }
            throw new Error(message);
        }

        const result = (await response.json()) as NativeUploadResult;
        console.log('[uploadFileFromUri] ok', {
            status: response.status,
            fileUrl: result.fileUrl || result.url,
        });
        return result;
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        const anyErr = err as any;
        console.log('[uploadFileFromUri] fetch error', {
            url: uploadUrl,
            name: anyErr?.name,
            message: anyErr?.message,
            stack: typeof anyErr?.stack === 'string' ? anyErr.stack.slice(0, 300) : undefined,
        });
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Upload timed out. Check your connection and try again.');
        }
        if (
            anyErr?.message === 'Network request failed' ||
            anyErr?.message?.includes('Network request failed') ||
            anyErr?.message === 'Failed to fetch'
        ) {
            throw new Error(
                `Network request failed uploading to ${uploadUrl}. Check Laravel is reachable from this device and FormData uses uri/type/name (no JSON Content-Type).`,
            );
        }
        throw err;
    }
}
