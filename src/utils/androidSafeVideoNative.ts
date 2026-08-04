import { Platform } from 'react-native';
import { ViewType } from 'react-native-video';

/** Non-empty URI only — empty sources crash ExoPlayer surface attach on Android. */
export function isPlayableVideoUri(uri: string | null | undefined): uri is string {
    return typeof uri === 'string' && uri.trim().length > 0;
}

/** Surface/Texture views with 0×0 frames trigger display-list NPEs on Android. */
export function hasValidVideoFrame(width: number, height: number): boolean {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/**
 * Prefer TextureView in scrollable feeds. Default SurfaceView does not participate in the
 * normal view hierarchy and races with FlatList recycling → ViewGroup.dispatchGetDisplayList NPE.
 */
export function androidListSafeVideoProps() {
    if (Platform.OS !== 'android') return {};
    return {
        viewType: ViewType.TEXTURE,
        disableFocus: true as const,
        playInBackground: false as const,
        playWhenInactive: false as const,
    };
}
