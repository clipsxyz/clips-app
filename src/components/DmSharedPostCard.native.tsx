import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { Post } from '../types';
import { getPostById } from '../api/posts';
import { getAvatarForHandle } from '../api/users';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge.native';
import { timeAgo } from '../utils/timeAgo';
import { ox } from '../constants/nativeOpticalScale';

function resolveDisplayMedia(post: Post | null | undefined): {
    url: string;
    isVideo: boolean;
} {
    if (!post) return { url: '', isVideo: false };
    const first = post.mediaItems?.[0];
    const firstUrl =
        first &&
        (first.url ?? (first as { media_url?: string }).media_url);
    const url = (post.mediaUrl?.trim() || (typeof firstUrl === 'string' ? firstUrl.trim() : '') || '').trim();
    const isVideo = post.mediaType === 'video' || first?.type === 'video';
    return { url, isVideo };
}

type SharedPostCardProps = {
    post: Post;
    onTap?: (post: Post) => void;
};

/** White Twitter-style shared post card (web MessagesPage parity). */
export function DmSharedPostCard({ post, onTap }: SharedPostCardProps) {
    const { url: displayUrl, isVideo } = resolveDisplayMedia(post);
    const hasDisplayMedia = displayUrl.length > 0;
    const isTextOnly = !!post.text && !hasDisplayMedia;

    const card = isTextOnly ? (
        <View style={styles.whiteCard}>
            <View style={styles.cardHeader}>
                <Avatar
                    src={getAvatarForHandle(post.userHandle)}
                    name={post.userHandle.split('@')[0]}
                    size={ox(28)}
                />
                <View style={styles.cardHeaderText}>
                    <View style={styles.handleRow}>
                        <Text style={styles.handleDark}>{post.userHandle}</Text>
                        <VerifiedBadge accountType={post.userAccountType} size={ox(12)} />
                    </View>
                    <View style={styles.metaRow}>
                        {post.locationLabel ? (
                            <>
                                <Icon name="location-outline" size={ox(11)} color="#4B5563" />
                                <Text style={styles.metaDark}>{post.locationLabel}</Text>
                                {post.createdAt ? <Text style={styles.metaMuted}> · </Text> : null}
                            </>
                        ) : null}
                        {post.createdAt ? (
                            <Text style={styles.metaMuted}>{timeAgo(post.createdAt)}</Text>
                        ) : null}
                    </View>
                </View>
            </View>
            <View style={styles.textOnlyPad}>
                <View style={styles.textOnlyBox}>
                    <Text style={styles.textOnlyBody}>{post.text}</Text>
                </View>
            </View>
        </View>
    ) : (
        <View style={styles.whiteCard}>
            <View style={styles.mediaCardPad}>
                <View style={styles.handleRow}>
                    <Avatar
                        src={getAvatarForHandle(post.userHandle)}
                        name={post.userHandle.split('@')[0]}
                        size={ox(28)}
                    />
                    <Text style={styles.handleDark}>{post.userHandle}</Text>
                    <VerifiedBadge accountType={post.userAccountType} size={ox(12)} />
                </View>
                {post.text ? (
                    <Text style={styles.captionDark} numberOfLines={2}>
                        {post.text}
                    </Text>
                ) : null}
                {displayUrl ? (
                    <View style={styles.mediaWrap}>
                        {isVideo ? (
                            <View style={styles.videoFrame}>
                                <Image source={{ uri: displayUrl }} style={styles.mediaImage} />
                                <View style={styles.playOverlay}>
                                    <View style={styles.playCircle}>
                                        <Icon name="play" size={ox(22)} color="#FFFFFF" />
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <Image source={{ uri: displayUrl }} style={styles.mediaImage} />
                        )}
                    </View>
                ) : null}
            </View>
            {onTap ? (
                <View style={styles.scenesCta}>
                    <Text style={styles.scenesCtaText}>Tap to view in Scenes</Text>
                </View>
            ) : null}
        </View>
    );

    if (!onTap) return card;

    return (
        <TouchableOpacity activeOpacity={0.92} onPress={() => onTap(post)} style={styles.tapWrap}>
            {card}
        </TouchableOpacity>
    );
}

type PreviewProps = {
    postId: string;
    userId?: string;
    onTap: () => void;
};

/** Compact loading/preview card while shared post resolves. */
export function DmSharedPostPreviewCard({ postId, userId, onTap }: PreviewProps) {
    const [previewPost, setPreviewPost] = useState<Post | null>(null);

    useEffect(() => {
        let cancelled = false;
        getPostById(postId, userId)
            .then((post) => {
                if (!cancelled && post) setPreviewPost(post);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [postId, userId]);

    const { url: displayUrl, isVideo } = resolveDisplayMedia(previewPost);
    const hasMedia = displayUrl.length > 0;

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onTap} style={styles.previewCard}>
            {hasMedia ? (
                <View style={styles.previewMediaBlock}>
                    <View style={styles.previewAspect}>
                        <Image source={{ uri: displayUrl }} style={styles.mediaImage} />
                        {isVideo ? (
                            <View style={styles.playOverlay}>
                                <View style={styles.playCircle}>
                                    <Icon name="play" size={ox(22)} color="#FFFFFF" />
                                </View>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.scenesCta}>
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
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    tapWrap: {
        width: '100%',
        maxWidth: ox(320),
    },
    whiteCard: {
        width: '100%',
        maxWidth: ox(320),
        borderRadius: ox(16),
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ox(10),
        paddingHorizontal: ox(14),
        paddingTop: ox(14),
        paddingBottom: ox(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    cardHeaderText: {
        flex: 1,
        minWidth: 0,
    },
    handleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        marginBottom: ox(6),
    },
    handleDark: {
        color: '#111827',
        fontSize: ox(13),
        fontWeight: '700',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(3),
        flexWrap: 'wrap',
    },
    metaDark: {
        color: '#4B5563',
        fontSize: ox(11),
    },
    metaMuted: {
        color: '#9CA3AF',
        fontSize: ox(11),
    },
    textOnlyPad: {
        padding: ox(14),
        backgroundColor: '#FFFFFF',
    },
    textOnlyBox: {
        backgroundColor: '#000000',
        borderRadius: ox(10),
        padding: ox(14),
    },
    textOnlyBody: {
        color: '#FFFFFF',
        fontSize: ox(15),
        lineHeight: ox(22),
    },
    mediaCardPad: {
        padding: ox(14),
        backgroundColor: '#FFFFFF',
    },
    captionDark: {
        color: '#374151',
        fontSize: ox(13),
        marginBottom: ox(8),
    },
    mediaWrap: {
        marginTop: ox(8),
        borderRadius: ox(10),
        overflow: 'hidden',
        backgroundColor: '#000000',
        maxHeight: ox(192),
    },
    videoFrame: {
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: ox(180),
        resizeMode: 'cover',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    playCircle: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(24),
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scenesCta: {
        backgroundColor: '#0284C7',
        paddingVertical: ox(10),
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        borderTopColor: '#0EA5E9',
    },
    scenesCtaText: {
        color: '#FFFFFF',
        fontSize: ox(13),
        fontWeight: '700',
    },
    previewCard: {
        width: '100%',
        maxWidth: ox(320),
        borderRadius: ox(16),
        overflow: 'hidden',
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#4B5563',
        minHeight: ox(100),
    },
    previewMediaBlock: {
        width: '100%',
    },
    previewAspect: {
        width: '100%',
        aspectRatio: 16 / 9,
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
