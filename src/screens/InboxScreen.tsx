import React, { useState, useEffect, useMemo } from 'react';
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
    Image,
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
import { getStoryInsightsForUser, type StoryInsight, fetchStoryGroupByHandle } from '../api/stories';
import { getAvatarForHandle } from '../api/users';
import { setAvatarForHandle } from '../api/users';
import { fetchUserProfile } from '../api/client';
import { acceptFollowRequest as acceptFollowRequestApi, denyFollowRequest as denyFollowRequestApi } from '../api/client';
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
import { getNotificationPreferences, isNotificationTypeEnabled } from '../services/notifications';

function extractAvatarUrl(profile: any): string {
    const candidate =
        profile?.avatar_url ||
        profile?.avatarUrl ||
        profile?.profile_picture_url ||
        profile?.profilePictureUrl ||
        profile?.profile_image_url ||
        profile?.profileImageUrl ||
        profile?.user?.avatar_url ||
        profile?.user?.avatarUrl ||
        profile?.user?.profile_picture_url ||
        profile?.user?.profilePictureUrl ||
        '';
    return typeof candidate === 'string' ? candidate.trim() : '';
}

function normalizeHandleKey(handle?: string): string {
    const value = (handle || '').trim();
    if (!value) return '';
    return value.replace(/^@/, '').toLowerCase();
}

