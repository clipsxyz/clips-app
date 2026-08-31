import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIVACY_STORAGE_KEY = 'user_privacy_settings';
const FOLLOW_REQUESTS_KEY = 'follow_requests';

export type NativeFollowRequest = {
    fromHandle: string;
    toHandle: string;
    timestamp: number;
    status: 'pending' | 'accepted' | 'denied';
};

export async function getPrivacySettingsNative(): Promise<Record<string, boolean>> {
    try {
        const raw = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
    } catch {
        return {};
    }
}

export async function savePrivacySettingsNative(settings: Record<string, boolean>): Promise<void> {
    try {
        await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // ignore
    }
}

export async function getFollowRequestsNative(): Promise<NativeFollowRequest[]> {
    try {
        const raw = await AsyncStorage.getItem(FOLLOW_REQUESTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as NativeFollowRequest[]) : [];
    } catch {
        return [];
    }
}

export async function saveFollowRequestsNative(requests: NativeFollowRequest[]): Promise<void> {
    try {
        await AsyncStorage.setItem(FOLLOW_REQUESTS_KEY, JSON.stringify(requests));
    } catch {
        // ignore
    }
}
