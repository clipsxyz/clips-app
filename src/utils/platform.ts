/**
 * Platform detection utility that works for both web and React Native
 * Avoids importing react-native on web to prevent Vite errors
 */

export type PlatformOS = 'web' | 'ios' | 'android';

let cachedPlatform: PlatformOS | null = null;

export function getPlatform(): PlatformOS {
    if (cachedPlatform) {
        return cachedPlatform;
    }

    // Check if we're in a browser (web)
    // This is the primary check - if window and document exist, we're on web
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        cachedPlatform = 'web';
        return cachedPlatform;
    }

    // If we're not in a browser, we're on native (iOS/Android)
    // Only try to import react-native when we're sure we're not on web
    try {
        // Dynamic import to avoid bundling react-native on web
        const reactNative = require('react-native');
        if (reactNative?.Platform?.OS) {
            const os = reactNative.Platform.OS;
            cachedPlatform = (os === 'ios' || os === 'android') ? os as PlatformOS : 'web';
            return cachedPlatform;
        }
    } catch (e) {
        // react-native not available, default to web
    }

    // Default to web if we can't determine
    cachedPlatform = 'web';
    return cachedPlatform;
}

export function isWeb(): boolean {
    return getPlatform() === 'web';
}

export function isNative(): boolean {
    const platform = getPlatform();
    return platform === 'ios' || platform === 'android';
}

