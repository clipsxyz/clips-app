import { resolvePublicMediaUrl } from './apiBaseUrl';

// Simple mock user directory for avatars by handle
const handleToAvatar: Record<string, string> = {
    'Sarah@Artane': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    'Bob@Ireland': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    'Bob@Finglas': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    'Alice@Dublin': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    'Alice@Finglas': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    'Liam@cork': 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400&h=400&fit=crop',
    'Ava@galway': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    'Noah@london': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
};

export function getKnownUserHandles(): string[] {
    return Object.keys(handleToAvatar);
}

export function getAvatarForHandle(handle: string | undefined | null): string | undefined {
    if (!handle) return undefined;
    if (handleToAvatar[handle]) return handleToAvatar[handle];
    const normalized = handle.toLowerCase();
    if (handleToAvatar[normalized]) return handleToAvatar[normalized];
    const exact = Object.keys(handleToAvatar).find((k) => k.toLowerCase() === normalized);
    if (exact) return handleToAvatar[exact];
    // Mock feeds reuse first names across places (Bob@Ireland vs Bob@Finglas).
    const local = normalized.split('@')[0]?.trim();
    if (!local) return undefined;
    const byLocal = Object.keys(handleToAvatar).find(
        (k) => k.toLowerCase().split('@')[0] === local,
    );
    return byLocal ? handleToAvatar[byLocal] : undefined;
}

/** Absolute URI for RN Image / web img — relative `/storage/...` paths fail on device. */
export function resolveAvatarImageUri(
    src?: string | null,
    handle?: string | null,
): string | undefined {
    const raw = String(src || getAvatarForHandle(handle) || '').trim();
    if (!raw) return undefined;
    return resolvePublicMediaUrl(raw) || raw;
}

export function setAvatarForHandle(handle: string, url: string): void {
    if (!handle) return;
    const trimmed = String(url || '').trim();
    if (!trimmed) return;
    handleToAvatar[handle] = trimmed;
    handleToAvatar[handle.toLowerCase()] = trimmed;
}

const handleToFlag: Record<string, string> = {
    'Sarah@Artane': '🇮🇪',
};

export function getFlagForHandle(handle: string | undefined | null): string | undefined {
    if (!handle) return undefined;
    return handleToFlag[handle] || undefined;
}

export function setFlagForHandle(handle: string, flag: string): void {
    if (!handle) return;
    handleToFlag[handle] = flag;
}


