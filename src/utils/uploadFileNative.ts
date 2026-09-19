import { Platform } from 'react-native';
import {
    getApiBaseUrl,
    getApiBaseUrlCandidates,
    rememberSuccessfulApiBaseUrl,
    resolvePublicMediaUrl,
} from '../api/apiBaseUrl';
import { DEV_LAN_API_BASE_URL } from '../config/runtimeEnv';
import { isMockMode } from '../api/apiMode';
import { getAuthorizationHeader } from './authTokenBridge';
import { resolveLocalMediaUriForFfmpeg } from './resolveLocalMediaUriForFfmpegNative';

export type NativeUploadResult = {
    success?: boolean;
    fileUrl?: string;
    url?: string;
    error?: string;
};

/** RN multipart file shape — must not be sent as a Blob/JSON. */
export type RnFormFile = {
    uri: string;
    type: string;
    name: string;
};

export function normalizeNativeUploadUri(uri: string): string {
    const trimmed = String(uri || '').trim();
    if (!trimmed) return trimmed;
    if (/^(https?|content|ph):\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('file://')) return trimmed;
    if (trimmed.startsWith('/')) return `file://${trimmed}`;
    if (Platform.OS === 'android' && !trimmed.includes('://')) {
        return `file://${trimmed}`;
    }
    return trimmed;
}

/** Alias used by prepareMediaForPostNative / carousel upload. */
export const normalizeUploadUri = normalizeNativeUploadUri;

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
 * Every RN FormData file part must be `{ uri, name, type }` with a `file://` path on Android.
 * Returns null for empty/data URIs that OkHttp rejects as "Network request failed".
 */
export function buildNativeFormFile(
    uri: string,
    mimeType?: string,
    fileName?: string,
): RnFormFile | null {
    let normalized = normalizeNativeUploadUri(uri);
    if (!normalized) return null;
    if (/^data:/i.test(normalized)) return null;
    if (normalized.startsWith('/') && !normalized.includes('://')) {
        normalized = `file://${normalized}`;
    }
    // Android multipart uploads must use file:// (content:// often yields Network request failed).
    if (Platform.OS === 'android' && !normalized.startsWith('file://') && !/^https?:\/\//i.test(normalized)) {
        return null;
    }
    if (!/^(file|content|ph|https?):\/\//i.test(normalized)) return null;
    const { type, name } = inferMimeAndName(normalized, mimeType, fileName);
    if (!type || !name) return null;
    return { uri: normalized, type, name };
}

/** Multipart fetch headers: Accept + optional Auth only — never Content-Type. */
function stripContentType(headers: Record<string, string>): Record<string, string> {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'content-type') continue;
        next[key] = value;
    }
    return next;
}

/**
 * Auth-only headers for multipart upload.
 * Never set Content-Type / multipart/form-data / application/json —
 * React Native must generate the multipart boundary automatically.
 */
async function uploadAuthHeaders(): Promise<Record<string, string>> {
    const auth = await getAuthorizationHeader();
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (auth.Authorization) {
        headers.Authorization = auth.Authorization;
    }
    return stripContentType(headers);
}

function isTransientNetworkError(err: unknown): boolean {
    const anyErr = err as any;
    const message = String(anyErr?.message || '');
    const name = String(anyErr?.name || '');
    return (
        name === 'AbortError' ||
        message === 'Network request failed' ||
        message.includes('Network request failed') ||
        message === 'Failed to fetch' ||
        message.includes('Failed to fetch') ||
        message.includes('ECONNREFUSED') ||
        message.includes('CONNECTION_REFUSED') ||
        /timed out/i.test(message)
    );
}