function canRenderStoryThumb(url?: string): boolean {
    if (!url) return false;
    const value = url.trim();
    if (!value) return false;
    if (/^data:image\//i.test(value)) return true;
    if (/^data:video\//i.test(value)) return false;
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(value) || /^https?:\/\//i.test(value) || /^file:\/\//i.test(value);
}

export default function InboxScreen({ navigation, route }: any) {
    const { user } = useAuth();
    const [insights, setInsights] = useState<StoryInsight[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unavailableStoryIds, setUnavailableStoryIds] = useState<Set<string>>(new Set());
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'insights' | 'notifications' | 'messages' | 'groups'>('messages');
    const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'requests' | 'pinned'>('all');
    const [conversationQuery, setConversationQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [insightAvatarMap, setInsightAvatarMap] = useState<Record<string, string>>({});
    const [dmAvatarMap, setDmAvatarMap] = useState<Record<string, string>>({});
    const avatarFetchInFlightRef = React.useRef<Set<string>>(new Set());
    const resolveInsightAvatar = React.useCallback((handle?: string): string => {
        const raw = (handle || '').trim();
        if (!raw) return '';
        const normalized = normalizeHandleKey(raw);
        return (
            insightAvatarMap[raw] ||
            insightAvatarMap[normalized] ||
            getAvatarForHandle(raw) ||
            getAvatarForHandle(normalized) ||
            getAvatarForHandle(`@${normalized}`) ||
            ''
        );
    }, [insightAvatarMap]);
    const actionableInsights = useMemo(
        () =>
            insights.filter(
                (item) =>
                    (item.views || 0) > 0 ||
                    (item.likes > 0 && Array.isArray(item.likers) && item.likers.length > 0) ||
                    ((item.question?.responseCount || 0) > 0)
            ),
        [insights]
    );

    useEffect(() => {
        loadData();
    }, [user?.handle]);

    useEffect(() => {
        const requestedTab = route?.params?.initialTab;
        if (requestedTab === 'insights' || requestedTab === 'notifications' || requestedTab === 'messages' || requestedTab === 'groups') {
            setActiveTab(requestedTab);
        }
    }, [route?.params?.initialTab]);

    useEffect(() => {
        if (user?.handle && user?.avatarUrl) {
            setAvatarForHandle(user.handle, user.avatarUrl);
            setDmAvatarMap((prev) => ({ ...prev, [user.handle]: user.avatarUrl! }));
            setInsightAvatarMap((prev) => ({ ...prev, [user.handle]: user.avatarUrl! }));
        }
    }, [user?.handle, user?.avatarUrl]);

    useEffect(() => {
        const handles = Array.from(
            new Set(
                actionableInsights
                    .flatMap((item) => [...(item.likers || []), ...(item.viewers || [])])
                    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
            )
        );
        const missing = handles.filter((handle) => !resolveInsightAvatar(handle));
        if (missing.length === 0) return;

        missing.forEach((handle) => {
            const fetchKey = normalizeHandleKey(handle) || handle;
            if (avatarFetchInFlightRef.current.has(fetchKey)) return;
            avatarFetchInFlightRef.current.add(fetchKey);
            fetchUserProfile(fetchKey, user?.id)
                .then((profile: any) => {
                    const avatarUrl = extractAvatarUrl(profile);
                    if (avatarUrl.length > 0) {
                        setAvatarForHandle(fetchKey, avatarUrl);
                        setInsightAvatarMap((prev) => ({
                            ...prev,
                            [handle]: avatarUrl,
                            [fetchKey]: avatarUrl,
                        }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    avatarFetchInFlightRef.current.delete(fetchKey);
                });
        });
    }, [actionableInsights, resolveInsightAvatar, user?.id]);

    useEffect(() => {
        const handles = Array.from(
            new Set(
                [
                    ...notifications.map((n) => n.fromHandle),
                    ...conversations.filter((c) => c.kind !== 'group').map((c) => c.otherHandle),
                ].filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
            )
        );
        const missing = handles.filter((handle) => !getAvatarForHandle(handle) && !dmAvatarMap[handle]);
        if (missing.length === 0) return;

        missing.forEach((handle) => {
            if (avatarFetchInFlightRef.current.has(handle)) return;
            avatarFetchInFlightRef.current.add(handle);
            fetchUserProfile(handle, user?.id)
                .then((profile: any) => {
                    const avatarUrl = extractAvatarUrl(profile);
                    if (avatarUrl.length > 0) {
                        setAvatarForHandle(handle, avatarUrl);
                        setDmAvatarMap((prev) => ({ ...prev, [handle]: avatarUrl }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    avatarFetchInFlightRef.current.delete(handle);
                });
        });
    }, [notifications, conversations, dmAvatarMap, user?.id]);

    const loadData = async () => {
        if (!user?.handle) return;
        setLoading(true);
        try {
            const [notifs, storyInsights] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
            ]);
            const storyReplyNotifs = notifs.filter((n) => !!n.storyId && !!n.fromHandle && !n.chatGroupId);
            if (storyReplyNotifs.length > 0) {
                const handles = Array.from(new Set(storyReplyNotifs.map((n) => n.fromHandle)));
                const groups = await Promise.all(
                    handles.map(async (handle) => {
                        try {
                            const g = await fetchStoryGroupByHandle(handle);
                            return { handle, group: g };
                        } catch {
                            return { handle, group: null };
                        }
                    })
                );
                const activeStoryIdsByHandle = new Map<string, Set<string>>();
                groups.forEach(({ handle, group }) => {
                    activeStoryIdsByHandle.set(handle, new Set((group?.stories || []).map((s) => s.id)));
                });
                const unavailable = new Set<string>();
                storyReplyNotifs.forEach((n) => {
                    if (!n.storyId) return;
                    const activeIds = activeStoryIdsByHandle.get(n.fromHandle);
                    if (!activeIds || !activeIds.has(n.storyId)) unavailable.add(n.storyId);
                });
                setUnavailableStoryIds(unavailable);
            } else {
                setUnavailableStoryIds(new Set());
            }
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

    const openLikersList = (likers: string[]) => {
        if (!Array.isArray(likers) || likers.length === 0) return;
        const options = likers.slice(0, 8).map((handle) => ({
            text: handle,
            onPress: () => navigation.navigate('ViewProfile', { handle }),
        }));
        options.push({ text: 'Cancel', onPress: () => {} });
        Alert.alert('Story likes', 'View profile', options);
    };

    const openViewersList = (viewers: string[]) => {
        if (!Array.isArray(viewers) || viewers.length === 0) return;
        const options = viewers.slice(0, 8).map((handle) => ({
            text: handle,
            onPress: () => navigation.navigate('ViewProfile', { handle }),
        }));
        options.push({ text: 'Cancel', onPress: () => {} });
        Alert.alert('Story views', 'View profile', options);
    };

    const handleNotificationPress = async (notif: Notification) => {
        const isSyntheticConvNotif = notif.id.startsWith('conv-notif-');
        if (!notif.read && user?.handle && !isSyntheticConvNotif) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        if (notif.chatGroupId && user?.handle) {
            await markGroupConversationReadById(notif.chatGroupId, user.handle);
            navigation.navigate('Messages', { chatGroupId: notif.chatGroupId, kind: 'group' });
            return;
        }
        if (notif.storyId && !unavailableStoryIds.has(notif.storyId)) {
            navigation.navigate('Stories', { openUserHandle: notif.fromHandle, openStoryId: notif.storyId });
            return;
        }
        if (notif.type === 'sticker' || notif.type === 'reply' || notif.type === 'dm') {
            navigation.navigate('Messages', { handle: notif.fromHandle });
        }
    };

    const openStoryThumbActions = (notif: Notification) => {
        if (!notif.storyId) return;
        const canOpenStory = !unavailableStoryIds.has(notif.storyId);
        const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
        if (canOpenStory) {
            options.push({
                text: 'Open story',
                onPress: () => {
                    void handleNotificationPress(notif);
                },
            });
        }
        options.push({
            text: 'View profile',
            onPress: () => navigation.navigate('ViewProfile', { handle: notif.fromHandle }),
        });
        options.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Story actions', `@${notif.fromHandle}`, options);
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

    const handleAcceptFollowRequest = async (notif: Notification) => {
        if (!user?.handle) return;
        try {
            try {
                await acceptFollowRequestApi(notif.fromHandle);
            } catch (apiError: any) {
                const isConnectionError =
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');
                if (isConnectionError) {
                    const { acceptFollowRequest: acceptFollowRequestLocal } = await import('../api/privacy');
                    acceptFollowRequestLocal(notif.fromHandle, user.handle);
                } else {
                    throw apiError;
                }
            }
            await deleteNotification(notif.id, user.handle);
            await loadData();
            Alert.alert('Follow request accepted', `You are now following ${notif.fromHandle}.`);
        } catch (error) {
            console.error('Failed to accept follow request:', error);
            Alert.alert('Error', 'Failed to accept follow request.');
        }
    };

    const handleDenyFollowRequest = async (notif: Notification) => {
        if (!user?.handle) return;
        try {
            try {
                await denyFollowRequestApi(notif.fromHandle);
            } catch (apiError: any) {
                const isConnectionError =
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');
                if (isConnectionError) {
                    const { denyFollowRequest: denyFollowRequestLocal } = await import('../api/privacy');
                    denyFollowRequestLocal(notif.fromHandle, user.handle);
                } else {
                    throw apiError;
                }
            }
            await deleteNotification(notif.id, user.handle);
            await loadData();
        } catch (error) {
            console.error('Failed to deny follow request:', error);
            Alert.alert('Error', 'Failed to deny follow request.');
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
        if (notif.storyId) {
            if (unavailableStoryIds.has(notif.storyId)) {
                const ownerLabel = notif.storyContextOwner ? `@${notif.storyContextOwner}` : 'story';
                return `Story unavailable (${ownerLabel})`;
            }
            const ownerLabel = notif.storyContextOwner ? `@${notif.storyContextOwner}` : 'a story';
            const snippet = (notif.storyContextText || '').trim();
            const replyBody = (notif.message || '').trim();
            if (snippet && replyBody) return `Reply to ${ownerLabel}: "${snippet}" - ${replyBody}`;
            if (snippet) return `Reply to ${ownerLabel}: "${snippet}"`;
            if (replyBody) return `Reply to ${ownerLabel}: ${replyBody}`;
            return `Reply to ${ownerLabel}`;
        }
        switch (notif.type) {
            case 'sticker':
                return `Sent you a sticker: ${notif.message || ''}`;
            case 'reply':
                return notif.message || 'Replied to your post';
            case 'dm':
                return notif.message || 'Sent you a message';
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

    const notificationPrefs = useMemo(() => getNotificationPreferences(), []);
    const activityNotifications = useMemo<Notification[]>(() => {
        return conversations
            .filter((conv) => {
                if (!conv.lastMessage || !conv.unread) return false;
                if (conv.kind === 'group' && conv.chatGroupId) {
                    return isNotificationTypeEnabled(notificationPrefs, 'group_chat');
                }
                if (!conv.otherHandle) return false;
                const ownMessage = conv.lastMessage.senderHandle === user?.handle;
                if (ownMessage) return false;
                return isNotificationTypeEnabled(notificationPrefs, 'dm');
            })
            .map((conv) => {
                const lastMsg = conv.lastMessage!;
                return {
                    id: `conv-notif-${conv.kind === 'group' ? conv.chatGroupId : conv.otherHandle}-${lastMsg.id}`,
                    type: 'dm' as const,
                    fromHandle: conv.kind === 'group' ? (conv.groupName || 'Group') : conv.otherHandle,
                    toHandle: user?.handle || '',
                    message: lastMsg.text,
                    storyId: lastMsg.storyId,
                    imageUrl: lastMsg.storyId ? lastMsg.imageUrl : undefined,
                    storyContextText: lastMsg.storyContextText,
                    storyContextOwner: lastMsg.storyContextOwner,
                    chatGroupId: conv.kind === 'group' ? conv.chatGroupId : undefined,
                    groupName: conv.kind === 'group' ? conv.groupName : undefined,
                    timestamp: lastMsg.timestamp,
                    read: conv.unread === 0,
                };
            });
    }, [conversations, notificationPrefs, user?.handle]);
    const allNotifications = useMemo(() => {
        return [...notifications, ...activityNotifications].sort((a, b) => b.timestamp - a.timestamp);
    }, [notifications, activityNotifications]);
    const unreadNotifications = allNotifications.filter(n => !n.read).length;
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
                    data={allNotifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleNotificationPress(item)}
                            style={[styles.item, !item.read && styles.itemUnread]}
                        >
                            <View style={styles.itemIcon}>
                                <View style={styles.notificationAvatarWrap}>
                                    <Avatar
                                        src={dmAvatarMap[item.fromHandle] || getAvatarForHandle(item.fromHandle)}
                                        name={item.fromHandle}
                                        size={40}
                                    />
                                    <View style={styles.notificationTypeBadge}>
                                        <Icon
                                            name={getNotificationIcon(item.type)}
                                            size={10}
                                            color="#111827"
                                        />
                                    </View>
                                </View>
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>{item.fromHandle}</Text>
                                <Text style={styles.itemMessage}>{formatNotificationMessage(item)}</Text>
                                {!!item.storyId && unavailableStoryIds.has(item.storyId) && (
                                    <View style={styles.storyUnavailableChip}>
                                        <Text style={styles.storyUnavailableChipText}>Story unavailable</Text>
                                    </View>
                                )}
                                <Text style={styles.itemTime}>{timeAgo(item.timestamp)}</Text>
                                {item.type === 'follow_request' && (
                                    <View style={styles.followRequestActions}>
                                        <TouchableOpacity
                                            style={[styles.followRequestBtn, styles.followRequestAcceptBtn]}
                                            onPress={() => { void handleAcceptFollowRequest(item); }}
                                        >
                                            <Text style={styles.followRequestAcceptText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.followRequestBtn, styles.followRequestDenyBtn]}
                                            onPress={() => { void handleDenyFollowRequest(item); }}
                                        >
                                            <Text style={styles.followRequestDenyText}>Deny</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            {!!item.storyId && !unavailableStoryIds.has(item.storyId) && !!item.imageUrl && (
                                <TouchableOpacity
                                    style={styles.storyThumbWrap}
                                    onPress={() => { void handleNotificationPress(item); }}
                                    onLongPress={() => openStoryThumbActions(item)}
                                    delayLongPress={280}
                                    activeOpacity={0.85}
                                >
                                    {canRenderStoryThumb(item.imageUrl) ? (
                                        <Image source={{ uri: item.imageUrl }} style={styles.storyThumbImage} resizeMode="cover" />
                                    ) : (
                                        <View style={styles.storyThumbFallback}>
                                            <Icon name="play" size={14} color="#E5E7EB" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                            {!item.id.startsWith('conv-notif-') && (
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
                            )}
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
                    data={actionableInsights}
                    keyExtractor={(item) => item.storyId}
                    renderItem={({ item }) => {
                        const primaryLiker = item.likers?.[0];
                        const primaryViewer = item.viewers?.[0];
                        const primaryHandle = primaryLiker || primaryViewer;
                        return (
                        <TouchableOpacity
                            onPress={() => {
                                if (primaryHandle) {
                                    navigation.navigate('ViewProfile', { handle: primaryHandle });
                                }
                            }}
                            style={styles.item}
                        >
                            {primaryHandle ? (
                                <Avatar
                                    src={resolveInsightAvatar(primaryHandle)}
                                    name={primaryHandle}
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
                                    {item.likes > 0 && primaryLiker ? (
                                        <>
                                            Liked by{' '}
                                            <Text
                                                style={styles.itemMessageLink}
                                                onPress={() => {
                                                    navigation.navigate('ViewProfile', { handle: primaryLiker });
                                                }}
                                            >
                                                {primaryLiker}
                                            </Text>
                                            {item.likes > 1 ? (
                                                <Text
                                                    style={styles.itemMessageLink}
                                                    onPress={() => openLikersList(item.likers || [])}
                                                >
                                                    {` and ${item.likes - 1} others`}
                                                </Text>
                                            ) : ''}
                                            {item.views > 0 ? `  •  ${item.views} views` : ''}
                                        </>
                                    ) : item.views > 0 ? (
                                        <>
                                            Viewed by{' '}
                                            <Text
                                                style={styles.itemMessageLink}
                                                onPress={() => {
                                                    if (primaryViewer) navigation.navigate('ViewProfile', { handle: primaryViewer });
                                                }}
                                            >
                                                {primaryViewer || 'people'}
                                            </Text>
                                            {item.views > 1 ? (
                                                <Text
                                                    style={styles.itemMessageLink}
                                                    onPress={() => openViewersList(item.viewers || [])}
                                                >
                                                    {` and ${item.views - 1} others`}
                                                </Text>
                                            ) : ''}
                                        </>
                                    ) : (
                                        'New story activity'
                                    )}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );}}
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
                                        <Avatar src={item.groupAvatarUrl || undefined} name={title} size={40} />
                                    ) : (
                                        <Avatar src={dmAvatarMap[item.otherHandle] || getAvatarForHandle(item.otherHandle)} name={item.otherHandle} size={40} />
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
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        gap: 10,
        position: 'relative',
    },
    itemUnread: {
        backgroundColor: '#1F2937',
    },
    itemIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationAvatarWrap: {
        width: 40,
        height: 40,
        position: 'relative',
    },
    notificationTypeBadge: {
        position: 'absolute',
        right: -1,
        bottom: -1,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#A78BFA',
        borderWidth: 1,
        borderColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowActionIcon: {
        paddingHorizontal: 6,
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
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    itemMessage: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 1,
    },
    itemMessageLink: {
        color: '#93C5FD',
        textDecorationLine: 'underline',
        fontWeight: '700',
    },
    itemTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    storyUnavailableChip: {
        alignSelf: 'flex-start',
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.45)',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    storyUnavailableChipText: {
        color: '#FCA5A5',
        fontSize: 10,
        fontWeight: '700',
    },
    storyThumbWrap: {
        width: 40,
        height: 40,
        borderRadius: 9,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
    },
    storyThumbImage: {
        width: '100%',
        height: '100%',
    },
    storyThumbFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
    },
    followRequestActions: {
        marginTop: 8,
        flexDirection: 'row',
        gap: 8,
    },
    followRequestBtn: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
    },
    followRequestAcceptBtn: {
        borderColor: '#15803D',
        backgroundColor: '#14532D',
    },
    followRequestDenyBtn: {
        borderColor: '#4B5563',
        backgroundColor: '#1F2937',
    },
    followRequestAcceptText: {
        color: '#DCFCE7',
        fontSize: 11,
        fontWeight: '700',
    },
    followRequestDenyText: {
        color: '#E5E7EB',
        fontSize: 11,
        fontWeight: '700',
    },
    unreadDot: {
        position: 'absolute',
        right: 6,
        top: 18,
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












