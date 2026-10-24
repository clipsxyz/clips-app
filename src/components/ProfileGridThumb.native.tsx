import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import {
    getPostBodyText,
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { resolvePostThumbnail } from '../api/collections';
import { mediaItemsEqual } from '../utils/feedPostCompareNative';
import { formatViewCount } from '../utils/feedPostNewsTicker';
import CachedImage from './CachedImage.native';
import {
    FEED_GRID_TILE_BG,
    FEED_GRID_TILE_BORDER_COLOR,
    FEED_GRID_TILE_BORDER_WIDTH,
    FEED_GRID_TILE_RADIUS,
} from './FeedPageLayout.native';

type Props = {
    post: Post;
};

function looksLikeVideoUri(url: string): boolean {
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function resolveGridImageUri(post: Post): string | undefined {
    const extra = post as Post & {
        thumbnail_url?: string;
        thumbnailUrl?: string;
        poster_url?: string;
        posterUrl?: string;
        media_url?: string;
    };
    const item = (post.mediaItems || []).find(
        (entry) => entry?.type === 'image' || entry?.type === 'video',
    );
    const candidates = [
        extra.thumbnail_url,
        extra.thumbnailUrl,
        extra.poster_url,
        extra.posterUrl,
        post.videoPosterUrl,
        item?.thumbnail_url,
        item?.thumbnailUrl,
        (item as { poster_url?: string } | undefined)?.poster_url,
        item?.posterUrl,
        resolvePostThumbnail(post),
        extra.media_url,
        post.mediaUrl,
        item?.url,
    ];
    for (const raw of candidates) {
        if (typeof raw !== 'string') continue;
        const uri = raw.trim();
        if (!uri || looksLikeVideoUri(uri)) continue;
        return uri;
    }
    return undefined;
}

function getPostViewCount(post: Post): number {
    const extra = post as Post & { views_count?: number; views?: number };
    return Math.max(0, Number(extra.views_count ?? post.stats?.views ?? extra.views ?? 0) || 0);
}

function ViewsBadge({ post }: { post: Post }) {
    return (
        <View style={styles.viewsBadge} pointerEvents="none">
            <Icon name="eye-outline" size={12} color="#FFFFFF" />
            <Text style={styles.viewsText}>{formatViewCount(getPostViewCount(post))}</Text>
        </View>
    );
}

function ProfileGridThumb({ post }: Props) {
    const bodyText = getPostBodyText(post);
    const imageUri = resolveGridImageUri(post);
    const videoPost = isVideoPost(post);

    if (imageUri) {
        return (
            <View style={styles.cell}>
                <CachedImage
                    source={{ uri: imageUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    pointerEvents="none"
                />
                <ViewsBadge post={post} />
            </View>
        );
    }

    // Never mount react-native-video in a grid cell. Playback lives in the post viewer.
    if (videoPost) {
        return (
            <View style={[styles.cell, styles.placeholder]}>
                <Icon name="play-outline" size={22} color="#FFFFFF" />
                <ViewsBadge post={post} />
            </View>
        );
    }

    if (isTextOnlyPost(post) || bodyText) {
        return (
            <View style={[styles.cell, { backgroundColor: getTextOnlyBackgroundColor(post) }]}>
                <Text
                    style={[styles.textThumb, { color: getTextOnlyTextColor(post) }]}
                    numberOfLines={4}
                >
                    {bodyText || 'Post'}
                </Text>
                <ViewsBadge post={post} />
            </View>
        );
    }

    return (
        <View style={[styles.cell, styles.placeholder]}>
            {bodyText ? (
                <Text style={[styles.textThumb, { color: '#E5E7EB' }]} numberOfLines={4}>
                    {bodyText}
                </Text>
            ) : (
                <Icon name="image-outline" size={22} color="#6B7280" />
            )}
            <ViewsBadge post={post} />
        </View>
    );
}

function profileGridThumbsEqual(prev: Props, next: Props): boolean {
    const a = prev.post;
    const b = next.post;
    return (
        a.id === b.id &&
        a.mediaUrl === b.mediaUrl &&
        a.mediaType === b.mediaType &&
        a.videoPosterUrl === b.videoPosterUrl &&
        a.thumbnailUrl === b.thumbnailUrl &&
        a.stats?.views === b.stats?.views &&
        a.views_count === b.views_count &&
        a.text === b.text &&
        a.caption === b.caption &&
        mediaItemsEqual(a.mediaItems, b.mediaItems)
    );
}

export default React.memo(ProfileGridThumb, profileGridThumbsEqual);

const styles = StyleSheet.create({
    cell: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: FEED_GRID_TILE_BG,
        overflow: 'hidden',
        borderRadius: FEED_GRID_TILE_RADIUS,
        position: 'relative',
        borderWidth: FEED_GRID_TILE_BORDER_WIDTH,
        borderColor: FEED_GRID_TILE_BORDER_COLOR,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textThumb: {
        fontSize: 10,
        fontWeight: '600',
        padding: 6,
        lineHeight: 13,
    },
    viewsBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 2,
    },
    viewsText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
