import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import {
    getNotifications,
    type Notification,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} from '../api/notifications';
import { getStoryInsightsForUser, type StoryInsight } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';
import Avatar from '../components/Avatar';
import {
    listConversations,
    markConversationRead,
    markConversationUnread,
    markGroupConversationReadById,
    pinConversation,
    unpinConversation,
    muteConversation,
    unmuteConversation,
    deleteConversation,
    acceptMessageRequest,
    type ConversationSummary,
} from '../api/messages';

export default function InboxScreen({ navigation }: any) {
    const { user } = useAuth();
    const [insights, setInsights] = useState<StoryInsight[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'insights' | 'notifications' | 'messages' | 'groups'>('notifications');
    const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'requests' | 'pinned'>('all');
    const [conversationQuery, setConversationQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [notifs, storyInsights] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
            ]);
            setNotifications(notifs);
            setInsights(storyInsights);
            const convs = await listConversations(user.handle);
            setConversations(convs);
        } catch (error) {
            console.error('Error loading inbox:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setRefreshing(true);
        try {
            await loadData();
        } finally {
            setRefreshing(false);
        }
    };

    const handleNotificationPress = async (notif: Notification) => {
        if (!notif.read && user?.handle) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        if (notif.type === 'sticker' || notif.type === 'reply' || notif.type === 'dm') {
            navigation.navigate('Messages', { handle: notif.fromHandle });
        }
    };

    const handleMarkAllRead = async () => {
        if (!user?.handle) return;
        try {
            await markAllNotificationsRead(user.handle);
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all notifications read:', error);
        }
    };

    const handleDeleteNotification = async (notifId: string) => {
        if (!user?.handle) return;
        try {
            await deleteNotification(notifId, user.handle);
            setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const openConversation = async (conv: ConversationSummary) => {
        if (!user?.handle) return;
        try {
            if (conv.kind === 'group' && conv.chatGroupId) {
                await markGroupConversationReadById(conv.chatGroupId, user.handle);
                navigation.navigate('Messages', { chatGroupId: conv.chatGroupId, kind: 'group' });
            } else {
                await markConversationRead(user.handle, conv.otherHandle);
                navigation.navigate('Messages', { handle: conv.otherHandle });
            }
            setConversations((prev) =>
                prev.map((c) =>
                    c.kind === conv.kind &&
                    (c.kind === 'group' ? c.chatGroupId === conv.chatGroupId : c.otherHandle === conv.otherHandle)
                        ? { ...c, unread: 0 }
                        : c
                )
            );
        } catch (error) {
            console.error('Failed to open conversation:', error);
        }
    };

    const formatNotificationMessage = (notif: Notification): string => {
        switch (notif.type) {
            case 'sticker':
                return `Sent you a sticker: ${notif.message || ''}`;
            case 'reply':
                return `Replied to your post`;
            case 'dm':
                return `Sent you a message`;
            case 'follow_request':
                return `wants to follow you`;
            default:
                return notif.message || '';
        }
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'sticker':
                return 'happy';
            case 'reply':
                return 'arrow-undo';
            case 'dm':
                return 'chatbubble';
            case 'follow_request':
                return 'person-add';
            default:
                return 'notifications';
        }
    };

    const unreadNotifications = notifications.filter(n => !n.read).length;
    const sortedConversations = [...conversations].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
    });
    const directMessages = sortedConversations.filter((c) => c.kind !== 'group');
    const groupMessages = sortedConversations.filter((c) => c.kind === 'group');
    const unreadMessages = directMessages.reduce((sum, c) => sum + (c.unread || 0), 0);
    const unreadGroups = groupMessages.reduce((sum, c) => sum + (c.unread || 0), 0);
    const filteredDirectMessages = directMessages.filter((c) => {
        if (messageFilter === 'unread') return (c.unread || 0) > 0;
        if (messageFilter === 'requests') return !!c.isRequest;
        if (messageFilter === 'pinned') return !!c.isPinned;
        return true;
    });
    const queryLower = conversationQuery.trim().toLowerCase();
    const searchedDirectMessages = filteredDirectMessages.filter((c) =>
        !queryLower ||
        c.otherHandle.toLowerCase().includes(queryLower) ||
        (c.lastMessage?.text || '').toLowerCase().includes(queryLower)
    );
    const searchedGroupMessages = groupMessages.filter((c) =>
        !queryLower ||
        (c.groupName || '').toLowerCase().includes(queryLower) ||
        (c.lastMessage?.text || '').toLowerCase().includes(queryLower)
    );

    const updateConversationRow = (target: ConversationSummary, updater: (row: ConversationSummary) => ConversationSummary) => {
        setConversations((prev) =>
            prev.map((row) => {
                const match =
                    row.kind === target.kind &&
                    (row.kind === 'group' ? row.chatGroupId === target.chatGroupId : row.otherHandle === target.otherHandle);
                return match ? updater(row) : row;
            })
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#8B5CF6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Inbox</Text>
                {activeTab === 'notifications' && unreadNotifications > 0 && (
                    <TouchableOpacity onPress={handleMarkAllRead}>
                        <Text style={styles.headerActionText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    onPress={() => setActiveTab('notifications')}
                    style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
                        Notifications
                    </Text>
                    {unreadNotifications > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadNotifications}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('insights')}
                    style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>
                        Insights
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('messages')}
                    style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>Messages</Text>
                    {unreadMessages > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('groups')}
                    style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Groups</Text>
                    {unreadGroups > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadGroups > 99 ? '99+' : unreadGroups}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'notifications' ? (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleNotificationPress(item)}
                            style={[styles.item, !item.read && styles.itemUnread]}
                        >
                            <View style={styles.itemIcon}>
                                <Icon
                                    name={getNotificationIcon(item.type)}
                                    size={24}
                                    color="#8B5CF6"
                                />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>{item.fromHandle}</Text>
                                <Text style={styles.itemMessage}>{formatNotificationMessage(item)}</Text>
                                <Text style={styles.itemTime}>{timeAgo(item.timestamp)}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() =>
                                    Alert.alert('Delete notification', 'Remove this notification?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete', style: 'destructive', onPress: () => { void handleDeleteNotification(item.id); } },
                                    ])
                                }
                                style={styles.rowActionIcon}
                            >
                                <Icon name="trash-outline" size={18} color="#6B7280" />
                            </TouchableOpacity>
                            {!item.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No notifications</Text>
                        </View>
                    }
                />
            ) : activeTab === 'insights' ? (
                <FlatList
                    data={insights}
                    keyExtractor={(item) => item.storyId}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => {}}
                            style={styles.item}
                        >
                            {item.likes > 0 && item.likers && item.likers.length > 0 ? (
                                <Avatar
                                    src={getAvatarForHandle(item.likers[0])}
                                    name={item.likers[0]}
                                    size={48}
                                />
                            ) : (
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#374151' }} />
                            )}
                            <View style={styles.itemContent}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle}>
                                        {item.text ? (item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text) : 'Story'}
                                    </Text>
                                    <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                                </View>
                                <Text style={styles.itemMessage} numberOfLines={1}>
                                    {item.likes === 0
                                        ? 'No likes yet'
                                        : item.likes === 1
                                        ? `Liked by ${item.likers[0]}`
                                        : `Liked by ${item.likers.slice(0, 2).join(', ')} and ${item.likes - 2} others`}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No story insights yet</Text>
                        </View>
                    }
                />
            ) : (
                <>
                <View style={styles.conversationSearchWrap}>
                    <Icon name="search" size={16} color="#9CA3AF" />
                    <TextInput
                        value={conversationQuery}
                        onChangeText={setConversationQuery}
                        placeholder={activeTab === 'groups' ? 'Search groups' : 'Search messages'}
                        placeholderTextColor="#6B7280"
                        style={styles.conversationSearchInput}
                    />
                    {!!conversationQuery && (
                        <TouchableOpacity onPress={() => setConversationQuery('')}>
                            <Icon name="close-circle" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
                {activeTab === 'messages' && (
                    <View style={styles.messageFiltersRow}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'unread', label: 'Unread' },
                            { id: 'requests', label: 'Requests' },
                            { id: 'pinned', label: 'Pinned' },
                        ].map((item) => {
                            const active = messageFilter === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => setMessageFilter(item.id as 'all' | 'unread' | 'requests' | 'pinned')}
                                    style={[styles.messageFilterChip, active && styles.messageFilterChipActive]}
                                >
                                    <Text style={[styles.messageFilterChipText, active && styles.messageFilterChipTextActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
                <FlatList
                    data={activeTab === 'groups' ? searchedGroupMessages : searchedDirectMessages}
                    keyExtractor={(item, idx) => `${item.kind}-${item.kind === 'group' ? item.chatGroupId || idx : item.otherHandle}`}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { void refreshData(); }}
                            tintColor="#8B5CF6"
                        />
                    }
                    renderItem={({ item }) => {
                        const isGroup = item.kind === 'group';
                        const title = isGroup ? item.groupName || 'Group chat' : item.otherHandle;
                        const subtitle = item.lastMessage?.text || (isGroup ? 'Open group' : 'Open conversation');
                        return (
                            <TouchableOpacity onPress={() => { void openConversation(item); }} style={styles.item}>
                                <View style={styles.itemIcon}>
                                    {isGroup ? (
                                        <Icon name="people" size={22} color="#8B5CF6" />
                                    ) : (
                                        <Avatar src={getAvatarForHandle(item.otherHandle)} name={item.otherHandle} size={40} />
                                    )}
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>{title}</Text>
                                    <Text style={styles.itemMessage} numberOfLines={1}>{subtitle}</Text>
                                    <Text style={styles.itemTime}>
                                        {item.lastMessage?.timestamp ? timeAgo(item.lastMessage.timestamp) : ''}
                                    </Text>
                                    {!isGroup && item.isRequest && (
                                        <Text style={styles.requestBadgeText}>Message request</Text>
                                    )}
                                </View>
                                {!isGroup && (
                                    <View style={styles.conversationActionsCol}>
                                        <TouchableOpacity
                                            style={styles.conversationActionBtn}
                                            onPress={async () => {
                                                if (!user?.handle) return;
                                                if (item.isPinned) {
                                                    await unpinConversation(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, isPinned: false }));
                                                } else {
                                                    await pinConversation(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, isPinned: true }));
                                                }
                                            }}
                                        >
                                            <Text style={styles.conversationActionText}>{item.isPinned ? 'Unpin' : 'Pin'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.conversationActionBtn}
                                            onPress={async () => {
                                                if (!user?.handle) return;
                                                if (item.isMuted) {
                                                    await unmuteConversation(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, isMuted: false }));
                                                } else {
                                                    await muteConversation(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, isMuted: true }));
                                                }
                                            }}
                                        >
                                            <Text style={styles.conversationActionText}>{item.isMuted ? 'Unmute' : 'Mute'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.conversationActionBtn}
                                            onPress={async () => {
                                                if (!user?.handle) return;
                                                if ((item.unread || 0) > 0) {
                                                    await markConversationRead(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, unread: 0 }));
                                                } else {
                                                    await markConversationUnread(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, unread: 1 }));
                                                }
                                            }}
                                        >
                                            <Text style={styles.conversationActionText}>{(item.unread || 0) > 0 ? 'Read' : 'Unread'}</Text>
                                        </TouchableOpacity>
                                        {item.isRequest && (
                                            <TouchableOpacity
                                                style={styles.conversationActionBtn}
                                                onPress={async () => {
                                                    if (!user?.handle) return;
                                                    await acceptMessageRequest(user.handle, item.otherHandle);
                                                    updateConversationRow(item, (r) => ({ ...r, isRequest: false }));
                                                }}
                                            >
                                                <Text style={styles.conversationActionText}>Accept</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.conversationActionBtn, styles.conversationDeleteBtn]}
                                            onPress={() =>
                                                Alert.alert('Delete conversation', 'Delete this conversation?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'Delete',
                                                        style: 'destructive',
                                                        onPress: async () => {
                                                            if (!user?.handle) return;
                                                            await deleteConversation(user.handle, item.otherHandle);
                                                            setConversations((prev) =>
                                                                prev.filter((r) => !(r.kind === 'dm' && r.otherHandle === item.otherHandle))
                                                            );
                                                        },
                                                    },
                                                ])
                                            }
                                        >
                                            <Text style={styles.conversationActionText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {(item.unread || 0) > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {activeTab === 'groups' ? 'No private groups yet' : 'No messages yet'}
                            </Text>
                        </View>
                    }
                />
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerActionText: {
        color: '#F8D26A',
        fontSize: 12,
        fontWeight: '700',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        gap: 6,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#8B5CF6',
        fontWeight: '600',
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 12,
    },
    itemUnread: {
        backgroundColor: '#1F2937',
    },
    itemIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1F2937',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowActionIcon: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    conversationSearchWrap: {
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#1F2937',
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    conversationSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
        paddingVertical: 8,
    },
    messageFiltersRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
    },
    messageFilterChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    messageFilterChipActive: {
        borderColor: '#8B5CF6',
        backgroundColor: '#2E1065',
    },
    messageFilterChipText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    messageFilterChipTextActive: {
        color: '#DDD6FE',
    },
    conversationActionsCol: {
        alignItems: 'flex-end',
        gap: 4,
        marginRight: 8,
    },
    conversationActionBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#4B5563',
        backgroundColor: '#111827',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    conversationDeleteBtn: {
        borderColor: '#7F1D1D',
        backgroundColor: '#450A0A',
    },
    conversationActionText: {
        color: '#E5E7EB',
        fontSize: 10,
        fontWeight: '700',
    },
    requestBadgeText: {
        marginTop: 4,
        color: '#F8D26A',
        fontSize: 11,
        fontWeight: '700',
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    itemMessage: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 2,
    },
    itemTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
    },
    unreadBadge: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#6B7280',
    },
});












