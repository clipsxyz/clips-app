import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import { extractVideoPosterFrame } from '../utils/extractVideoPosterNative';
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

const extractedPosterByVideo = new Map<string, string>();

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
 * TextureView on ColorOS paints the feed video into the thumbnail.
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
    const [stillFailed, setStillFailed] = useState(false);
    const [extractedPoster, setExtractedPoster] = useState<string | undefined>(() =>
        media ? extractedPosterByVideo.get(media) : undefined,
    );
    useEffect(() => {
        setStillFailed(false);
    }, [stillUri, recoverToken]);

    const needsExtractedPoster =
        !allowPausedVideo &&
        type === 'video' &&
        !!media &&
        (!stillUri || stillFailed) &&
        !extractedPoster;

    useEffect(() => {
        if (!needsExtractedPoster || !media) return;
        const cached = extractedPosterByVideo.get(media);
        if (cached) {
            setExtractedPoster(cached);
            return;
        }
        let cancelled = false;
        extractVideoPosterFrame(media, 0.2)
            .then((fileUri) => {
                extractedPosterByVideo.set(media, fileUri);
                if (!cancelled) setExtractedPoster(fileUri);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [media, needsExtractedPoster]);

    const pictureUri = stillUri && !stillFailed ? stillUri : extractedPoster;

    let inner: React.ReactNode = <View style={[box, styles.fallback]} />;

    if (pictureUri) {
        inner = (
            <Image
                key={`${pictureUri}-${recoverToken}`}
                source={{ uri: pictureUri }}
                style={box}
                resizeMode="cover"
                resizeMethod={Platform.OS === 'android' ? 'resize' : undefined}
                progressiveRenderingEnabled={false}
                fadeDuration={0}
                onError={() => {
                    if (pictureUri === stillUri) setStillFailed(true);
                }}
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