async function postMultipartToUrl(
    uploadUrl: string,
    formFile: RnFormFile,
    headers: Record<string, string>,
    timeoutMs: number,
): Promise<NativeUploadResult> {
    if (!formFile.uri || !formFile.type || !formFile.name) {
        throw new Error('FormData file must be { uri, type, name }');
    }
    if (Platform.OS === 'android' && !formFile.uri.startsWith('file://') && !/^https?:\/\//i.test(formFile.uri)) {
        throw new Error(
            `Android upload requires file:// URI, got: ${formFile.uri.slice(0, 64)}`,
        );
    }

    const formData = new FormData();
    // React Native native shape — not a Blob/File from the DOM.
    // Do NOT set Content-Type; the runtime must generate multipart/form-data; boundary=…
    formData.append('file', {
        uri: formFile.uri,
        type: formFile.type,
        name: formFile.name,
    } as unknown as Blob);

    // Final guard: never send application/json or multipart/form-data without boundary.
    const safeHeaders = stripContentType(headers);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: safeHeaders,
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
            } catch {
                /* ignore parse errors */
            }
            if (response.status === 413) {
                const err = new Error(
                    'This clip is too large for the server upload limit. Restart Laravel with: composer serve (256M). Or try a shorter clip.',
                );
                err.name = 'UploadTooLarge';
                throw err;
            }
            const httpErr = new Error(message);
            (httpErr as any).status = response.status;
            throw httpErr;
        }

        const result = (await response.json()) as NativeUploadResult;
        const remote =
            resolvePublicMediaUrl(result.fileUrl || result.url || '') ||
            result.fileUrl ||
            result.url;
        return { ...result, fileUrl: remote, url: remote };
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        throw err;
    }
}

/**
 * Ensure gallery / absolute paths become a local `file://…` URI before FormData upload.
 * Android OkHttp often fails multipart with bare content:// without a readable file path.
 */
async function resolveUriForMultipartUpload(uri: string): Promise<string> {
    const normalized = normalizeNativeUploadUri(uri);
    if (!normalized) {
        throw new Error('Missing local media URI for upload');
    }
    if (/^https?:\/\//i.test(normalized) || /^data:/i.test(normalized)) {
        return normalized;
    }
    if (normalized.startsWith('file://')) {
        return normalized;
    }
    if (normalized.startsWith('/') && !normalized.includes('://')) {
        return `file://${normalized}`;
    }
    // content:// / ph:// → on-disk file:// before FormData (required on Android).
    try {
        const resolved = await resolveLocalMediaUriForFfmpeg(normalized);
        if (resolved.startsWith('file://') || resolved.startsWith('/')) {
            return resolved.startsWith('file://') ? resolved : `file://${resolved}`;
        }
        return resolved;
    } catch (err) {
        console.warn('[uploadFileFromUri] could not materialize content URI', err);
        throw new Error(
            'Could not convert gallery content:// URI to a local file:// path for upload.',
        );
    }
}

function resolveUploadCandidates(): string[] {
    const ordered = getApiBaseUrlCandidates()
        .map((u) => String(u || '').replace(/\/$/, ''))
        .filter((u) => /^https?:\/\//i.test(u));
    if (ordered.length > 0) return ordered;
    const fallback = String(getApiBaseUrl() || DEV_LAN_API_BASE_URL).replace(/\/$/, '');
    return [fallback || DEV_LAN_API_BASE_URL];
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

    const resolvedUri = await resolveUriForMultipartUpload(uri);
    const formFile = buildNativeFormFile(resolvedUri, mimeType, fileName);
    if (!formFile) {
        throw new Error(
            'Invalid upload file. Expected a local file:// URI with type and name for FormData.',
        );
    }

    const candidates = resolveUploadCandidates();
    const headers = await uploadAuthHeaders();
    const timeoutMs = formFile.type.startsWith('video/') ? 120000 : 60000;

    let lastError: unknown = null;

    for (const apiBase of candidates) {
        const uploadUrl = `${apiBase}/upload/single`;
        try {
            const result = await postMultipartToUrl(uploadUrl, formFile, headers, timeoutMs);
            rememberSuccessfulApiBaseUrl(apiBase);
            return result;
        } catch (err: unknown) {
            lastError = err;

            // Host answered (HTTP / validation) — do not try other bases.
            if (err instanceof Error && err.name === 'UploadTooLarge') {
                throw err;
            }
            if (typeof (err as any)?.status === 'number') {
                throw err;
            }
            if (!isTransientNetworkError(err)) {
                throw err;
            }
            // Connectivity failure — try next LAN / emulator / loopback candidate.
        }
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
        throw new Error('Upload timed out. Check your connection and try again.');
    }
    const tried = candidates.map((c) => `${c}/upload/single`).join(', ');
    throw new Error(
        `Network request failed uploading (${tried}). Check Laravel is reachable from this device, cleartext HTTP is allowed, and FormData uses { uri, type, name } with no Content-Type header.`,
    );
}
