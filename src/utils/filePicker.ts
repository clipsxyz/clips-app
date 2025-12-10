/**
 * Platform-specific file picker with filename filtering
 * Supports both web and React Native
 */

import { isWeb } from './platform';

export type PlatformType = 'tiktok' | 'instagram' | 'youtube-shorts';

/**
 * Get filename patterns for each platform
 */
function getFilenamePatterns(platform: PlatformType): string[] {
    switch (platform) {
        case 'tiktok':
            return ['tiktok', 'tt_', 'tt-'];
        case 'instagram':
            return ['instagram', 'reel', 'ig_', 'ig-', 'insta'];
        case 'youtube-shorts':
            return ['youtube', 'shorts', 'yt_', 'yt-', 'yt '];
        default:
            return [];
    }
}

/**
 * Check if a filename matches the platform patterns
 */
export function matchesPlatform(filename: string, platform: PlatformType): boolean {
    const patterns = getFilenamePatterns(platform);
    const lowerFilename = filename.toLowerCase();
    return patterns.some(pattern => lowerFilename.includes(pattern.toLowerCase()));
}

/**
 * Filter files by platform (web version - filters after selection)
 */
export function filterFilesByPlatform(files: File[], platform: PlatformType): File[] {
    return files.filter(file => matchesPlatform(file.name, platform));
}

/**
 * Web: Open file picker and filter by platform
 */
export async function pickFilesWeb(platform: PlatformType): Promise<File[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.multiple = true;
        
        input.onchange = (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            const filtered = filterFilesByPlatform(files, platform);
            resolve(filtered);
        };
        
        input.click();
    });
}

/**
 * React Native: Pick files using react-native-image-crop-picker
 * Works on both iOS and Android
 */
export async function pickFilesNative(platform: PlatformType): Promise<any[]> {
    if (isWeb()) {
        // Fallback to web implementation
        return pickFilesWeb(platform);
    }

    try {
        // Import react-native-image-crop-picker
        const ImagePicker = require('react-native-image-crop-picker');
        
        // Open picker for videos
        const videos = await ImagePicker.openPicker({
            mediaType: 'video',
            multiple: true,
        });

        // Filter by filename patterns
        const patterns = getFilenamePatterns(platform);
        const filtered = videos.filter((v: any) => {
            // Check filename, path, or uri for platform patterns
            const filename = (v.filename || v.path || v.uri || '').toLowerCase();
            return patterns.some(pattern => filename.includes(pattern.toLowerCase()));
        });

        return filtered;
    } catch (error: any) {
        console.error('Error picking files on native:', error);
        // If user cancelled, return empty array
        if (error?.message?.includes('cancel') || error?.code === 'E_PICKER_CANCELLED') {
            return [];
        }
        // For other errors, return empty array
        return [];
    }
}

/**
 * Unified file picker that works on both web and native
 */
export async function pickFiles(platform: PlatformType): Promise<File[] | any[]> {
    if (isWeb()) {
        return pickFilesWeb(platform);
    } else {
        return pickFilesNative(platform);
    }
}

