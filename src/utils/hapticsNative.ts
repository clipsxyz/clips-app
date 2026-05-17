import { Platform, Vibration } from 'react-native';

/** Light success feedback after post / save actions. */
export function hapticSuccess(): void {
    try {
        if (Platform.OS === 'android') {
            Vibration.vibrate(28);
            return;
        }
        Vibration.vibrate(10);
    } catch {
        // ignore — haptics are optional
    }
}

export function hapticLight(): void {
    try {
        if (Platform.OS === 'android') {
            Vibration.vibrate(12);
            return;
        }
        Vibration.vibrate(5);
    } catch {
        // ignore
    }
}
