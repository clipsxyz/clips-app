import React, { useEffect, useMemo, useState } from 'react';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

    useEffect(() => {
        setVideoMuted(true);
    }, [post?.id]);

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
            <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                        <View style={[styles.previewCard, { width: previewWidth }]}>
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
                                                hideOverlayChrome
                                            />
                                        ) : (
                                            <Image
                                                source={{ uri: post.mediaUrl }}
                                                style={styles.imagePreview}
                                                resizeMode="contain"
                                            />
                                        )}
                                        {caption ? (
                                            <View style={styles.captionOverlay} pointerEvents="none">
                                                <Text style={styles.captionText} numberOfLines={4}>
                                                    {caption}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {isVideoPost(post) ? (
                                            <TouchableOpacity
                                                style={styles.muteButton}
                                                onPress={() => setVideoMuted((m) => !m)}
                                                accessibilityLabel={videoMuted ? 'Unmute' : 'Mute'}
                                                hitSlop={8}
                                            >
                                                <Icon
                                                    name={videoMuted ? 'volume-mute' : 'volume-high'}
                                                    size={16}
                                                    color="#111827"
                                                />
                                            </TouchableOpacity>
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

                        <View style={[styles.actionsCard, { width: previewWidth }]}>
                            {actions.map((action) => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={[styles.actionRow, action.disabled && styles.actionRowDisabled]}
                                    onPress={() => {
                                        if (action.disabled) return;
                                        action.onPress();
                                    }}
                                    disabled={action.disabled}
                                >
                                    <Icon
                                        name={action.icon}
                                        size={20}
                                        color={action.destructive ? 'rgba(255,255,255,0.75)' : '#FFFFFF'}
                                    />
                                    <Text
                                        style={[
                                            styles.actionLabel,
                                            action.destructive && styles.actionLabelMuted,
                                        ]}
                                    >
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    sheet: {
        width: '100%',
        maxHeight: '92%',
    },
    sheetContent: {
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
    },
    previewCard: {
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: '#000000',
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.2)',
    },
    previewHandle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    previewMedia: {
        backgroundColor: '#000000',
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
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        elevation: 8,
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
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: '#000000',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.12)',
    },
    actionRowDisabled: {
        opacity: 0.4,
    },
    actionLabel: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
    },
    actionLabelMuted: {
        color: 'rgba(255,255,255,0.85)',
    },
});
