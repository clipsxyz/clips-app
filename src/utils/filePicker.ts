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
            return ['tiktok', 'tt_', 'tt-', 'tt ', 'tiktok_', 'tiktok-', 'tiktok ', 'musical', 'snapchat', 'saved', 'download', 'video', 'vid', 'mp4', 'mov', 'm4v'];
        case 'instagram':
            return ['instagram', 'reel', 'ig_', 'ig-', 'insta', 'ig ', 'instagram_', 'instagram-', 'instagram ', 'saved', 'download', 'video', 'vid', 'mp4', 'mov', 'm4v'];
        case 'youtube-shorts':
            return ['youtube', 'shorts', 'yt_', 'yt-', 'yt ', 'youtube_', 'youtube-', 'youtube ', 'saved', 'download', 'video', 'vid', 'mp4', 'mov', 'm4v'];
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
 * Note: Platform detection is not reliable from metadata, so we allow all videos/images
 * The platform parameter is mainly for template selection, not strict file filtering
 */
export function filterFilesByPlatform(files: File[], platform: PlatformType): File[] {
    // Try to prioritize platform-specific files if found
    const matched = files.filter(file => matchesPlatform(file.name, platform));
    if (matched.length > 0) {
        return matched;
    }
    // Otherwise, allow all video and image files (since we can't reliably detect platform)
    return files.filter(file => {
        const type = file.type || '';
        return type.startsWith('video/') || type.startsWith('image/');
    });
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

        // Filter by filename patterns (more lenient - allows all if no matches)
        const patterns = getFilenamePatterns(platform);
        const matched = videos.filter((v: any) => {
            // Check filename, path, or uri for platform patterns
            const filename = (v.filename || v.path || v.uri || '').toLowerCase();
            return patterns.some(pattern => filename.includes(pattern.toLowerCase()));
        });

        // If we found platform-specific files, return those; otherwise return all videos
        return matched.length > 0 ? matched : videos;
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

