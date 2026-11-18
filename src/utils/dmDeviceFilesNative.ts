import { NativeModules } from 'react-native';

export type DmRecentFile = {
    uri: string;
    mime: string;
    name: string;
    isVideo: boolean;
    durationMs: number;
    thumbUri?: string;
};

export type DmPickedFile = {
    uri: string;
    mime: string;
    name: string;
};

type NativeDmFiles = {
    recentMedia?: (limit: number) => Promise<Array<Record<string, unknown>>>;
    materialize?: (uri: string) => Promise<string>;
    pickDocument?: () => Promise<{ uri?: string; mime?: string; name?: string } | null>;
};

const native = NativeModules.DmDeviceFiles as NativeDmFiles | undefined;

function asText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export async function listDmRecentMedia(limit = 24): Promise<DmRecentFile[]> {
    if (typeof native?.recentMedia !== 'function') return [];
    const rows = await native.recentMedia(limit);
    return (rows || [])
        .map((row) => {
            const uri = asText(row.uri);
            return {
                uri,
                mime: asText(row.mime) || 'application/octet-stream',
                name: asText(row.name) || 'file',
                isVideo: row.isVideo === true,
                durationMs: Number(row.durationMs) || 0,
                thumbUri: asText(row.thumbUri) || undefined,
            };
        })
        .filter((row) => row.uri.length > 0);
}

/** Copy a content:// gallery item into a file:// the uploader can read. */
export async function materializeDmFile(uri: string): Promise<string> {
    const trimmed = String(uri || '').trim();
    if (!trimmed || !/^content:/i.test(trimmed) || typeof native?.materialize !== 'function') {
        return trimmed;
    }
    const fileUri = await native.materialize(trimmed);
    return String(fileUri || trimmed).trim() || trimmed;
}

export async function pickDmDocument(): Promise<DmPickedFile | null> {
    if (typeof native?.pickDocument !== 'function') {
        throw new Error('File picker is not available in this build.');
    }
    const picked = await native.pickDocument();
    const uri = asText(picked?.uri);
    if (!uri) return null;
    return {
        uri,
        mime: asText(picked?.mime) || 'application/octet-stream',
        name: asText(picked?.name) || 'file',
    };
}
