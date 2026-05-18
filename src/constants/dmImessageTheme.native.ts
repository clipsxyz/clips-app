import AsyncStorage from '@react-native-async-storage/async-storage';

export const DM_SENT_BLUE = '#0A84FF';
export const DM_SENT_GREEN = '#34C759';
export const DM_RECEIVED = '#3A3A3C';

const STORAGE_SENT_BUBBLE = 'gazetteer-dm-sent-bubble';

export type DmSentBubbleStyle = 'blue' | 'green';

export async function getDmSentBubblePreference(): Promise<DmSentBubbleStyle> {
    try {
        const v = await AsyncStorage.getItem(STORAGE_SENT_BUBBLE);
        return v === 'green' ? 'green' : 'blue';
    } catch {
        return 'blue';
    }
}

export async function setDmSentBubblePreference(style: DmSentBubbleStyle): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_SENT_BUBBLE, style);
    } catch {
        // ignore
    }
}

export function dmSentBubbleColor(style: DmSentBubbleStyle): string {
    return style === 'green' ? DM_SENT_GREEN : DM_SENT_BLUE;
}
