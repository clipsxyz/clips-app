import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable, TouchableOpacity as SwipeActionButton } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Avatar from './Avatar';
import { timeAgo } from '../utils/timeAgo';
import type { ConversationSummary } from '../api/messages';

function sameDmHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export function inboxConversationRowId(conv: ConversationSummary): string {
    if (conv.kind === 'group' && conv.chatGroupId) return `g:${conv.chatGroupId}`;
    return conv.otherHandle;
}

/** Instagram-style compact relative time: "27m", "3h", "2d". */
export function compactInboxTime(timestamp?: number): string {
    if (!timestamp) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w`;
    return timeAgo(timestamp);
}

function displayHandle(handle: string): string {
    const raw = (handle || '').trim();
    if (!raw) return 'User';
    const name = raw.split('@')[0]?.trim();
    return name || raw;
}

export function conversationPreviewText(conv: ConversationSummary, viewerHandle?: string | null): string {
    const last = conv.lastMessage;
    if (!last) return conv.kind === 'group' ? 'Open group' : 'Open conversation';
    const fromMe = !!viewerHandle && sameDmHandle(last.senderHandle, viewerHandle);
    if (last.storyId) {
        const body = last.text?.trim();
        if (last.storyContextText === 'Reacted to your story' && body) {
            return fromMe
                ? `You reacted ${body} to their story`
                : `Reacted ${body} to your story`;
        }
        if (last.storyContextText === 'Reacted to your story') {
            return fromMe ? 'You reacted to their story' : 'Reacted to your story';
        }
        if (body === 'Replied to your story') {
            return fromMe ? 'You replied to their story' : 'Replied to your story';
        }
        if (body && body !== 'Replied to your story') return body;
        if (last.storyContextText?.trim()) {
            const ctx = last.storyContextText.trim();
            if (fromMe && /your story/i.test(ctx)) {
                return ctx
                    .replace(/your story/i, 'their story')
                    .replace(/^Reacted/, 'You reacted')
                    .replace(/^Replied/, 'You replied');
            }
            return ctx;
        }
        return fromMe ? 'You replied to their story' : 'Replied to your story';
    }
    if (last.text?.trim()) {
        const body = last.text.replace(/\s+/g, ' ').trim();
        if (/^liked (your|a) post/i.test(body)) return body;
        if (fromMe) {
            return body.startsWith('You: ') ? body : `You: ${body}`;
        }
        return body;
    }
    if (last.commentText?.trim()) return `Commented: ${last.commentText}`;
    if (last.imageUrl) return fromMe ? 'You: Photo' : 'Photo';
    if (last.audioUrl) return fromMe ? 'You: Voice message' : 'Voice message';
    return conv.kind === 'group' ? 'Open group' : 'Open conversation';
}

type Props = {
    conv: ConversationSummary;
    viewerHandle?: string | null;
    avatarSrc?: string;
    isSwipeOpen?: boolean;
    onSwipeOpenChange?: (rowId: string | null) => void;
    onPress: () => void;
    onOpenChatInfo: () => void;
    onAvatarPress?: () => void;
    onPin?: () => void;
    onMarkRead?: () => void;
    onMarkUnread?: () => void;
    onToggleMute?: () => void;
    onDelete?: () => void;
};

export default function InboxConversationRow({
    conv,
    viewerHandle,
    avatarSrc,
    isSwipeOpen,
    onSwipeOpenChange,
    onPress,
    onOpenChatInfo,
    onAvatarPress,
    onPin,
    onMarkRead,
    onMarkUnread,
    onToggleMute,
    onDelete,
}: Props) {
    const swipeRef = useRef<Swipeable | null>(null);
    const rowId = inboxConversationRowId(conv);
    const isGroup = conv.kind === 'group';
    const name = isGroup ? conv.groupName || 'Group chat' : displayHandle(conv.otherHandle);
    const lastMessage = conversationPreviewText(conv, viewerHandle);
    const timestamp = compactInboxTime(conv.lastMessage?.timestamp);
    const unread = conv.unread || 0;
    const hasStoryRing = !isGroup && !!conv.hasUnviewedStories;

    useEffect(() => {
        if (isSwipeOpen) {
            swipeRef.current?.openRight();
        } else {
            swipeRef.current?.close();
        }
    }, [isSwipeOpen]);

    const closeSwipe = () => {
        swipeRef.current?.close();
        onSwipeOpenChange?.(null);
    };

    const handleOpen = () => {
        if (isSwipeOpen) {
            closeSwipe();
            return;
        }
        onPress();
    };

    const renderRightActions = (
        _progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>,
    ) => {
        const opacity = dragX.interpolate({
            inputRange: [-220, -40, 0],
            outputRange: [1, 0.85, 0],
            extrapolate: 'clamp',
        });

        const action = (label: string, bg: string, onAction?: () => void, key?: string) => {
            if (!onAction) return null;
            return (
                <SwipeActionButton
                    key={key || label}
                    style={[styles.swipeAction, { backgroundColor: bg }]}
                    onPress={() => {
                        onAction();
                        closeSwipe();
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={styles.swipeActionText}>{label}</Text>
                </SwipeActionButton>
            );
        };

        return (
            <Animated.View style={[styles.swipeActions, { opacity }]}>
                {action(conv.isPinned ? 'Unpin' : 'Pin', 'rgba(255,255,255,0.2)', onPin, 'pin')}
                {action(
                    unread > 0 ? 'Read' : 'Unread',
                    'rgba(255,255,255,0.25)',
                    unread > 0 ? onMarkRead : onMarkUnread,
                    'read',
                )}
                {action(conv.isMuted ? 'Unmute' : 'Mute', 'rgba(255,255,255,0.15)', onToggleMute, 'mute')}
                {action(isGroup ? 'Leave' : 'Delete', 'rgba(220,38,38,0.9)', onDelete, 'delete')}
            </Animated.View>
        );
    };

    return (
        <Swipeable
            ref={swipeRef}
            friction={2}
            rightThreshold={36}
            overshootRight={false}
            containerStyle={styles.swipeHost}
            onSwipeableWillOpen={() => onSwipeOpenChange?.(rowId)}
            onSwipeableClose={() => {
                if (isSwipeOpen) onSwipeOpenChange?.(null);
            }}
            renderRightActions={renderRightActions}
        >
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleOpen}
                onLongPress={onOpenChatInfo}
                delayLongPress={280}
                style={styles.rowContainer}
            >
                <View style={styles.avatarWrapper}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={onAvatarPress || handleOpen}
                    >
                        {hasStoryRing ? (
                            <LinearGradient
                                colors={['#2DD4BF', '#0EA5E9', '#D946EF']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.storyRing}
                            >
                                <View style={styles.storyRingInner}>
                                    <Avatar
                                        src={avatarSrc}
                                        name={name}
                                        size={48}
                                        hideBorder
                                    />
                                </View>
                            </LinearGradient>
                        ) : (
                            <Avatar src={avatarSrc} name={name} size={52} hideBorder />
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.contentContainer}>
                    <View style={styles.topRow}>
                        <Text numberOfLines={1} style={styles.nameText}>
                            {name}
                        </Text>
                        <Text style={styles.timeText}>{timestamp}</Text>
                    </View>
                    <Text ellipsizeMode="tail" numberOfLines={1} style={styles.previewText}>
                        {lastMessage}
                    </Text>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    swipeHost: {
        width: '100%',
        alignSelf: 'stretch',
    },
    rowContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        backgroundColor: 'transparent',
    },
    avatarWrapper: {
        marginRight: 14,
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyRingInner: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    contentContainer: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
        minWidth: 0,
        marginRight: 8,
    },
    timeText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    previewText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    swipeActions: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    swipeAction: {
        width: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    swipeActionText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
});
