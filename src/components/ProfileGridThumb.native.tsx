import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
import {
    MOCK_FEED_BUNDLED_VIDEO_POSTER,
    resolveDemoVideoPosterSource,
} from '../constants/mockFeedVideos';

type Props = {
    post: Post;
};

function getPostLocationLabel(post: Post): string | undefined {
    const label = post.locationLabel || post.venue;
    const trimmed = typeof label === 'string' ? label.trim() : '';
    return trimmed.length > 0 ? trimmed : undefined;
}

function resolveVideoUrl(post: Post): string | undefined {
    const firstVideo = Array.isArray(post.mediaItems)
        ? post.mediaItems.find((item) => item?.type === 'video' && item.url)
        : undefined;
    return firstVideo?.url || post.mediaUrl || undefined;
}

export default function ProfileGridThumb({ post }: Props) {
    const locationLabel = getPostLocationLabel(post);
    const locationBadge = locationLabel ? (
        <View style={styles.locationBadge} pointerEvents="none">
            <Icon name="location-outline" size={10} color="#FFFFFF" />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
                {locationLabel}
            </Text>
        </View>
    ) : null;

    const videoOverlays = (
        <>
            <View style={styles.playCenter} pointerEvents="none">
                <View style={styles.playCircle}>
                    <Icon name="play" size={22} color="#FFFFFF" style={styles.playIconOffset} />
                </View>
            </View>
            <View style={styles.videoBadge} pointerEvents="none">
                <Icon name="videocam" size={10} color="#FFFFFF" />
                <Text style={styles.videoBadgeText}>Video</Text>
            </View>
        </>
    );

    const bodyText = getPostBodyText(post);
    const poster = resolvePostThumbnail(post);
    if (isTextOnlyPost(post) || (bodyText && !poster && !isVideoPost(post))) {
        return (
            <View style={[styles.cell, { backgroundColor: getTextOnlyBackgroundColor(post) }]}>
                {locationBadge}
                <Text
                    style={[styles.textThumb, { color: getTextOnlyTextColor(post) }]}
                    numberOfLines={4}
                >
                    {bodyText || 'Post'}
                </Text>
            </View>
        );
    }

    // Image-only thumbs — never mount react-native-video in grid cells (Android steals taps).
    if (isVideoPost(post)) {
        const videoUrl = resolveVideoUrl(post);
        const demoSource = resolveDemoVideoPosterSource(videoUrl);
        // Demo feed MP4s share one real BBB frame; use it whenever we lack a captured poster.
        const imageSource = poster
            ? ({ uri: poster } as const)
            : (demoSource ?? MOCK_FEED_BUNDLED_VIDEO_POSTER);
        return (
            <View style={styles.cell}>
                <Image source={imageSource} style={styles.image} resizeMode="cover" />
                {locationBadge}
                {videoOverlays}
            </View>
        );
    }

    if (!poster) {
        return (
            <View style={[styles.cell, styles.placeholder]}>
                {locationBadge}
                {bodyText ? (
                    <Text style={[styles.textThumb, { color: '#E5E7EB' }]} numberOfLines={4}>
                        {bodyText}
                    </Text>
                ) : (
                    <Icon name="image-outline" size={22} color="#6B7280" />
                )}
            </View>
        );
    }

    return (
        <View style={styles.cell}>
            <Image source={{ uri: poster }} style={styles.image} resizeMode="cover" />
            {locationBadge}
        </View>
    );
}

const styles = StyleSheet.create({
    cell: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        overflow: 'hidden',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        backgroundColor: '#0B1220',
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
    playCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIconOffset: {
        marginLeft: 2,
    },
    videoBadge: {
        position: 'absolute',
        right: 6,
        bottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    videoBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    locationBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        maxWidth: '88%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        zIndex: 2,
    },
    locationBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
        flexShrink: 1,
    },
});
