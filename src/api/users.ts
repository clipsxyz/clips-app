// Simple mock user directory for avatars by handle
const handleToAvatar: Record<string, string> = {
    'Sarah@Artane': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    'Bob@Ireland': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    'Liam@cork': 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400&h=400&fit=crop',
    'Ava@galway': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    'Noah@london': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
};

export function getAvatarForHandle(handle: string | undefined | null): string | undefined {
    if (!handle) return undefined;
    return handleToAvatar[handle] || undefined;
}

export function setAvatarForHandle(handle: string, url: string): void {
    if (!handle) return;
    handleToAvatar[handle] = url;
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


