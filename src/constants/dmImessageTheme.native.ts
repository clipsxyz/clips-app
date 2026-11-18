import AsyncStorage from '@react-native-async-storage/async-storage';

/** Instagram-style received bubble (charcoal). */
export const DM_RECEIVED = '#262626';

/** Sea glass is the camera-border spectrum. Brass stays the warm metal. */
export const DM_SENT_PASSPORT = '#22C55E';
export const DM_SENT_BRASS = '#c4a574';

export const DM_SENT_PASSPORT_GRADIENT = ['#22C55E', '#FFD400', '#FF4D9A'] as const;
export const DM_SENT_BRASS_GRADIENT = ['#3a2e1c', '#8a7348', '#c4a574'] as const;

/** @deprecated use DM_SENT_PASSPORT — kept for call sites during rename. */
export const DM_SENT_BLUE = DM_SENT_PASSPORT;
/** @deprecated use DM_SENT_BRASS */
export const DM_SENT_GREEN = DM_SENT_BRASS;

const STORAGE_SENT_BUBBLE = 'gazetteer-dm-sent-bubble';

/** `blue` = passport teal, `green` = passport brass (storage keys kept for prefs). */
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
    return style === 'green' ? DM_SENT_BRASS : DM_SENT_PASSPORT;
}

export function dmSentBubbleGradient(style: DmSentBubbleStyle): readonly string[] {
    return style === 'green' ? DM_SENT_BRASS_GRADIENT : DM_SENT_PASSPORT_GRADIENT;
}
