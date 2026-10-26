import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import CachedImage from './CachedImage.native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { getPostById, loadSharedPost } from '../api/posts';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge.native';
import { timeAgo } from '../utils/timeAgo';
import { ox } from '../constants/nativeOpticalScale';
import { DM_MEDIA_ASPECT_RATIO, DM_MEDIA_MAX_WIDTH } from '../constants/dmMedia.native';
import {
    UEFA_PASSPORT_GRADIENT,
    UEFA_PASSPORT_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';
import { isVideoMediaUri, siblingJpegFromVideoUrl } from '../utils/postMedia';
import { useDmTapSuppressed } from './DmMessagePressable.native';

function resolveDisplayMedia(post: Post | null | undefined): {
    url: string;
    posterUrl: string;
    isVideo: boolean;
} {
    if (!post) return { url: '', posterUrl: '', isVideo: false };
    const first = post.mediaItems?.[0];
    const firstAny = first as
        | {
              media_url?: string;
              posterUrl?: string;
              poster_url?: string;
              thumbnailUrl?: string;
              thumbnail_url?: string;
          }
        | undefined;
    const firstUrl = first?.url ?? firstAny?.media_url;
    const url = (post.mediaUrl?.trim() || (typeof firstUrl === 'string' ? firstUrl.trim() : '') || '').trim();
    const isVideo = post.mediaType === 'video' || first?.type === 'video';
    const posterCandidates = [
        post.videoPosterUrl,
        post.thumbnailUrl,
        firstAny?.posterUrl,
        firstAny?.poster_url,
        firstAny?.thumbnailUrl,
        firstAny?.thumbnail_url,
    ];
    const explicitPoster = posterCandidates
        .find(
            (candidate): candidate is string =>
                typeof candidate === 'string' &&
                candidate.trim().length > 0 &&
                !isVideoMediaUri(candidate) &&
                !/^data:video\//i.test(candidate),
        )
        ?.trim();
    const posterUrl =
        explicitPoster || (isVideo ? siblingJpegFromVideoUrl(url) : undefined) || '';
    return { url, posterUrl, isVideo };
}

/** Glass post meta line — location + relative time (used in both card branches). */
function PostMeta({ post, light }: { post: Post; light?: boolean }) {
    const iconColor = light ? '#CBD5E1' : '#4B5563';
    const textColor = light ? '#CBD5E1' : '#4B5563';
    const mutedColor = light ? '#94A3B8' : '#9CA3AF';
    if (!post.locationLabel && !post.createdAt) return null;
    return (
        <View style={styles.metaRow}>
            {post.locationLabel ? (
                <>
                    <Icon name="location-outline" size={ox(11)} color={iconColor} />
                    <Text style={[styles.metaText, { color: textColor }]} numberOfLines={1}>
                        {post.locationLabel}
                    </Text>
                    {post.createdAt ? <Text style={[styles.metaText, { color: mutedColor }]}> · </Text> : null}
                </>
            ) : null}
            {post.createdAt ? (
                <Text style={[styles.metaText, { color: mutedColor }]}>{timeAgo(post.createdAt)}</Text>
            ) : null}
        </View>
    );
}

type SharedPostCardProps = {
    post: Post;
    onTap?: (post: Post) => void;
};

/** Glass (frosted dark) shared post card — native DM parity with web MessagesPage. */
export function DmSharedPostCard({ post, onTap }: SharedPostCardProps) {
    const suppressTap = useDmTapSuppressed();
    const { url: displayUrl, posterUrl, isVideo } = resolveDisplayMedia(post);
    const mediaStill = isVideo ? posterUrl : displayUrl;
    const hasDisplayMedia = displayUrl.length > 0;
    const isTextOnly = !hasDisplayMedia;

    const card = (
        <LinearGradient
            colors={[...UEFA_PASSPORT_GRADIENT]}
            locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glassCard}
        >
            <View style={styles.headerRow}>
                <Avatar
                    src={getAvatarForHandle(post.userHandle)}
                    name={post.userHandle.split('@')[0]}
                    size={ox(28)}
                />
                <View style={styles.headerText}>
                    <View style={styles.handleRow}>
                        <Text style={styles.handleLight} numberOfLines={1}>
                            {post.userHandle}
                        </Text>
                        <VerifiedBadge accountType={post.userAccountType} size={ox(12)} />
                    </View>
                    <PostMeta post={post} light />
                </View>
            </View>

            {isTextOnly ? (
                <View style={styles.textOnlyPad}>
                    <View style={styles.textOnlyBox}>
                        <Text style={styles.textOnlyBody}>{post.text}</Text>
                    </View>
                </View>
            ) : (
                <View style={styles.mediaCardPad}>
                    {post.text ? (
                        <Text style={styles.captionLight} numberOfLines={2}>
                            {post.text}
                        </Text>
                    ) : null}
                    {hasDisplayMedia ? (
                        <View style={styles.mediaWrap}>
                            {mediaStill ? (
                                <CachedImage source={{ uri: mediaStill }} style={styles.mediaImage} />
                            ) : (
                                <View style={[styles.mediaImage, styles.mediaFallback]}>
                                    <Icon name="videocam" size={ox(26)} color="#E5E7EB" />
                                </View>
                            )}
                            {isVideo ? (
                                <View style={styles.playOverlay}>
                                    <View style={styles.playCircle}>
                                        <Icon name="play" size={ox(22)} color="#FFFFFF" />
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            )}

            {onTap ? (
                <View style={styles.scenesCta}>
                    <Icon name="images-outline" size={ox(13)} color="#E5E7EB" />
                    <Text style={styles.scenesCtaText}>Tap to view in Scenes</Text>
                </View>
            ) : null}
        </LinearGradient>
    );

    if (!onTap) return card;

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => {
                if (suppressTap?.current) return;
                onTap(post);
            }}
            style={styles.tapWrap}
        >
            {card}
        </TouchableOpacity>
    );
}

type PreviewProps = {
    postId?: string;
    token?: string;
    userId?: string;
    onTap: () => void;
};

/** Compact loading/preview card while shared post resolves. */
export function DmSharedPostPreviewCard({ postId, token, userId, onTap }: PreviewProps) {
    const suppressTap = useDmTapSuppressed();
    const [previewPost, setPreviewPost] = useState<Post | null>(null);

    useEffect(() => {
        let cancelled = false;
        const resolve = token
            ? loadSharedPost({ token })
            : postId
              ? getPostById(postId, userId)
              : Promise.resolve(null);
        resolve
            .then((post) => {
                if (!cancelled && post) setPreviewPost(post);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [postId, token, userId]);

    const { url: displayUrl, posterUrl, isVideo } = resolveDisplayMedia(previewPost);
    const mediaStill = isVideo ? posterUrl : displayUrl;
    const hasMedia = mediaStill.length > 0;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
                if (suppressTap?.current) return;
                onTap();
            }}
            style={styles.tapWrap}
        >
            <LinearGradient
                colors={[...UEFA_PASSPORT_GRADIENT]}
                locations={[...UEFA_PASSPORT_GRADIENT_LOCATIONS]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.previewCard}
            >
            {hasMedia ? (
                <View style={styles.previewMediaBlock}>
                    <View style={styles.previewAspect}>
                        <CachedImage source={{ uri: mediaStill }} style={styles.mediaImage} />
                        {isVideo ? (
                            <View style={styles.playOverlay}>
                                <View style={styles.playCircle}>
                                    <Icon name="play" size={ox(22)} color="#FFFFFF" />
                                </View>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.scenesCta}>
                        <Icon name="images-outline" size={ox(13)} color="#E5E7EB" />
                        <Text style={styles.scenesCtaText}>Tap to view in Scenes</Text>
                    </View>
                </View>
            ) : (
                <View style={styles.previewEmpty}>
                    {previewPost ? (
                        <Icon name="play-circle-outline" size={ox(36)} color="#9CA3AF" />
                    ) : (
                        <ActivityIndicator color="#9CA3AF" />
                    )}
                    <Text style={styles.previewEmptyText}>Tap to view in Scenes</Text>
                </View>
            )}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    tapWrap: {
        width: '100%',
        maxWidth: DM_MEDIA_MAX_WIDTH,
    },
    glassCard: {
        width: '100%',
        maxWidth: DM_MEDIA_MAX_WIDTH,
        borderRadius: ox(18),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ox(10),
        paddingHorizontal: ox(14),
        paddingTop: ox(12),
        paddingBottom: ox(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    handleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
    },
    handleLight: {
        color: '#F8FAFC',
        fontSize: ox(13),
        fontWeight: '700',
        flexShrink: 1,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(3),
        flexWrap: 'wrap',
        marginTop: ox(3),
    },
    metaText: {
        fontSize: ox(11),
    },
    textOnlyPad: {
        padding: ox(14),
    },
    textOnlyBox: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: ox(14),
    },
    textOnlyBody: {
        color: '#F1F5F9',
        fontSize: ox(15),
        lineHeight: ox(22),
    },
    mediaCardPad: {
        padding: ox(14),
    },
    captionLight: {
        color: '#E2E8F0',
        fontSize: ox(13),
        marginBottom: ox(8),
    },
    mediaWrap: {
        marginTop: ox(4),
        borderRadius: ox(12),
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    mediaImage: {
        width: '100%',
        aspectRatio: DM_MEDIA_ASPECT_RATIO,
        resizeMode: 'cover',
    },
    mediaFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    playOverlay: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
    playCircle: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(24),
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scenesCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
        paddingVertical: ox(10),
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    scenesCtaText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '700',
    },
    previewCard: {
        width: '100%',
        maxWidth: DM_MEDIA_MAX_WIDTH,
        borderRadius: ox(18),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        minHeight: ox(100),
    },
    previewMediaBlock: {
        width: '100%',
    },
    previewAspect: {
        width: '100%',
        aspectRatio: DM_MEDIA_ASPECT_RATIO,
        backgroundColor: '#000000',
        position: 'relative',
    },
    previewEmpty: {
        paddingVertical: ox(28),
        paddingHorizontal: ox(16),
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(10),
    },
    previewEmptyText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
});
