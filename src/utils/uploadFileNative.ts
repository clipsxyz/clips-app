import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativeDefaultApiBaseUrl, getRuntimeEnv } from '../config/runtimeEnv';

function getApiBaseUrl(): string {
    const envUrl = getRuntimeEnv('VITE_API_URL');
    if (envUrl) {
        try {
            const parsed = new URL(envUrl);
            if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                const rn = getReactNativeDefaultApiBaseUrl();
                if (rn) {
                    const rnParsed = new URL(rn);
                    parsed.protocol = rnParsed.protocol;
                    parsed.hostname = rnParsed.hostname;
                    parsed.port = rnParsed.port;
                    return parsed.toString().replace(/\/$/, '');
                }
            }
        } catch {
            // use env as-is
        }
        return envUrl.replace(/\/$/, '');
    }
    const rn = getReactNativeDefaultApiBaseUrl();
    if (rn) return rn.replace(/\/$/, '');
    return 'http://localhost:8000/api';
}

async function getAuthToken(): Promise<string | null> {
    try {
        if (typeof localStorage !== 'undefined') {
            const token = localStorage.getItem('authToken');
            if (token) return token;
        }
    } catch {
        // ignore
    }
    try {
        return await AsyncStorage.getItem('authToken');
    } catch {
        return null;
    }
}

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
    const token = await getAuthToken();
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
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
