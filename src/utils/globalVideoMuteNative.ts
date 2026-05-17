import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_VIDEO_MUTED_KEY = 'clips:globalVideoMuted';

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

export async function getGlobalVideoMutedNative(): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(GLOBAL_VIDEO_MUTED_KEY);
        if (raw === '0') return false;
        if (raw === '1') return true;
    } catch {
        /* ignore */
    }
    return true;
}

export async function setGlobalVideoMutedNative(muted: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(GLOBAL_VIDEO_MUTED_KEY, muted ? '1' : '0');
    } catch {
        /* ignore */
    }
    listeners.forEach((fn) => fn(muted));
}

export function subscribeGlobalVideoMuted(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
