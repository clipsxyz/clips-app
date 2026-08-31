import { resolvePublicMediaUrl } from './apiBaseUrl';
import { isMockMode } from '../config/runtimeEnv';

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

function isDeviceLocalUri(raw: string): boolean {
    return /^(data:|file:|content:|ph:)/i.test(raw);
}

function isMockStockAvatarUrl(raw: string): boolean {
    return /images\.unsplash\.com/i.test(raw);
}

function lookupAvatar(handle: string): string | undefined {
    if (handleToAvatar[handle]) return handleToAvatar[handle];
    const normalized = handle.toLowerCase();
    if (handleToAvatar[normalized]) return handleToAvatar[normalized];
    const noAt = handle.replace(/^@/, '');
    if (handleToAvatar[noAt]) return handleToAvatar[noAt];
    if (handleToAvatar[noAt.toLowerCase()]) return handleToAvatar[noAt.toLowerCase()];
    const exact = Object.keys(handleToAvatar).find(
        (k) => k.toLowerCase() === normalized || k.toLowerCase() === noAt.toLowerCase(),
    );
    return exact ? handleToAvatar[exact] : undefined;
}

export function getKnownUserHandles(): string[] {
    return Object.keys(handleToAvatar);
}

export function getAvatarForHandle(handle: string | undefined | null): string | undefined {
    if (!handle) return undefined;
    const found = lookupAvatar(handle);
    if (found && (isMockMode() || !isMockStockAvatarUrl(found))) {
        return found;
    }
    if (!isMockMode()) return undefined;
    const normalized = handle.toLowerCase();
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
    const fromSrc = String(src || '').trim();
    const fromHandle = !fromSrc ? String(getAvatarForHandle(handle) || '').trim() : '';
    const raw = fromSrc || fromHandle;
    if (!raw) return undefined;
    if (isDeviceLocalUri(raw)) return raw;
    if (!isMockMode() && isMockStockAvatarUrl(raw)) return undefined;
    return resolvePublicMediaUrl(raw) || raw;
}

export function setAvatarForHandle(handle: string, url: string): void {
    if (!handle) return;
    const trimmed = String(url || '').trim();
    if (!trimmed) return;
    if (!isMockMode() && isMockStockAvatarUrl(trimmed)) return;
    const resolved = isDeviceLocalUri(trimmed)
        ? trimmed
        : resolvePublicMediaUrl(trimmed) || trimmed;
    const noAt = handle.replace(/^@/, '').trim();
    handleToAvatar[handle] = resolved;
    handleToAvatar[handle.toLowerCase()] = resolved;
    if (noAt) {
        handleToAvatar[noAt] = resolved;
        handleToAvatar[noAt.toLowerCase()] = resolved;
    }
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
