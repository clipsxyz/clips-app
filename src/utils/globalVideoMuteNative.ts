import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

/** In-process mute. Always starts muted; never rehydrate an unmuted value from disk. */
let sessionMuted = true;
let sessionBootstrapped = false;

function persistMuted(muted: boolean): void {
    void AsyncStorage.setItem(GLOBAL_VIDEO_MUTED_KEY, muted ? '1' : '0').catch(() => {
        /* ignore */
    });
}

let notifyQueued = false;
let pendingNotifyMuted = sessionMuted;

function notify(muted: boolean): void {
    pendingNotifyMuted = muted;
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => {
        notifyQueued = false;
        const next = pendingNotifyMuted;
        listeners.forEach((fn) => fn(next));
    });
}

/**
 * Cold start / Metro refresh: force muted before any feed, story, or notification video.
 * Ignores a previously saved unmuted value. No-ops after the first call this process.
 */
export function resetGlobalVideoMutedForNewSession(): void {
    if (sessionBootstrapped) return;
    sessionBootstrapped = true;
    sessionMuted = true;
    persistMuted(true);
    notify(true);
}

export function getGlobalVideoMutedNativeSync(): boolean {
    resetGlobalVideoMutedForNewSession();
    return sessionMuted;
}

export async function getGlobalVideoMutedNative(): Promise<boolean> {
    return getGlobalVideoMutedNativeSync();
}

export async function setGlobalVideoMutedNative(muted: boolean): Promise<void> {
    sessionBootstrapped = true;
    sessionMuted = muted;
    persistMuted(muted);
    notify(muted);
}

export function subscribeGlobalVideoMuted(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
