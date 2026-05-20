import React from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from '../Avatar';
import type { Post, Story } from '../../types';
import { getPostMediaUrl, isStoryVideo, postHasRealMedia } from '../../utils/storyMediaNative';
import { getTextStoryStyle } from '../../utils/storyTextStyleNative';
import { getAvatarForHandle } from '../../api/users';
import { timeAgo } from '../../utils/timeAgo';

const SHARED_BACKDROP = ['#0f172a', '#111827', '#1f2937'];

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

    const fallbackUrl = (story.mediaUrl || '').trim();
    const post = originalPost;
    const mediaUrl = getPostMediaUrl(post) || fallbackUrl;
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
                    <Video
                        source={{ uri: fallbackUrl }}
                        style={[StyleSheet.absoluteFill, styles.backdropMedia]}
                        resizeMode="cover"
                        muted
                        repeat
                        paused
                    />
                ) : (
                    <Image source={{ uri: fallbackUrl }} style={[StyleSheet.absoluteFill, styles.backdropMedia]} />
                )}
                <View style={styles.backdropDim} />
                <View style={styles.cardColumn}>
                    <TouchableOpacity style={styles.card} onPress={onOpenModal} activeOpacity={0.95}>
                        {isVideo ? (
                            <Video
                                source={{ uri: fallbackUrl }}
                                style={styles.cardMedia}
                                resizeMode="cover"
                                repeat
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
                    <Video
                        source={{ uri: mediaUrl }}
                        style={[StyleSheet.absoluteFill, styles.backdropMedia]}
                        resizeMode="cover"
                        muted
                        repeat
                        paused
                    />
                ) : (
                    <Image source={{ uri: mediaUrl }} style={[StyleSheet.absoluteFill, styles.backdropMedia]} />
                )}
                <View style={styles.backdropDim} />
                <View style={styles.cardColumn}>
                    <TouchableOpacity style={styles.card} onPress={onOpenModal} activeOpacity={0.95}>
                        {isVideo ? (
                            <Video
                                source={{ uri: mediaUrl }}
                                style={styles.cardMedia}
                                resizeMode="cover"
                                repeat
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
        return (
            <View style={styles.textSharedRoot}>
                <Text style={styles.sharedFromPill}>
                    Shared from <Text style={styles.sharedFromBold}>@{handle.replace(/^@/, '')}</Text>
                </Text>
                <TouchableOpacity style={styles.textCard} onPress={onOpenModal} activeOpacity={0.95}>
                    <View style={styles.textCardHeader}>
                        <Avatar
                            src={getAvatarForHandle(post.userHandle)}
                            name={post.userHandle.split('@')[0]}
                            size="sm"
                        />
                        <View style={styles.textCardMeta}>
                            <Text style={styles.textCardHandle}>{post.userHandle}</Text>
                            {post.createdAt ? (
                                <Text style={styles.textCardTime}>{timeAgo(post.createdAt)}</Text>
                            ) : null}
                        </View>
                    </View>
                    <LinearGradient colors={gradientColors} style={styles.textCardBody}>
                        <Text style={[styles.textCardBodyText, { color, fontSize }]}>{post.text}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
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
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    sharedFromPill: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sharedFromBold: { fontWeight: '700' },
    textCard: {
        width: '100%',
        maxWidth: 300,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    textCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
    },
    textCardMeta: { flex: 1 },
    textCardHandle: { fontSize: 13, fontWeight: '700', color: '#111827' },
    textCardTime: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    textCardBody: { padding: 16, minHeight: 120, justifyContent: 'center' },
    textCardBodyText: { fontWeight: '600', textAlign: 'left', lineHeight: 22 },
});
