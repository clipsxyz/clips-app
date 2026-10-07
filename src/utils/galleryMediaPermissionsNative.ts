import { PermissionsAndroid, Platform } from 'react-native';

/** Request read access for gallery pickers (Android 13+ split permissions). */
export async function ensureGalleryMediaPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
        const apiLevel =
            typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

        if (apiLevel >= 33) {
            const results = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            ]);
            const images =
                results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
                PermissionsAndroid.RESULTS.GRANTED;
            const videos =
                results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
                PermissionsAndroid.RESULTS.GRANTED;
            if (images || videos) return true;
        } else {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                {
                    title: 'Gallery access',
                    message: 'Gazetteer needs access to your photos and videos so you can upload posts.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Not now',
                },
            );
            if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
        }

        return false;
    } catch (error) {
        console.warn('ensureGalleryMediaPermission failed:', error);
        return false;
    }
}

/** Request camera access for Take Photo / launchCamera. */
export async function ensureCameraPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: 'Camera access',
            message: 'Gazetteer needs the camera so you can take photos and videos for posts.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
        });
        return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
        console.warn('ensureCameraPermission failed:', error);
        return false;
    }
}

/** Needed to record video with sound (and many OEM cameras refuse video without it). */
export async function ensureMicrophonePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
            title: 'Microphone access',
            message: 'Gazetteer needs the microphone to record video for posts.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
        });
        return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
        console.warn('ensureMicrophonePermission failed:', error);
        return false;
    }
}

export async function ensureCameraCapturePermission(kind: 'photo' | 'video'): Promise<boolean> {
    const cameraOk = await ensureCameraPermission();
    if (!cameraOk) return false;
    if (kind !== 'video') return true;
    return ensureMicrophonePermission();
}
