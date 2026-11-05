import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

/** In-process mute. Starts muted until the saved playback setting is read. */
let sessionMuted = true;
let userChoseMute = false;
let hydratePromise: Promise<void> | null = null;

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
 * First read this process uses the saved playback setting. Missing value stays muted.
 * A toggle made before the read finishes is kept.
 */
function hydrateMutedFromStorage(): Promise<void> {
    if (!hydratePromise) {
        hydratePromise = (async () => {
            try {
                const raw = await AsyncStorage.getItem(GLOBAL_VIDEO_MUTED_KEY);
                if (userChoseMute) return;
                if (raw === '0') sessionMuted = false;
                else if (raw === '1') sessionMuted = true;
            } catch {
                /* keep the muted default */
            }
        })();
    }
    return hydratePromise;
}

/** Start this process with the saved mute setting. Missing value stays muted. */
export function resetGlobalVideoMutedForNewSession(): void {
    void hydrateMutedFromStorage().then(() => {
        notify(sessionMuted);
    });
}

export function getGlobalVideoMutedNativeSync(): boolean {
    return sessionMuted;
}

export async function getGlobalVideoMutedNative(): Promise<boolean> {
    await hydrateMutedFromStorage();
    return sessionMuted;
}

export async function setGlobalVideoMutedNative(muted: boolean): Promise<void> {
    userChoseMute = true;
    sessionMuted = muted;
    persistMuted(muted);
    notify(muted);
}

export function subscribeGlobalVideoMuted(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
