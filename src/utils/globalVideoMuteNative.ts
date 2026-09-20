import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

/** In-memory cache so mute toggles don't wait on AsyncStorage. */
let cachedMuted: boolean | null = null;

export function getCachedGlobalVideoMutedNative(): boolean {
    // Default unmuted (matches getGlobalVideoMutedNative).
    return cachedMuted ?? false;
}

export async function getGlobalVideoMutedNative(): Promise<boolean> {
    if (cachedMuted != null) return cachedMuted;
    try {
        const raw = await AsyncStorage.getItem(GLOBAL_VIDEO_MUTED_KEY);
        if (raw === '0') {
            cachedMuted = false;
            return false;
        }
        if (raw === '1') {
            cachedMuted = true;
            return true;
        }
    } catch {
        /* ignore */
    }
    // Default unmuted so mock/demo clips with audio are audible; tap mute to silence.
    cachedMuted = false;
    return false;
}

export async function setGlobalVideoMutedNative(muted: boolean): Promise<void> {
    cachedMuted = muted;
    // Defer so a mute toggle during ScenesViewer render cannot setState on FeedScreen.
    queueMicrotask(() => {
        listeners.forEach((fn) => fn(muted));
    });
    try {
        await AsyncStorage.setItem(GLOBAL_VIDEO_MUTED_KEY, muted ? '1' : '0');
    } catch {
        /* ignore */
    }
}

export function subscribeGlobalVideoMuted(listener: Listener): () => void {
    listeners.add(listener);
    listener(getCachedGlobalVideoMutedNative());
    return () => listeners.delete(listener);
}
