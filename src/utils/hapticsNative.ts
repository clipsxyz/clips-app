import { Platform, Vibration } from 'react-native';

/**
 * Android requires `android.permission.VIBRATE` in the manifest (and an APK rebuild).
 * Without it, `Vibration.vibrate` crashes the app on some devices — never call it on Android
 * until the permission is present in the installed build.
 */
function vibrateOnAndroid(ms: number): void {
    // Intentionally no-op on Android (see manifest + rebuild note above).
    void ms;
}

/** Light success feedback after post / save actions. */
export function hapticSuccess(): void {
    try {
        if (Platform.OS === 'android') {
            vibrateOnAndroid(28);
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
            vibrateOnAndroid(12);
            return;
        }
        Vibration.vibrate(5);
    } catch {
        // ignore
    }
}
