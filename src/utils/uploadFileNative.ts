import { getApiBaseUrl } from '../api/apiBaseUrl';
import { IS_MOCK } from '../api/apiMode';
import { getAuthorizationHeader } from './authTokenBridge';

export type NativeUploadResult = {
    success?: boolean;
    fileUrl?: string;
    url?: string;
};

/** Upload a local file URI to Laravel `/upload/single` (React Native FormData). */
export async function uploadFileFromUri(
    uri: string,
    mimeType = 'image/jpeg',
    fileName = 'upload.jpg',
): Promise<NativeUploadResult> {
    if (IS_MOCK) {
        const err = new Error('CONNECTION_REFUSED');
        err.name = 'ConnectionRefused';
        throw err;
    }

    const authHeader = await getAuthorizationHeader();
    const formData = new FormData();
    formData.append('file', {
        uri,
        type: mimeType,
        name: fileName,
    } as unknown as Blob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(`${getApiBaseUrl()}/upload/single`, {
            method: 'POST',
            headers: {
                ...authHeader,
            },
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let message = `Upload failed (${response.status})`;
            try {
                const data = await response.json();
                message = [data.error, data.message, data.detail].filter(Boolean).join(': ') || message;
            } catch {
                // ignore parse errors
            }
            throw new Error(message);
        }

        return (await response.json()) as NativeUploadResult;
    } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Upload timed out. Check your connection and try again.');
        }
        throw err;
    }
}
