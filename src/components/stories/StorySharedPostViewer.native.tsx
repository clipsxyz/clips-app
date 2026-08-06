import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import Video, { ViewType } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../Avatar';
import Flag from '../Flag.native';
import type { Post, Story } from '../../types';
import {
    getPostMediaUrl,
    getStoryVideoPosterFallback,
    isStoryVideo,
    postHasRealMedia,
    resolveStoryMediaUrl,
    storyVideoSource,
} from '../../utils/storyMediaNative';
import { getTextStoryStyle } from '../../utils/storyTextStyleNative';
import { getAvatarForHandle, getFlagForHandle } from '../../api/users';
import { timeAgo } from '../../utils/timeAgo';
import { ox } from '../../constants/nativeOpticalScale';

const SHARED_BACKDROP = ['#0f172a', '#111827', '#1f2937'];
/** Soft atlas wash behind text-only shares (not IG purple/magenta). */
const TEXT_SHARE_FALLBACK_BACKDROP = ['#0f2430', '#060d16', '#12263a'];

function StoryVideoLayer({
    uri,
    posterUri,
    style,
    muted = true,
    repeat = true,
    paused = false,
}: {
    uri: string;
    posterUri?: string;
    style: object;
    muted?: boolean;
    repeat?: boolean;
    paused?: boolean;
}) {
    const source = storyVideoSource(uri);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [uri]);

    if ((failed || !source) && posterUri) {
        return <Image source={{ uri: posterUri }} style={style} resizeMode="cover" />;
    }

    if (!source) {
        return <View style={style} />;
    }

    return (
        <Video
            source={source}
            style={style}
            resizeMode="cover"
            muted={muted}
            repeat={repeat}
            paused={paused}
            playInBackground={false}
            playWhenInactive={false}
            viewType={ViewType.TEXTURE}
            useTextureView
            ignoreSilentSwitch="ignore"
            onError={() => setFailed(true)}
        />
    );
}

type Props = {
    story: Story;
    originalPost: Post | null;
    sharedPostFetchFailed: boolean;
    isMuted: boolean;
    paused: boolean;
    onOpenModal: () => void;
    onOpenProfile: (handle: string) => void;
};

