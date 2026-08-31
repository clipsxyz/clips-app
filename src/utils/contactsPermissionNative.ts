import { PermissionsAndroid, Platform } from 'react-native';

export type ContactsPermissionResult = {
    granted: boolean;
    neverAskAgain: boolean;
};

function isAndroidGranted(result: string): boolean {
    const value = String(result || '').toLowerCase();
    return value === 'granted' || value === 'authorized' || value === 'true';
}

/**
 * Android: READ_CONTACTS is a dangerous permission — react-native-contacts
 * checkPermission() is iOS-only, so we must use PermissionsAndroid here.
 *
 * Do not pass a rationale object: that extra dialog stacked on a React Native
 * Modal never returns a result on ColorOS / many Android OEMs.
 */
export async function ensureContactsPermission(): Promise<ContactsPermissionResult> {
    if (Platform.OS !== 'android') {
        return { granted: true, neverAskAgain: false };
    }

    try {
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
        if (already) {
            return { granted: true, neverAskAgain: false };
        }

        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
        return {
            granted: isAndroidGranted(String(result)),
            neverAskAgain: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        };
    } catch (error) {
        console.warn('ensureContactsPermission failed:', error);
        return { granted: false, neverAskAgain: false };
    }
}
