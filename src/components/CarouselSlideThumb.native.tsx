import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import { isVideoMediaUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import { normalizeNativeUploadUri } from '../utils/uploadFileNative';

function resolveThumbUri(raw?: string | null): string | undefined {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return undefined;
    const local = normalizeNativeUploadUri(trimmed);
    const resolved = resolvePublicMediaUrl(local) || local;
    return resolved || undefined;
}

function asStillUri(raw?: string | null): string | undefined {
    const uri = resolveThumbUri(raw);
    if (!uri || isVideoMediaUri(uri) || /^data:video\//i.test(uri)) return undefined;
    return uri;
}

type Props = {
    size: number;
    uri?: string | null;
    type: 'image' | 'video' | 'text';
    posterUrl?: string | null;
    thumbnailUrl?: string | null;
    thumbnail_url?: string | null;
    /** Bump after the main player swaps so ColorOS redraws the JPEG. */
    recoverToken?: number;
    /** Composer / gallery only. Feed thumbs must stay stills. */
    allowPausedVideo?: boolean;
};

/**
 * One JPEG per carousel tile. Never decode the playing MP4 here — a second
 * TextureView on ColorOS blanks the strip or paints the feed video into it.
 */
export default function CarouselSlideThumb({
    size,
    uri,
    type,
    posterUrl,
    thumbnailUrl,
    thumbnail_url,
    recoverToken = 0,
    allowPausedVideo = false,
}: Props) {
    const radius = Math.max(8, Math.round(size * 0.14));
    const box = { width: size, height: size, borderRadius: radius };
    const media = resolveThumbUri(uri);
    const stillUri =
        asStillUri(posterUrl) ||
        asStillUri(thumbnailUrl) ||
        asStillUri(thumbnail_url) ||
        (type !== 'video' ? asStillUri(media) : undefined) ||
        (type === 'image' ? asStillUri(media) : undefined) ||
        (type === 'video' ? asStillUri(siblingJpegFromVideoUrl(media)) : undefined);

    let inner: React.ReactNode = <View style={[box, styles.fallback]} />;

    if (stillUri) {
        inner = (
            <Image
                key={`${stillUri}-${recoverToken}`}
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
