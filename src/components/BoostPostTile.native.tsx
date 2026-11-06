import React, { useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import type { Post, PostMediaItem } from '../types';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import {
    FEED_CARD_MEDIA_BG,
    FEED_CARD_RADIUS,
    FEED_CARD_SHELL_BORDER_COLOR,
    FEED_CARD_SHELL_BORDER_WIDTH,
} from './FeedPageLayout.native';
import { RATIO_PORTRAIT_9_16 } from '../utils/mediaAspectRatio';
import { isVideoMediaUri, resolvePostPlaybackUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import {
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';

/** Vertical 9:16 frame (width / height) so a portrait clip fills the tile. */
export const BOOST_POST_TILE_ASPECT_RATIO = RATIO_PORTRAIT_9_16;

type SlideStill = PostMediaItem & {
    poster_url?: string;
    media_url?: string;
};

function firstStill(...vals: unknown[]): string | undefined {
    for (const value of vals) {
        if (typeof value !== 'string') continue;
        const uri = value.trim();
        if (!uri || isVideoMediaUri(uri)) continue;
        return uri;
    }
    return undefined;
}

/** Still image for the tile. Never an MP4 — Android Image cannot decode video. */
export function boostTileImageUri(post: Post): string | undefined {
    const extra = post as Post & {
        thumbnail_url?: string;
        poster_url?: string;
        posterUrl?: string;
        media_url?: string;
        image_url?: string;
    };
    const slide = (post.mediaItems || []).find(
        (item) => item && (item.type === 'image' || item.type === 'video'),
    ) as SlideStill | undefined;

    const still = firstStill(
        extra.thumbnail_url,
        post.thumbnailUrl,
        slide?.thumbnail_url,
        slide?.thumbnailUrl,
        extra.poster_url,
        extra.posterUrl,
        slide?.poster_url,
        slide?.posterUrl,
        post.videoPosterUrl,
        slide?.type === 'image' ? slide.url : undefined,
        extra.image_url,
        extra.media_url,
        post.mediaUrl,
        slide?.media_url,
        slide?.type === 'video' ? undefined : slide?.url,
    );
    if (!still) return undefined;
    return resolvePublicMediaUrl(still) || still;
}

const frameCache = new Map<string, string>();

function imageUriFromThumbnailPath(path: string): string {
    if (path.startsWith('file://') || path.startsWith('content://') || /^https?:/i.test(path)) {
        return path;
    }
    return `file://${path}`;
}

/** JPEG frame from the video when the post has no stored poster. */
async function frameFromVideo(videoUri: string): Promise<string | undefined> {
    const cached = frameCache.get(videoUri);
    if (cached) return cached;
    const mod = await import('react-native-compressor');
    const createVideoThumbnail = mod.createVideoThumbnail;
    if (typeof createVideoThumbnail !== 'function') return undefined;
    const result = await createVideoThumbnail(videoUri, { quality: 0.6 });
    const path = typeof result?.path === 'string' ? result.path.trim() : '';
    if (!path) return undefined;
    const uri = imageUriFromThumbnailPath(path);
    frameCache.set(videoUri, uri);
    return uri;
}

function boostTileVideoUri(post: Post): string | undefined {
    const slide = (post.mediaItems || []).find(
        (item) => item?.type === 'video' || isVideoMediaUri(item?.url),
    );
    const raw = resolvePostPlaybackUri(post, slide) || resolvePostPlaybackUri(post);
    if (!raw) return undefined;
    const looksLikeVideo = isVideoMediaUri(raw) || post.mediaType === 'video' || slide?.type === 'video';
    if (!looksLikeVideo) return undefined;
    return resolvePublicMediaUrl(raw) || raw;
}

type Props = {
    post: Post;
    /** Tile width. Height follows {@link BOOST_POST_TILE_ASPECT_RATIO}. */
    width: number;
    showBoostIcon?: boolean;
    onPress: () => void;
};

export default function BoostPostTile({ post, width, showBoostIcon = true, onPress }: Props) {
    const textOnly = isTextOnlyPost(post);
    const storedStill = boostTileImageUri(post);
    const videoUri = textOnly ? undefined : boostTileVideoUri(post);
    const guessedStill = siblingJpegFromVideoUrl(videoUri);
    const isVideo = isVideoPost(post);
    const tileHeight = Math.max(1, Math.round(width / BOOST_POST_TILE_ASPECT_RATIO));
    const [stillFailed, setStillFailed] = useState(false);
    const [guessFailed, setGuessFailed] = useState(false);
    const [frameFailed, setFrameFailed] = useState(false);
    const [frameUri, setFrameUri] = useState<string | undefined>(() =>
        videoUri ? frameCache.get(videoUri) : undefined,
    );

    useEffect(() => {
        setStillFailed(false);
        setGuessFailed(false);
        setFrameFailed(false);
        setFrameUri(videoUri ? frameCache.get(videoUri) : undefined);
    }, [storedStill, videoUri]);

    const needsFrame = !textOnly
        && Boolean(videoUri)
        && !frameUri
        && !frameFailed
        && (!storedStill || stillFailed);
    useEffect(() => {
        if (!needsFrame || !videoUri) return;
        let cancelled = false;
        frameFromVideo(videoUri)
            .then((uri) => {
                if (cancelled) return;
                if (uri) setFrameUri(uri);
                else setFrameFailed(true);
            })
            .catch(() => {
                if (!cancelled) setFrameFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [needsFrame, videoUri]);

    const pictureUri = !stillFailed && storedStill
        ? storedStill
        : frameUri
            ? frameUri
            : frameFailed && !guessFailed && guessedStill
                ? guessedStill
                : undefined;

    const displayText = useMemo(() => {
        const raw = post.text || post.caption || '';
        return raw.length > 120 ? `${raw.substring(0, 120)}...` : raw;
    }, [post.text, post.caption]);

    return (
        <Pressable
            onPress={onPress}
            style={[styles.tile, { width, height: tileHeight }]}
            accessibilityRole="button"
            accessibilityLabel="Boost this post"
        >
            {textOnly ? (
                <View
                    style={[
                        styles.mediaFrame,
                        { backgroundColor: getTextOnlyBackgroundColor(post) },
                    ]}
                >
                    <Text
                        style={[styles.tileText, { color: getTextOnlyTextColor(post) }]}
                        numberOfLines={8}
                    >
                        {displayText}
                    </Text>
                </View>
            ) : pictureUri ? (
                <View style={styles.mediaFrame} pointerEvents="none">
                    <Image
                        source={{ uri: pictureUri }}
                        style={{ width, height: tileHeight }}
                        resizeMode="cover"
                        onError={() => {
                            if (pictureUri === storedStill) setStillFailed(true);
                            else if (pictureUri === guessedStill) setGuessFailed(true);
                        }}
                    />
                </View>
            ) : (
                <View style={[styles.mediaFrame, styles.placeholder]}>
                    {displayText ? (
                        <Text style={styles.placeholderText} numberOfLines={6}>
                            {displayText}
                        </Text>
                    ) : (
                        <Icon name="image-outline" size={28} color="#6B7280" />
                    )}
                </View>
            )}

            {isVideo && !textOnly ? (
                <View style={styles.playBadge} pointerEvents="none">
                    <Icon name="play" size={14} color="#FFFFFF" />
                </View>
            ) : null}

            {showBoostIcon ? (
                <View style={styles.flameWrap} pointerEvents="none">
                    <LinearGradient
                        colors={['#f6e27a', '#d4af37', '#f4f4f4', '#bfc5cc', '#ffe8a3']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.flameCircle}
                    >
                        <Icon name="flame" size={20} color="#111111" />
                    </LinearGradient>
                </View>
            ) : null}
        </Pressable>
    );
}

export function boostTileSize(cols = 3, gap = 8, horizontalPadding = 16): number {
    const screenWidth = Dimensions.get('window').width;
    return Math.floor(
        (screenWidth - horizontalPadding * 2 - gap * (cols - 1)) / cols,
    );
}

const styles = StyleSheet.create({
    tile: {
        borderRadius: FEED_CARD_RADIUS,
        overflow: 'hidden',
        backgroundColor: FEED_CARD_MEDIA_BG,
        borderWidth: FEED_CARD_SHELL_BORDER_WIDTH,
        borderColor: FEED_CARD_SHELL_BORDER_COLOR,
    },
    mediaFrame: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    media: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1f2937',
        padding: 8,
    },
    placeholderText: {
        color: '#E5E7EB',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
        textAlign: 'center',
    },
    tileText: {
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
        padding: 10,
    },
    playBadge: {
        position: 'absolute',
        right: 6,
        bottom: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        padding: 4,
    },
    flameWrap: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    flameCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#d4af37',
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
});
