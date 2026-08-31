import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { timeAgo } from '../utils/timeAgo';
import type { ConversationSummary } from '../api/messages';
import { ox } from '../constants/nativeOpticalScale';

function sameDmHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export function inboxConversationRowId(conv: ConversationSummary): string {
    if (conv.kind === 'group' && conv.chatGroupId) return `g:${conv.chatGroupId}`;
    return conv.otherHandle;
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
                return ctx.replace(/your story/i, 'their story').replace(/^Reacted/, 'You reacted').replace(/^Replied/, 'You replied');
            }
            return ctx;
        }
        return fromMe ? 'You replied to their story' : 'Replied to your story';
    }
    if (last.text?.trim()) return last.text;
    if (last.commentText?.trim()) return `Commented: ${last.commentText}`;
    if (last.imageUrl) return 'Photo';
    if (last.audioUrl) return 'Audio';
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
    const title = isGroup ? conv.groupName || 'Group chat' : conv.otherHandle;
    const subtitle = conversationPreviewText(conv, viewerHandle);
    const unread = conv.unread || 0;

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
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const opacity = dragX.interpolate({
            inputRange: [-220, -40, 0],
            outputRange: [1, 0.85, 0],
            extrapolate: 'clamp',
        });

        const action = (
            label: string,
            bg: string,
            onAction?: () => void,
            key?: string
        ) => {
            if (!onAction) return null;
            return (
                <TouchableOpacity
                    key={key || label}
                    style={[styles.swipeAction, { backgroundColor: bg }]}
                    onPress={() => {
                        onAction();
                        closeSwipe();
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={styles.swipeActionText}>{label}</Text>
                </TouchableOpacity>
            );
        };

        return (
            <Animated.View style={[styles.swipeActions, { opacity }]}>
                {action(conv.isPinned ? 'Unpin' : 'Pin', 'rgba(255,255,255,0.2)', onPin, 'pin')}
                {action(
                    unread > 0 ? 'Read' : 'Unread',
                    'rgba(255,255,255,0.25)',
                    unread > 0 ? onMarkRead : onMarkUnread,
                    'read'
                )}
                {action(conv.isMuted ? 'Unmute' : 'Mute', 'rgba(255,255,255,0.15)', onToggleMute, 'mute')}
                {action(isGroup ? 'Leave' : 'Delete', 'rgba(220,38,38,0.9)', onDelete, 'delete')}
            </Animated.View>
        );
    };

    return (
        <View style={styles.wrap}>
            <Swipeable
                ref={swipeRef}
                friction={2}
                rightThreshold={36}
                overshootRight={false}
                onSwipeableWillOpen={() => onSwipeOpenChange?.(rowId)}
                onSwipeableClose={() => {
                    if (isSwipeOpen) onSwipeOpenChange?.(null);
                }}
                renderRightActions={renderRightActions}
            >
                <View style={[styles.row, unread > 0 && styles.rowUnread]}>
                    <TouchableOpacity
                        onPress={onAvatarPress || handleOpen}
                        activeOpacity={0.85}
                        style={styles.avatarWrap}
                    >
                        <Avatar
                            src={avatarSrc}
                            name={title}
                            size={ox(44)}
                            hasStory={!isGroup && !!conv.hasUnviewedStories}
                        />
                    </TouchableOpacity>
                    <Pressable
                        onPress={handleOpen}
                        onLongPress={onOpenChatInfo}
                        delayLongPress={280}
                        style={styles.content}
                    >
                        <View style={styles.titleRow}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            {!!conv.isPinned && <Icon name="bookmark" size={ox(12)} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                        {!isGroup && conv.isRequest ? (
                            <Text style={styles.requestBadge}>Message request</Text>
                        ) : null}
                    </Pressable>
                    <Pressable
                        onPress={handleOpen}
                        onLongPress={onOpenChatInfo}
                        delayLongPress={280}
                        style={styles.meta}
                    >
                        <Text style={styles.time}>
                            {conv.lastMessage?.timestamp ? timeAgo(conv.lastMessage.timestamp) : ''}
                        </Text>
                        {unread > 0 ? (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                            </View>
                        ) : null}
                    </Pressable>
                    <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => {
                            closeSwipe();
                            onOpenChatInfo();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Icon name="ellipsis-horizontal" size={ox(16)} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </Swipeable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: 'hidden',
        marginHorizontal: ox(8),
        marginBottom: ox(2),
        borderRadius: ox(8),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ox(6),
        paddingVertical: ox(10),
        backgroundColor: '#070a12',
        gap: ox(10),
        borderRadius: ox(8),
    },
    rowUnread: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    avatarWrap: {
        flexShrink: 0,
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        minWidth: 0,
    },
    title: {
        fontSize: ox(13),
        fontWeight: '600',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    subtitle: {
        fontSize: ox(11),
        color: '#6B7280',
        marginTop: 1,
    },
    requestBadge: {
        marginTop: ox(4),
        color: '#F8D26A',
        fontSize: ox(11),
        fontWeight: '700',
    },
    meta: {
        alignItems: 'flex-end',
        gap: ox(4),
        flexShrink: 0,
        paddingVertical: ox(4),
    },
    time: {
        fontSize: ox(10),
        color: '#9CA3AF',
    },
    unreadBadge: {
        backgroundColor: '#FFFFFF',
        borderRadius: ox(10),
        minWidth: ox(18),
        height: ox(18),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ox(6),
    },
    unreadBadgeText: {
        color: '#111827',
        fontSize: ox(10),
        fontWeight: '700',
    },
    moreBtn: {
        padding: ox(8),
        zIndex: 2,
    },
    swipeActions: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    swipeAction: {
        width: ox(56),
        justifyContent: 'center',
        alignItems: 'center',
    },
    swipeActionText: {
        color: '#FFFFFF',
        fontSize: ox(11),
        fontWeight: '600',
    },
});