export default function StorySharedPostViewer({
    story,
    originalPost,
    sharedPostFetchFailed,
    isMuted,
    paused,
    onOpenModal,
    onOpenProfile,
}: Props) {
    if (story.sharedFromPost && !originalPost && !sharedPostFetchFailed) {
        return (
            <View style={[StyleSheet.absoluteFill, styles.loading]}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    const fallbackUrl = resolveStoryMediaUrl(story.mediaUrl) || '';
    const post = originalPost;
    const mediaUrl = resolveStoryMediaUrl(getPostMediaUrl(post)) || fallbackUrl;
    const posterUri = getStoryVideoPosterFallback(mediaUrl || story.mediaUrl, post);
    const hasRealMedia = post ? postHasRealMedia(post) : !!fallbackUrl;
    const isVideo = isStoryVideo(story, post) || (!!fallbackUrl && /\.(mp4|webm|mov|m4v)/i.test(fallbackUrl));
    const caption = (
        post?.caption ||
        post?.text ||
        (post as { captionText?: string } | undefined)?.captionText ||
        story.text ||
        ''
    ).trim();
    const handle = post?.userHandle || story.sharedFromUser || '';

    if (story.sharedFromPost && !post && sharedPostFetchFailed && fallbackUrl) {
        return (
            <LinearGradient colors={SHARED_BACKDROP} style={StyleSheet.absoluteFill}>
                {isVideo ? (
                    <StoryVideoLayer
                        uri={fallbackUrl}
                        posterUri={posterUri}
                        style={[StyleSheet.absoluteFill, styles.backdropMedia]}
                        paused
                    />
                ) : (
                    <Image source={{ uri: fallbackUrl }} style={[StyleSheet.absoluteFill, styles.backdropMedia]} />
                )}
                <View style={styles.backdropDim} />
                <View style={styles.cardColumn}>
                    <TouchableOpacity style={styles.card} onPress={onOpenModal} activeOpacity={0.95}>
                        {isVideo ? (
                            <StoryVideoLayer
                                uri={fallbackUrl}
                                posterUri={posterUri}
                                style={styles.cardMedia}
                                muted={isMuted}
                                paused={paused}
                            />
                        ) : (
                            <Image source={{ uri: fallbackUrl }} style={styles.cardMedia} resizeMode="cover" />
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    if (!post) {
        return (
            <View style={[StyleSheet.absoluteFill, styles.loading]}>
                <Text style={styles.fallbackText}>Shared post</Text>
            </View>
        );
    }

    if (hasRealMedia && mediaUrl) {
        return (
            <LinearGradient colors={SHARED_BACKDROP} style={StyleSheet.absoluteFill}>
                {isVideo ? (
                    <StoryVideoLayer
                        uri={mediaUrl}
                        posterUri={posterUri}
                        style={[StyleSheet.absoluteFill, styles.backdropMedia]}
                        paused
                    />
                ) : (
                    <Image source={{ uri: mediaUrl }} style={[StyleSheet.absoluteFill, styles.backdropMedia]} />
                )}
                <View style={styles.backdropDim} />
                <View style={styles.cardColumn}>
                    <TouchableOpacity style={styles.card} onPress={onOpenModal} activeOpacity={0.95}>
                        {isVideo ? (
                            <StoryVideoLayer
                                uri={mediaUrl}
                                posterUri={posterUri}
                                style={styles.cardMedia}
                                muted={isMuted}
                                paused={paused}
                            />
                        ) : (
                            <Image source={{ uri: mediaUrl }} style={styles.cardMedia} resizeMode="cover" />
                        )}
                        <View style={styles.cardChip}>
                            <Avatar
                                src={getAvatarForHandle(post.userHandle)}
                                name={post.userHandle.split('@')[0]}
                                size="sm"
                            />
                            <Text style={styles.cardChipText} numberOfLines={1}>
                                {post.userHandle}
                            </Text>
                        </View>
                        {!!caption && (
                            <View style={styles.cardCaption}>
                                <Text style={styles.cardCaptionText} numberOfLines={2}>
                                    <Text style={styles.cardCaptionHandle}>{post.userHandle} </Text>
                                    {caption}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {!!handle && (
                        <TouchableOpacity
                            style={styles.attribution}
                            onPress={() => onOpenProfile(handle.replace(/^@/, ''))}
                        >
                            <Text style={styles.attributionText}>@{handle.replace(/^@/, '')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>
        );
    }

    if (post.text) {
        const { gradientColors, color, fontSize } = getTextStoryStyle(story, post);
        const cleanHandle = (handle || post.userHandle || '').replace(/^@/, '');
        const bodySize = Math.max(fontSize, ox(18));
        const backdropColors =
            gradientColors.length >= 2
                ? [gradientColors[0], '#060d16', gradientColors[gradientColors.length - 1]]
                : TEXT_SHARE_FALLBACK_BACKDROP;

        return (
            <LinearGradient colors={backdropColors} style={styles.textSharedRoot}>
                <View style={styles.textSharedVeil} pointerEvents="none" />
                <View style={styles.textSharedColumn}>
                    <View style={styles.sharedFromPill}>
                        <Icon name="return-up-forward-outline" size={ox(12)} color="#9fd4cb" />
                        <Text style={styles.sharedFromPillText}>
                            Shared from{' '}
                            <Text style={styles.sharedFromBold}>@{cleanHandle}</Text>
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.textCard}
                        onPress={onOpenModal}
                        activeOpacity={0.94}
                    >
                        <View style={styles.textCardHeader}>
                            <Avatar
                                src={getAvatarForHandle(post.userHandle)}
                                name={post.userHandle.split('@')[0]}
                                size={ox(36)}
                            />
                            <View style={styles.textCardMeta}>
                                <View style={styles.textCardHandleRow}>
                                    <Text style={styles.textCardHandle} numberOfLines={1}>
                                        {post.userHandle}
                                    </Text>
                                    <Flag
                                        value={getFlagForHandle(post.userHandle) || ''}
                                        size={ox(12)}
                                    />
                                </View>
                                <View style={styles.textCardSubRow}>
                                    {post.locationLabel ? (
                                        <>
                                            <Icon
                                                name="location-outline"
                                                size={ox(11)}
                                                color="#6B7280"
                                            />
                                            <Text style={styles.textCardTime} numberOfLines={1}>
                                                {post.locationLabel}
                                            </Text>
                                            {post.createdAt ? (
                                                <Text style={styles.textCardDot}>·</Text>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {post.createdAt ? (
                                        <Text style={styles.textCardTime}>
                                            {timeAgo(post.createdAt)}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <View style={styles.textCardBodyPad}>
                            <LinearGradient
                                colors={
                                    gradientColors.length >= 2
                                        ? gradientColors
                                        : ['#0f2430', '#1a3f3c', '#12263a']
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.textCardBody}
                            >
                                <View style={styles.textCardAccent} />
                                <Text
                                    style={[
                                        styles.textCardBodyText,
                                        { color, fontSize: bodySize, lineHeight: bodySize * 1.35 },
                                    ]}
                                >
                                    {post.text}
                                </Text>
                            </LinearGradient>
                        </View>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    return (
        <View style={[StyleSheet.absoluteFill, styles.loading]}>
            <Text style={styles.fallbackText}>Shared post</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    loading: {
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackText: { color: '#fff', fontSize: 14 },
    backdropMedia: { opacity: 0.58 },
    backdropDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    cardColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 280,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    cardMedia: {
        width: '100%',
        aspectRatio: 9 / 16,
        maxHeight: 360,
        backgroundColor: '#111',
    },
    cardChip: {
        position: 'absolute',
        top: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    cardChipText: {
        color: '#111827',
        fontSize: 11,
        fontWeight: '700',
        maxWidth: 140,
    },
    cardCaption: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
    },
    cardCaptionText: { color: '#111827', fontSize: 12, lineHeight: 16 },
    cardCaptionHandle: { fontWeight: '700' },
    attribution: {
        marginTop: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    attributionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    textSharedRoot: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textSharedVeil: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(6, 13, 22, 0.45)',
    },
    textSharedColumn: {
        width: '100%',
        maxWidth: ox(340),
        paddingHorizontal: ox(22),
        alignItems: 'center',
    },
    sharedFromPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        marginBottom: ox(14),
        paddingHorizontal: ox(14),
        paddingVertical: ox(7),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(159, 212, 203, 0.35)',
        backgroundColor: 'rgba(6, 13, 22, 0.72)',
    },
    sharedFromPillText: {
        color: 'rgba(255,255,255,0.92)',
        fontSize: ox(12),
    },
    sharedFromBold: { fontWeight: '700', color: '#9fd4cb' },
    textCard: {
        width: '100%',
        borderRadius: ox(20),
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
    },
    textCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingTop: ox(16),
        paddingBottom: ox(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    textCardMeta: { flex: 1, minWidth: 0 },
    textCardHandleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
    },
    textCardHandle: {
        flexShrink: 1,
        fontSize: ox(14),
        fontWeight: '700',
        color: '#111827',
    },
    textCardSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(4),
        marginTop: ox(3),
    },
    textCardTime: { fontSize: ox(11), color: '#6B7280', flexShrink: 1 },
    textCardDot: { fontSize: ox(11), color: '#9CA3AF' },
    textCardBodyPad: {
        padding: ox(14),
        backgroundColor: '#FFFFFF',
    },
    textCardBody: {
        paddingVertical: ox(22),
        paddingHorizontal: ox(18),
        minHeight: ox(148),
        borderRadius: ox(14),
        justifyContent: 'center',
        overflow: 'hidden',
    },
    textCardAccent: {
        position: 'absolute',
        left: 0,
        top: ox(14),
        bottom: ox(14),
        width: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(159, 212, 203, 0.85)',
    },
    textCardBodyText: {
        fontWeight: '600',
        textAlign: 'left',
        letterSpacing: -0.2,
    },
});
