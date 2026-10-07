import { launchCamera, type CameraOptions, type ImagePickerResponse } from 'react-native-image-picker';

const VIDEO_DURATION_LIMIT_SEC = 60;

/** Bridge ints: never undefined/NaN, always a 32-bit integer (avoids ReadableMap getInt crashes). */
function nativeInt(value: unknown, fallback = 0): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback | 0;
    return Math.trunc(n) | 0;
}

export type NativeCameraCapture = 'photo' | 'video';

export type LaunchNativeCameraInput = {
    mediaType: NativeCameraCapture;
    quality?: number;
    saveToPhotos?: boolean;
    cameraType?: 'back' | 'front';
    durationLimitSec?: number;
};

/**
 * Build the exact map Android ImagePickerModule Options.java reads.
 * Do not pass `durationLimit: undefined` — spreading that over defaults drops the key
 * and native `getInt("durationLimit")` red-screens.
 */
export function buildNativeCameraOptions(input: LaunchNativeCameraInput): CameraOptions {
    const isVideo = input.mediaType === 'video';
    const durationLimit = isVideo
        ? nativeInt(input.durationLimitSec ?? VIDEO_DURATION_LIMIT_SEC, VIDEO_DURATION_LIMIT_SEC)
        : 0;

    return {
        mediaType: isVideo ? 'video' : 'photo',
        quality: Number(input.quality ?? (isVideo ? 0.8 : 0.9)),
        videoQuality: 'high',
        maxWidth: nativeInt(0),
        maxHeight: nativeInt(0),
        includeBase64: false,
        includeExtra: false,
        saveToPhotos: input.saveToPhotos !== false,
        cameraType: input.cameraType === 'front' ? 'front' : 'back',
        selectionLimit: nativeInt(1, 1),
        durationLimit,
    };
}

export function launchNativeCamera(
    input: LaunchNativeCameraInput,
    callback: (response: ImagePickerResponse) => void,
): Promise<ImagePickerResponse> {
    return launchCamera(buildNativeCameraOptions(input), callback);
}
