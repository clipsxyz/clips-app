import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import { normalizeNativeUploadUri } from '../utils/uploadFileNative';

function looksLikeVideoUri(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function resolveThumbUri(raw?: string | null): string | undefined {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return undefined;
    const local = normalizeNativeUploadUri(trimmed);
    const resolved = resolvePublicMediaUrl(local) || local;
    return resolved || undefined;
}

type Props = {
    size: number;
    uri?: string | null;
    type: 'image' | 'video' | 'text';
    posterUrl?: string | null;
    thumbnailUrl?: string | null;
    thumbnail_url?: string | null;
    /** When true, video slides without a JPEG use a paused first frame. */
    allowPausedVideo?: boolean;
};

/**
 * One still per carousel tile. Pixel size (not %) so ColorOS paints every cell.
 * Prefer JPEG poster; images use their own URL; leftover videos can use a paused frame.
 */
export default function CarouselSlideThumb({
    size,
    uri,
    type,
    posterUrl,
    thumbnailUrl,
    thumbnail_url,
    allowPausedVideo = false,
}: Props) {
    const radius = Math.max(8, Math.round(size * 0.14));
    const box = { width: size, height: size, borderRadius: radius };
    const poster = [posterUrl, thumbnailUrl, thumbnail_url]
        .map((value) => resolveThumbUri(value))
        .find((value) => value && !looksLikeVideoUri(value));
    const media = resolveThumbUri(uri);
    const stillUri =
        poster ||
        (type !== 'video' && media && !looksLikeVideoUri(media) ? media : undefined) ||
        (type === 'image' && media ? media : undefined);

    let inner: React.ReactNode = <View style={[box, styles.fallback]} />;

    if (stillUri) {
        inner = (
            <Image
                source={{ uri: stillUri }}
                style={box}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                progressiveRenderingEnabled={false}
                fadeDuration={0}
            />
        );
    } else if (allowPausedVideo && type === 'video' && isPlayableVideoUri(media)) {
        inner = (
            <Video
                source={{ uri: media }}
                style={box}
                paused
                muted
                repeat={false}
                controls={false}
                resizeMode="cover"
                pointerEvents="none"
                {...androidListSafeVideoProps()}
            />
        );
    }

    return (
        <View style={[box, styles.host]} collapsable={false} pointerEvents="none">
            {inner}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        backgroundColor: '#111827',
        overflow: 'hidden',
    },
    fallback: {
        backgroundColor: '#1F2937',
    },
});
