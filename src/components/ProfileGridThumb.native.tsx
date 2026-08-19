import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { Post } from '../types';
import {
    getPostBodyText,
    getTextOnlyBackgroundColor,
    getTextOnlyTextColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { resolvePostThumbnail } from '../api/collections';
import { androidListSafeVideoProps, isPlayableVideoUri } from '../utils/androidSafeVideoNative';
import { resolvePostPlaybackUri } from '../utils/postMedia';

type Props = {
    post: Post;
};

function getPostLocationLabel(post: Post): string | undefined {
    const label = post.locationLabel || post.venue;
    const trimmed = typeof label === 'string' ? label.trim() : '';
    return trimmed.length > 0 ? trimmed : undefined;
}

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
        <View style={styles.playCenter} pointerEvents="none">
            <View style={styles.playCircle}>
                <Icon name="play" size={22} color="#FFFFFF" style={styles.playIconOffset} />
            </View>
        </View>
    );

    const bodyText = getPostBodyText(post);
    const imageUri = resolveGridImageUri(post);

    if (imageUri) {
        return (
            <View style={styles.cell}>
                <Image
                    source={{ uri: imageUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    pointerEvents="none"
                />
                {locationBadge}
                {isVideoPost(post) ? videoOverlays : null}
            </View>
        );
    }

    const videoUri = isVideoPost(post) ? resolvePostPlaybackUri(post) : undefined;
    if (isPlayableVideoUri(videoUri)) {
        return (
            <View style={styles.cell}>
                <Video
                    source={{ uri: videoUri }}
                    style={{ width: '100%', height: '100%' }}
                    paused
                    muted
                    repeat={false}
                    resizeMode="cover"
                    pointerEvents="none"
                    poster={post.videoPosterUrl || post.thumbnailUrl}
                    {...androidListSafeVideoProps()}
                />
                {locationBadge}
                {videoOverlays}
            </View>
        );
    }

    if (isTextOnlyPost(post) || (bodyText && !isVideoPost(post))) {
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

    return (
        <View style={[styles.cell, styles.placeholder]}>
            {locationBadge}
            {isVideoPost(post) ? videoOverlays : bodyText ? (
                <Text style={[styles.textThumb, { color: '#E5E7EB' }]} numberOfLines={4}>
                    {bodyText}
                </Text>
            ) : (
                <Icon name="image-outline" size={22} color="#6B7280" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    cell: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        overflow: 'hidden',
        borderRadius: 8,
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
