import React, { useMemo, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar.native';
import FeedPostMedia from './FeedPostMedia.native';
import type { Post } from '../types';
import { getAvatarForHandle } from '../api/users';
import {
    getTextOnlyBackgroundColor,
    isTextOnlyPost,
    isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { getEffectiveTextStyleForPost } from '../utils/effectiveTextPostStyle';
import { formatProfileDisplayHandle } from '../utils/profileShareUrl';
import { FEED_CARD_MEDIA_BG } from './FeedPageLayout.native';

/** Compact press-preview card radius (smaller than the feed card shell — it is a modal peek). */
const PEEK_SHEET_RADIUS = 14;

type PeekAction = {
    id: string;
    label: string;
    icon: string;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
};

type Props = {
    visible: boolean;
    post: Post | null;
    profileHandle: string;
    profileName: string;
    profileAvatarUrl?: string;
    isOwnProfile: boolean;
    onClose: () => void;
    onLike: () => void;
    onComment: () => void;
    onReclip: () => void;
    onShare: () => void;
    onReport: () => void;
};

export default function ProfileGridPeekSheet({
    visible,
    post,
    profileHandle,
    profileName,
    profileAvatarUrl,
    isOwnProfile,
    onClose,
    onLike,
    onComment,
    onReclip,
    onShare,
    onReport,
}: Props) {
    const { width } = useWindowDimensions();
    const [videoMuted, setVideoMuted] = useState(true);
    const previewWidth = Math.min(width - 32, 360);
    const previewMediaHeight = Math.min(width * 0.52, 420);

    const textStyle = useMemo(() => (post ? getEffectiveTextStyleForPost(post) : undefined), [post]);

    const actions: PeekAction[] = useMemo(
        () => [
            {
                id: 'like',
                label: 'Like',
                icon: post?.userLiked ? 'heart' : 'heart-outline',
                onPress: onLike,
            },
            {
                id: 'comment',
                label: 'Comment',
                icon: 'chatbubble-outline',
                onPress: onComment,
            },
            {
                id: 'reclip',
                label: 'Repost',
                icon: 'repeat-outline',
                onPress: onReclip,
                disabled: isOwnProfile,
            },
            {
                id: 'share',
                label: 'Share',
                icon: 'share-social-outline',
                onPress: onShare,
            },
            {
                id: 'report',
                label: 'Report',
                icon: 'alert-circle-outline',
                onPress: onReport,
                destructive: true,
            },
        ],
        [isOwnProfile, onComment, onLike, onReclip, onReport, onShare, post?.userLiked]
    );

    if (!post) return null;

    const caption = post.text || post.caption || post.imageText || '';
    const handleLabel = formatProfileDisplayHandle(profileHandle || post.userHandle);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { width: previewWidth }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.handle} />
                    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                        <View style={styles.previewCard}>
                            <View style={styles.previewHeader}>
                                <Avatar
                                    src={profileAvatarUrl || getAvatarForHandle(profileHandle || post.userHandle)}
                                    name={profileName}
                                    size="sm"
                                />
                                <Text style={styles.previewHandle} numberOfLines={1}>
                                    {handleLabel}
                                </Text>
                            </View>

                            <View style={[styles.previewMedia, { height: previewMediaHeight }]}>
                                {isTextOnlyPost(post) ? (
                                    <View
                                        style={[
                                            styles.textPreview,
                                            {
                                                backgroundColor: getTextOnlyBackgroundColor(post),
                                                minHeight: previewMediaHeight,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.textPreviewBody,
                                                {
                                                    color: textStyle?.color || '#111827',
                                                    fontSize:
                                                        textStyle?.size === 'large'
                                                            ? 22
                                                            : textStyle?.size === 'small'
                                                              ? 14
                                                              : 18,
                                                },
                                            ]}
                                            numberOfLines={8}
                                        >
                                            {caption || 'Post'}
                                        </Text>
                                    </View>
                                ) : post.mediaUrl ? (
                                    <>
                                        {isVideoPost(post) ? (
                                            <FeedPostMedia
                                                post={post}
                                                width={previewWidth}
                                                height={previewMediaHeight}
                                                mode="feed"
                                                muted={videoMuted}
                                                isActive
                                                immediateVideoSurface
                                            />
                                        ) : (
                                            <Image
                                                source={{ uri: post.mediaUrl }}
                                                style={styles.imagePreview}
                                                resizeMode="contain"
                                            />
                                        )}
                                        {isVideoPost(post) ? (
                                            <TouchableOpacity
                                                style={styles.muteButton}
                                                onPress={() => setVideoMuted((m) => !m)}
                                                accessibilityLabel={videoMuted ? 'Unmute' : 'Mute'}
                                            >
                                                <Icon
                                                    name={videoMuted ? 'volume-mute' : 'volume-high'}
                                                    size={16}
                                                    color="#FFFFFF"
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                        {caption ? (
                                            <View style={styles.captionOverlay}>
                                                <Text style={styles.captionText} numberOfLines={4}>
                                                    {caption}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </>
                                ) : (
                                    <View style={styles.textPreview}>
                                        <Text style={styles.textPreviewBody} numberOfLines={8}>
                                            {caption || 'Post'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={styles.actionsCard}>
                            {actions.map((action) => (
                                <Pressable
                                    key={action.id}
                                    style={({ pressed }) => [
                                        styles.actionRow,
                                        action.disabled && styles.actionRowDisabled,
                                        pressed && !action.disabled && styles.actionRowPressed,
                                    ]}
                                    onPress={() => {
                                        if (action.disabled) return;
                                        action.onPress();
                                    }}
                                    disabled={action.disabled}
                                    android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
                                >
                                    <Icon name={action.icon} size={20} color="#FFFFFF" />
                                    <Text style={styles.actionLabel}>{action.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(3, 9, 27, 0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    sheet: {
        maxHeight: '92%',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'rgba(10, 10, 20, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        marginTop: 10,
        marginBottom: 8,
    },
    sheetContent: {
        gap: 10,
        paddingHorizontal: 10,
        paddingBottom: 12,
    },
    previewCard: {
        borderRadius: PEEK_SHEET_RADIUS,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#0B1021',
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(10, 10, 20, 0.85)',
    },
    previewHandle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    previewMedia: {
        backgroundColor: FEED_CARD_MEDIA_BG,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    textPreview: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    textPreviewBody: {
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '600',
    },
    muteButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(10, 10, 20, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captionOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 12,
        paddingTop: 28,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    captionText: {
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
    },
    actionsCard: {
        borderRadius: PEEK_SHEET_RADIUS,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(10, 10, 20, 0.85)',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    },
    actionRowPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    actionRowDisabled: {
        opacity: 0.4,
    },
    actionLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
