import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import type { ConversationSummary } from '../api/messages';
import { ox } from '../constants/nativeOpticalScale';

type Props = {
    visible: boolean;
    conv: ConversationSummary | null;
    avatarSrc?: string;
    onClose: () => void;
    onOpenChat: () => void;
    onViewProfile?: () => void;
    onAcceptRequest?: () => void;
    onMarkRead?: () => void;
    onMarkUnread?: () => void;
    onTogglePin?: () => void;
    onToggleMute?: () => void;
    onDeleteOrLeave?: () => void;
};

export default function InboxChatInfoSheet({
    visible,
    conv,
    avatarSrc,
    onClose,
    onOpenChat,
    onViewProfile,
    onAcceptRequest,
    onMarkRead,
    onMarkUnread,
    onTogglePin,
    onToggleMute,
    onDeleteOrLeave,
}: Props) {
    const insets = useSafeAreaInsets();
    if (!conv) return null;

    const isGroup = conv.kind === 'group' && !!conv.chatGroupId;
    const title = isGroup ? conv.groupName || 'Group' : conv.otherHandle;
    const unread = conv.unread || 0;

    const Row = ({
        icon,
        label,
        onPress,
        last,
    }: {
        icon: string;
        label: string;
        onPress?: () => void;
        last?: boolean;
    }) => {
        if (!onPress) return null;
        return (
            <TouchableOpacity
                style={[styles.row, last && styles.rowLast]}
                onPress={onPress}
                activeOpacity={0.75}
            >
                <Icon name={icon} size={ox(16)} color="rgba(255,255,255,0.55)" />
                <Text style={styles.rowLabel}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <Avatar src={isGroup ? undefined : avatarSrc} name={title} size={ox(56)} />
                        <View style={styles.headerText}>
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>
                            {!isGroup ? (
                                <Text style={styles.handleText} numberOfLines={1}>
                                    @{conv.otherHandle}
                                </Text>
                            ) : null}
                            {conv.lastMessage?.text || conv.lastMessage?.commentText ? (
                                <Text style={styles.preview} numberOfLines={1}>
                                    {conv.lastMessage.text || conv.lastMessage.commentText}
                                </Text>
                            ) : null}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                            <Icon name="close" size={ox(20)} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView bounces={false}>
                        <Row icon="chatbubble-outline" label="Open chat" onPress={onOpenChat} />
                        {!isGroup ? (
                            <Row icon="person-outline" label="View profile" onPress={onViewProfile} />
                        ) : null}
                        {conv.isRequest ? (
                            <Row icon="checkmark" label="Accept request" onPress={onAcceptRequest} />
                        ) : null}
                        {unread > 0 ? (
                            <Row icon="checkmark-done-outline" label="Mark read" onPress={onMarkRead} />
                        ) : !isGroup ? (
                            <Row icon="notifications-off-outline" label="Mark unread" onPress={onMarkUnread} />
                        ) : null}
                        {!isGroup ? (
                            <Row
                                icon="bookmark-outline"
                                label={conv.isPinned ? 'Unpin' : 'Pin'}
                                onPress={onTogglePin}
                            />
                        ) : null}
                        {!isGroup ? (
                            <Row
                                icon="notifications-off-outline"
                                label={conv.isMuted ? 'Unmute' : 'Mute'}
                                onPress={onToggleMute}
                            />
                        ) : null}
                        <Row
                            icon="trash-outline"
                            label={isGroup ? 'Leave group' : 'Delete conversation'}
                            onPress={onDeleteOrLeave}
                            last
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#000000',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        maxHeight: '85%',
        overflow: 'hidden',
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginTop: 8,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingTop: ox(8),
        paddingBottom: ox(14),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.15)',
    },
    headerText: {
        flex: 1,
        minWidth: 0,
        paddingTop: ox(2),
    },
    title: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '600',
    },
    handleText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: ox(14),
        marginTop: 2,
    },
    preview: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: ox(12),
        marginTop: ox(4),
    },
    closeBtn: {
        padding: ox(8),
        marginRight: -ox(4),
        marginTop: -ox(4),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(12),
        paddingHorizontal: ox(16),
        paddingVertical: ox(14),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    rowLabel: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '500',
    },
});
