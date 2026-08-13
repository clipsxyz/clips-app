import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Image,
    ScrollView,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import InboxConversationRow, { inboxConversationRowId } from '../components/InboxConversationRow.native';
import InboxChatInfoSheet from '../components/InboxChatInfoSheet.native';
import InboxLoadingSkeleton from '../components/InboxLoadingSkeleton.native';
import { useAuth } from '../context/Auth';
import {
    getNotifications,
    type Notification,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} from '../api/notifications';
import { getStoryInsightsForUser, type StoryInsight, fetchStoryGroupByHandle, fetchFollowedUsersStoryGroups } from '../api/stories';
import type { StoryGroup } from '../types';
import { getAvatarForHandle } from '../api/users';
import { setAvatarForHandle } from '../api/users';
import { fetchUserProfile } from '../api/client';
import { acceptFollowRequest as acceptFollowRequestApi, denyFollowRequest as denyFollowRequestApi } from '../api/client';
import { getFollowedUsers } from '../api/posts';
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
import { leaveChatGroup } from '../api/client';
import { ox } from '../constants/nativeOpticalScale';
import { rootNavigationRef } from '../navigation/rootNavigationRef';

const insightsSeenKey = (handle: string) =>
    `clips:insights-seen:${String(handle || '').trim().toLowerCase()}`;

type MessageFilter = 'all' | 'groups' | 'unread' | 'requests' | 'pinned';
type InboxTab = 'messages' | 'groups' | 'notifications' | 'insights';

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
    const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<InboxTab>('messages');
    const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [insightAvatarMap, setInsightAvatarMap] = useState<Record<string, string>>({});
    const [dmAvatarMap, setDmAvatarMap] = useState<Record<string, string>>({});
    const [seenInsightIds, setSeenInsightIds] = useState<Set<string>>(new Set());
    const [openSwipeHandle, setOpenSwipeHandle] = useState<string | null>(null);
    const [inboxChatInfo, setInboxChatInfo] = useState<ConversationSummary | null>(null);
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
                    (Array.isArray(item.reactions) && item.reactions.length > 0) ||
                    (Array.isArray(item.replies) && item.replies.length > 0) ||
                    ((item.question?.responseCount || 0) > 0)
            ),
        [insights]
    );

    const loadSeenInsights = useCallback(async (handle: string) => {
        try {
            const raw = await AsyncStorage.getItem(insightsSeenKey(handle));
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) {
                setSeenInsightIds(new Set());
                return;
            }
            setSeenInsightIds(new Set(parsed.filter((v) => typeof v === 'string' && v.trim().length > 0)));
        } catch {
            setSeenInsightIds(new Set());
        }
    }, []);

    const persistSeenInsights = useCallback(async (handle: string, ids: Set<string>) => {
        try {
            await AsyncStorage.setItem(insightsSeenKey(handle), JSON.stringify(Array.from(ids)));
        } catch {
            /* ignore */
        }
    }, []);

    const markInsightSeen = useCallback(
        (storyId?: string) => {
            if (!user?.handle || !storyId) return;
            setSeenInsightIds((prev) => {
                if (prev.has(storyId)) return prev;
                const next = new Set(prev);
                next.add(storyId);
                void persistSeenInsights(user.handle, next);
                return next;
            });
        },
        [user?.handle, persistSeenInsights]
    );

    const markAllInsightsSeen = useCallback(() => {
        if (!user?.handle || insights.length === 0) return;
        const next = new Set(seenInsightIds);
        insights.forEach((insight) => {
            if (insight.storyId) next.add(insight.storyId);
        });
        setSeenInsightIds(next);
        void persistSeenInsights(user.handle, next);
    }, [user?.handle, insights, seenInsightIds, persistSeenInsights]);

    const unseenInsightsCount = useMemo(
        () => insights.filter((insight) => insight.storyId && !seenInsightIds.has(insight.storyId)).length,
        [insights, seenInsightIds]
    );

    useEffect(() => {
        loadData();
        if (user?.handle) {
            void loadSeenInsights(user.handle);
        }
    }, [user?.handle]);

    // Refresh when returning to Inbox (e.g. after sending a feed DM to Ava).
    // Keep existing rows visible — full skeleton only on first load.
    useFocusEffect(
        useCallback(() => {
            if (!user?.handle) return;
            void loadData({ silent: true });
        }, [user?.handle])
    );

    useEffect(() => {
        const requestedTab = route?.params?.initialTab;
        if (requestedTab === 'insights' || requestedTab === 'notifications' || requestedTab === 'messages' || requestedTab === 'groups') {
            setActiveTab(requestedTab);
        }
    }, [route?.params?.initialTab]);

    useEffect(() => {
        if (activeTab !== 'messages') {
            setMessageFilter('all');
        }
        setOpenSwipeHandle(null);
        setInboxChatInfo(null);
    }, [activeTab]);

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

    const loadData = async (opts?: { silent?: boolean }) => {
        if (!user?.handle) {
            setLoading(false);
            return;
        }
        const silent = opts?.silent === true;
        if (!silent) {
            setLoading(true);
        }
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

            if (user?.id) {
                try {
                    const followed = await getFollowedUsers(user.id).catch(() => [] as string[]);
                    const groups = await fetchFollowedUsersStoryGroups(user.id, followed);
                    setStoryGroups(
                        groups.map((group) => {
                            if (group.userId === user.id && user.avatarUrl) {
                                return { ...group, avatarUrl: user.avatarUrl };
                            }
                            return {
                                ...group,
                                avatarUrl: group.avatarUrl || getAvatarForHandle(group.userHandle),
                            };
                        })
                    );
                } catch (e) {
                    console.warn('Failed to load inbox story groups:', e);
                    setStoryGroups([]);
                }
            } else {
                setStoryGroups([]);
            }
        } catch (error) {
            console.error('Error loading inbox:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshData = async () => {
        setRefreshing(true);
        try {
            await loadData({ silent: true });
        } finally {
            setRefreshing(false);
        }
    };

    const openLikersList = (likers: string[]) => {
        if (!Array.isArray(likers) || likers.length === 0) return;
        const options = likers.slice(0, 8).map((label) => ({
            text: label,
            onPress: () => {
                // Labels may be "😍 handle" from reaction rows.
                const parts = label.trim().split(/\s+/);
                const maybeHandle = parts[parts.length - 1] || label;
                navigation.navigate('ViewProfile', { handle: maybeHandle });
            },
        }));
        options.push({ text: 'Cancel', onPress: () => {} });
        Alert.alert('Story reactions', 'Who interacted', options);
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

    /** Same Stories 24 open format as the feed rail (hold screen + rail swipe chain). */
    const openFollowedStoryFromRail = useCallback(
        (group: StoryGroup) => {
            const railHandles = storyGroups
                .map((g) => g.userHandle)
                .filter((h): h is string => typeof h === 'string' && h.trim().length > 0);
            const latest = [...(group.stories || [])].sort(
                (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
            )[0];
            const mediaUrl = latest?.mediaUrl;
            const isVideo =
                latest?.mediaType === 'video' ||
                (!!mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl));
            const params = {
                openUserHandle: group.userHandle,
                fromStories24Rail: true,
                skipStories24RailReturn: true,
                railHandles,
                previewThumb:
                    (!isVideo && mediaUrl) ||
                    group.avatarUrl ||
                    getAvatarForHandle(group.userHandle) ||
                    undefined,
                previewVideoUrl: isVideo && mediaUrl ? mediaUrl : undefined,
                forceRefreshAt: Date.now(),
            };
            // Stories lives on the root stack — Inbox is nested under MainTabs.
            if (rootNavigationRef.isReady()) {
                (rootNavigationRef as any).navigate('Stories', params);
                return;
            }
            navigation.navigate('Stories', params);
        },
        [navigation, storyGroups],
    );

    const navigateToMessages = (params: { handle?: string; chatGroupId?: string; kind?: string }) => {
        if (rootNavigationRef.isReady()) {
            // Messages lives on the root stack — Inbox is nested under MainTabs.
            (rootNavigationRef as any).navigate('Messages', params);
            return;
        }
        navigation.navigate('Messages', params);
    };

    const handleNotificationPress = async (notif: Notification) => {
        const isSyntheticConvNotif = notif.id.startsWith('conv-notif-');
        if (!notif.read && user?.handle && !isSyntheticConvNotif) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        // Instagram-style: comment / comment-reply → open post comments (not Messages).
        if (
            (notif.type === 'comment' || notif.type === 'reply') &&
            notif.postId &&
            !notif.storyId
        ) {
            if (rootNavigationRef.isReady()) {
                (rootNavigationRef as any).navigate('PostDetail', {
                    postId: notif.postId,
                    openComments: true,
                    focusCommentId: notif.commentId,
                });
            } else {
                navigation.navigate('PostDetail', {
                    postId: notif.postId,
                    openComments: true,
                    focusCommentId: notif.commentId,
                });
            }
            return;
        }

        if (notif.chatGroupId && user?.handle) {
            await markGroupConversationReadById(notif.chatGroupId, user.handle);
            navigateToMessages({ chatGroupId: notif.chatGroupId, kind: 'group' });
            return;
        }
        if (notif.storyId && !unavailableStoryIds.has(notif.storyId)) {
            navigation.navigate('Stories', { openUserHandle: notif.fromHandle, openStoryId: notif.storyId });
            return;
        }
        if (notif.type === 'new_post') {
            navigation.navigate('ViewProfile', {
                handle: notif.fromHandle,
                sourcePostId: notif.postId,
            });
            return;
        }
        if (notif.type === 'sticker' || notif.type === 'reply' || notif.type === 'dm') {
            navigateToMessages({ handle: notif.fromHandle });
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
                try {
                    await markGroupConversationReadById(conv.chatGroupId, user.handle);
                } catch (e) {
                    console.warn('mark group read failed', e);
                }
                navigateToMessages({ chatGroupId: conv.chatGroupId, kind: 'group' });
            } else {
                try {
                    await markConversationRead(user.handle, conv.otherHandle);
                } catch (e) {
                    console.warn('mark dm read failed', e);
                }
                navigateToMessages({ handle: conv.otherHandle });
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
            // Still attempt navigation so the row isn't a dead end.
            if (conv.kind === 'group' && conv.chatGroupId) {
                navigateToMessages({ chatGroupId: conv.chatGroupId, kind: 'group' });
            } else if (conv.otherHandle) {
                navigateToMessages({ handle: conv.otherHandle });
            }
        }
    };

    const formatNotificationMessage = (notif: Notification): string => {
        if (notif.storyId) {
            const ownerSuffix = notif.storyContextOwner ? ` from @${notif.storyContextOwner}` : '';
            const contextSuffix = notif.storyContextText ? ` - "${notif.storyContextText}"` : '';
            if (unavailableStoryIds.has(notif.storyId)) {
                return `Story unavailable${ownerSuffix}${contextSuffix}`;
            }
            const replyPreview = (notif.message || '').trim();
            return replyPreview
                ? `Replied to your 24hr story${ownerSuffix}: ${replyPreview}${contextSuffix}`
                : `Replied to your 24hr story${ownerSuffix}${contextSuffix}`;
        }
        // Post comment activity (Instagram Activity-style — not DMs)
        if (notif.type === 'comment' && notif.postId) {
            const preview = (notif.message || '').trim();
            return preview ? `Commented: ${preview}` : 'Commented on your post';
        }
        if (notif.type === 'reply' && notif.postId) {
            const preview = (notif.message || '').trim();
            return preview ? `Replied to your comment: ${preview}` : 'Replied to your comment';
        }
        switch (notif.type) {
            case 'sticker':
                return `Sent you a sticker: ${notif.message || ''}`;
            case 'reply':
                return notif.message || 'Replied to your post';
            case 'comment':
                return notif.message || 'Commented on your post';
            case 'dm':
                return notif.message || 'Sent you a message';
            case 'follow_request':
                return `wants to follow you`;
            case 'new_post':
                return notif.message || 'posted a new clip';
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
            case 'comment':
                return 'chatbubble-ellipses';
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
    const unreadMessagesTotal = unreadMessages + unreadGroups;

    const filterConversationList = (list: ConversationSummary[]) => {
        if (messageFilter === 'groups') return list.filter((c) => c.kind === 'group');
        if (messageFilter === 'unread') return list.filter((c) => (c.unread || 0) > 0);
        if (messageFilter === 'requests') return list.filter((c) => c.kind !== 'group' && !!c.isRequest);
        if (messageFilter === 'pinned') return list.filter((c) => !!c.isPinned);
        return list;
    };

    const queriedItems = sortedConversations;
    const queriedGroupItems = queriedItems.filter((c) => c.kind === 'group');
    const queriedUnreadItems = queriedItems.filter((c) => (c.unread || 0) > 0);
    const queriedRequestItems = queriedItems.filter((c) => c.kind !== 'group' && !!c.isRequest);
    const queriedPinnedItems = queriedItems.filter((c) => !!c.isPinned);

    const messagesTabItems = filterConversationList(sortedConversations);

    const pinnedSection = messagesTabItems.filter((c) => !!c.isPinned && !c.isRequest);
    const requestSection = messagesTabItems.filter((c) => c.kind !== 'group' && !!c.isRequest);
    const regularSection = messagesTabItems.filter((c) => !c.isPinned && !(c.kind !== 'group' && c.isRequest));
    const showMessageSections = activeTab === 'messages' && messageFilter === 'all';

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

    const removeConversationRow = (target: ConversationSummary) => {
        setConversations((prev) =>
            prev.filter((row) => {
                if (row.kind === 'group' || target.kind === 'group') {
                    return !(row.kind === 'group' && target.kind === 'group' && row.chatGroupId === target.chatGroupId);
                }
                return row.otherHandle !== target.otherHandle;
            })
        );
    };

    const handleTogglePin = async (item: ConversationSummary) => {
        if (!user?.handle || item.kind === 'group') return;
        if (item.isPinned) {
            await unpinConversation(user.handle, item.otherHandle);
            updateConversationRow(item, (r) => ({ ...r, isPinned: false }));
        } else {
            await pinConversation(user.handle, item.otherHandle);
            updateConversationRow(item, (r) => ({ ...r, isPinned: true }));
        }
    };

    const handleToggleMute = async (item: ConversationSummary) => {
        if (!user?.handle || item.kind === 'group') return;
        if (item.isMuted) {
            await unmuteConversation(user.handle, item.otherHandle);
            updateConversationRow(item, (r) => ({ ...r, isMuted: false }));
        } else {
            await muteConversation(user.handle, item.otherHandle);
            updateConversationRow(item, (r) => ({ ...r, isMuted: true }));
        }
    };

    const handleMarkRead = async (item: ConversationSummary) => {
        if (!user?.handle) return;
        if (item.kind === 'group' && item.chatGroupId) {
            await markGroupConversationReadById(item.chatGroupId, user.handle);
        } else {
            await markConversationRead(user.handle, item.otherHandle);
        }
        updateConversationRow(item, (r) => ({ ...r, unread: 0 }));
    };

    const handleMarkUnread = async (item: ConversationSummary) => {
        if (!user?.handle || item.kind === 'group') return;
        await markConversationUnread(user.handle, item.otherHandle);
        updateConversationRow(item, (r) => ({ ...r, unread: Math.max(1, r.unread || 1) }));
    };

    const handleAcceptRequest = async (item: ConversationSummary) => {
        if (!user?.handle || item.kind === 'group') return;
        await acceptMessageRequest(user.handle, item.otherHandle);
        updateConversationRow(item, (r) => ({ ...r, isRequest: false }));
    };

    const handleDeleteOrLeave = (item: ConversationSummary) => {
        if (!user?.handle) return;
        const isGroup = item.kind === 'group' && !!item.chatGroupId;
        Alert.alert(
            isGroup ? 'Leave group?' : 'Delete conversation?',
            isGroup
                ? `You will leave "${item.groupName || 'this group'}". You can be invited again later.`
                : `This will remove your chat with ${item.otherHandle}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isGroup ? 'Leave' : 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            try {
                                if (isGroup && item.chatGroupId) {
                                    await leaveChatGroup(item.chatGroupId);
                                } else {
                                    await deleteConversation(user.handle, item.otherHandle);
                                }
                                removeConversationRow(item);
                            } catch (e) {
                                console.error('Failed to delete/leave conversation', e);
                                Alert.alert('Error', isGroup ? 'Failed to leave group' : 'Failed to delete conversation');
                            }
                        })();
                    },
                },
            ]
        );
    };

    const openInboxChatInfo = (item: ConversationSummary) => {
        setOpenSwipeHandle(null);
        setInboxChatInfo(item);
    };

    const renderConversationRow = (item: ConversationSummary) => {
        const isGroup = item.kind === 'group';
        const rowId = inboxConversationRowId(item);
        return (
            <InboxConversationRow
                conv={item}
                viewerHandle={user?.handle}
                avatarSrc={
                    isGroup
                        ? item.groupAvatarUrl || undefined
                        : dmAvatarMap[item.otherHandle] || getAvatarForHandle(item.otherHandle)
                }
                isSwipeOpen={openSwipeHandle === rowId}
                onSwipeOpenChange={setOpenSwipeHandle}
                onPress={() => { void openConversation(item); }}
                onOpenChatInfo={() => openInboxChatInfo(item)}
                onAvatarPress={() => {
                    if (!isGroup && item.hasUnviewedStories) {
                        navigation.navigate('Stories', { openUserHandle: item.otherHandle });
                        return;
                    }
                    void openConversation(item);
                }}
                onPin={isGroup ? undefined : () => { void handleTogglePin(item); }}
                onMarkRead={() => { void handleMarkRead(item); }}
                onMarkUnread={isGroup ? undefined : () => { void handleMarkUnread(item); }}
                onToggleMute={isGroup ? undefined : () => { void handleToggleMute(item); }}
                onDelete={() => handleDeleteOrLeave(item)}
            />
        );
    };

    if (loading) {
        return (
            <GazetteerScreenShell ambient={false} style={styles.pageShell} contentStyle={styles.loadingShell}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                </View>
                <InboxLoadingSkeleton />
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambient={false} style={styles.pageShell}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            {/* Web order: stories → tabs → content */}
            {storyGroups.length > 0 ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.storiesRailScroll}
                    contentContainerStyle={styles.storiesRail}
                >
                    {storyGroups.map((group) => {
                        const hasUnviewed = (group.stories || []).some((s) => !s.hasViewed);
                        const ring = (
                            <View style={styles.storyRingInner}>
                                <Avatar
                                    src={group.avatarUrl || getAvatarForHandle(group.userHandle)}
                                    name={group.userHandle}
                                    size={ox(48)}
                                />
                            </View>
                        );
                        return (
                            <TouchableOpacity
                                key={group.userId || group.userHandle}
                                style={styles.storyRailItem}
                                onPress={() => openFollowedStoryFromRail(group)}
                            >
                                {hasUnviewed ? (
                                    <LinearGradient
                                        colors={['#2DD4BF', '#0EA5E9', '#D946EF']}
                                        start={{ x: 0, y: 1 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.storyRing}
                                    >
                                        {ring}
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.storyRing, styles.storyRingSeen]}>{ring}</View>
                                )}
                                <Text style={styles.storyRailLabel} numberOfLines={1}>
                                    {group.userHandle}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : null}

            <View style={styles.tabs}>
                <TouchableOpacity
                    onPress={() => setActiveTab('messages')}
                    style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>Messages</Text>
                    {unreadMessagesTotal > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadMessagesTotal > 9 ? '9+' : unreadMessagesTotal}</Text>
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
                            <Text style={styles.badgeText}>{unreadGroups > 9 ? '9+' : unreadGroups}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('notifications')}
                    style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>Notifs</Text>
                    {unreadNotifications > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('insights')}
                    style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
                >
                    <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>Insights</Text>
                    {unseenInsightsCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unseenInsightsCount > 9 ? '9+' : unseenInsightsCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'notifications' ? (
                <FlatList
                    key="notifications"
                    data={allNotifications}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={
                        unreadNotifications > 0 ? (
                            <View style={styles.listActionRow}>
                                <TouchableOpacity onPress={handleMarkAllRead}>
                                    <Text style={styles.headerActionText}>Mark all as read</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
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
                                        size={ox(40)}
                                    />
                                    <View style={styles.notificationTypeBadge}>
                                        <Icon
                                            name={getNotificationIcon(item.type)}
                                            size={ox(10)}
                                            color="#111827"
                                        />
                                    </View>
                                </View>
                            </View>
                            <View style={styles.itemContent}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle} numberOfLines={1}>
                                        {item.groupName || item.fromHandle}
                                    </Text>
                                    <View style={styles.notifKindChip}>
                                        <Text style={styles.notifKindChipText}>
                                            {item.chatGroupId
                                                ? 'Group'
                                                : item.postId && (item.type === 'comment' || item.type === 'reply') && !item.storyId
                                                    ? 'Comment'
                                                    : 'DM'}
                                        </Text>
                                    </View>
                                </View>
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
                                            <Icon name="play" size={ox(14)} color="#E5E7EB" />
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
                                    <Icon name="trash-outline" size={ox(18)} color="#6B7280" />
                                </TouchableOpacity>
                            )}
                            {!item.read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No notifications yet.</Text>
                        </View>
                    }
                />
            ) : activeTab === 'insights' ? (
                <FlatList
                    key="insights"
                    data={actionableInsights}
                    keyExtractor={(item) => item.storyId}
                    ListHeaderComponent={
                        unseenInsightsCount > 0 ? (
                            <View style={styles.listActionRow}>
                                <TouchableOpacity onPress={markAllInsightsSeen}>
                                    <Text style={styles.headerActionText}>Mark all seen</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => {
                        const topReaction = item.reactions?.[0];
                        const primaryLiker = item.likers?.[0] || topReaction?.userHandle;
                        const primaryReply = item.replies?.[0];
                        const primaryViewer = item.viewers?.[0];
                        const primaryHandle =
                            primaryReply?.userHandle || primaryLiker || primaryViewer;
                        const storyLabel = item.text?.trim()
                            ? item.text.length > 36
                                ? `${item.text.slice(0, 36)}…`
                                : item.text
                            : item.mediaType === 'video'
                              ? 'Video story'
                              : item.mediaUrl
                                ? 'Photo story'
                                : 'Your story';
                        const answerCount = item.question?.responseCount || 0;
                        const reactionCount = item.reactions?.length || 0;
                        const replyCount = item.replies?.length || 0;

                        let activityLine: React.ReactNode = 'New story activity';
                        if (answerCount > 0) {
                            activityLine =
                                answerCount === 1 ? '1 answer on your question' : `${answerCount} answers on your question`;
                        } else if (replyCount > 0 && primaryReply) {
                            activityLine = (
                                <>
                                    <Text style={styles.itemMessageStrong}>{primaryReply.userHandle}</Text>
                                    {replyCount > 1 ? ` and ${replyCount - 1} others replied` : ' replied to your story'}
                                    {primaryReply.text ? `: “${primaryReply.text.slice(0, 40)}${primaryReply.text.length > 40 ? '…' : ''}”` : ''}
                                </>
                            );
                        } else if (reactionCount > 0 && topReaction) {
                            activityLine = (
                                <>
                                    <Text style={styles.itemMessageStrong}>{topReaction.userHandle}</Text>
                                    {reactionCount > 1
                                        ? ` and ${reactionCount - 1} others reacted ${topReaction.emoji}`
                                        : ` reacted ${topReaction.emoji} to your story`}
                                </>
                            );
                        } else if (item.likes > 0 && primaryLiker) {
                            activityLine = (
                                <>
                                    <Text style={styles.itemMessageStrong}>{primaryLiker}</Text>
                                    {item.likes > 1 ? ` and ${item.likes - 1} others liked your story` : ' liked your story'}
                                </>
                            );
                        } else if (item.views > 0) {
                            activityLine = (
                                <>
                                    Viewed by{' '}
                                    <Text style={styles.itemMessageStrong}>{primaryViewer || 'people'}</Text>
                                    {item.views > 1 ? ` and ${item.views - 1} others` : ''}
                                </>
                            );
                        }

                        return (
                        <TouchableOpacity
                            onPress={() => {
                                markInsightSeen(item.storyId);
                                // Instagram: open the story that got the activity.
                                navigation.navigate('Stories', {
                                    openUserHandle: user?.handle,
                                    openStoryId: item.storyId,
                                });
                            }}
                            style={[
                                styles.item,
                                item.storyId && !seenInsightIds.has(item.storyId) ? styles.itemUnread : null,
                            ]}
                        >
                            {item.mediaUrl && item.mediaType !== 'video' ? (
                                <Image source={{ uri: item.mediaUrl }} style={styles.insightThumb} />
                            ) : item.text?.trim() ? (
                                <View style={styles.insightThumbText}>
                                    <Text style={styles.insightThumbTextInner} numberOfLines={3}>
                                        {item.text.trim()}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.insightThumbFallback}>
                                    <Icon name="images-outline" size={ox(18)} color="#9CA3AF" />
                                </View>
                            )}
                            <View style={styles.itemContent}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemTitle} numberOfLines={1}>{storyLabel}</Text>
                                    <Text style={styles.itemTime}>
                                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <Text style={styles.itemMessage} numberOfLines={2}>
                                    {activityLine}
                                </Text>
                                {(reactionCount > 1 || (item.likers?.length || 0) > 1) ? (
                                    <TouchableOpacity
                                        onPress={() =>
                                            openLikersList(
                                                item.reactions?.length
                                                    ? item.reactions.map((r) => `${r.emoji} ${r.userHandle}`)
                                                    : item.likers || [],
                                            )
                                        }
                                        hitSlop={8}
                                    >
                                        <Text style={styles.itemMessageLink}>See who reacted</Text>
                                    </TouchableOpacity>
                                ) : primaryHandle ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (replyCount > 0 && primaryReply) {
                                                navigateToMessages({ handle: primaryReply.userHandle });
                                                return;
                                            }
                                            navigation.navigate('ViewProfile', { handle: primaryHandle });
                                        }}
                                        hitSlop={8}
                                    >
                                        <Text style={styles.itemMessageLink}>
                                            {replyCount > 0 ? 'Open reply in Messages' : 'View profile'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    );}}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No story activity from others yet.</Text>
                            <Text style={[styles.emptyText, { marginTop: 8, opacity: 0.7, fontSize: ox(12) }]}>
                                Replies and reactions from other people show in Messages. Insights list which of your stories got activity.
                            </Text>
                        </View>
                    }
                />
            ) : activeTab === 'groups' ? (
                <FlatList
                    key="groups"
                    data={groupMessages}
                    keyExtractor={(item, idx) => `group-${item.chatGroupId || idx}`}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { void refreshData(); }}
                            tintColor="#FFFFFF"
                        />
                    }
                    renderItem={({ item }) => renderConversationRow(item)}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                No group chats yet. Use New group on your profile or Create group on your own post (⋯ menu), then invite people from the + button in the group or from their profile.
                            </Text>
                        </View>
                    }
                />
            ) : (
                <>
                {queriedItems.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.messageFiltersScroll}
                        contentContainerStyle={styles.messageFiltersRow}
                    >
                        {[
                            { id: 'all' as const, label: `All (${queriedItems.length})` },
                            { id: 'groups' as const, label: `Groups (${queriedGroupItems.length})` },
                            { id: 'unread' as const, label: `Unread (${queriedUnreadItems.length})` },
                            { id: 'requests' as const, label: `Requests (${queriedRequestItems.length})` },
                            { id: 'pinned' as const, label: `Pinned (${queriedPinnedItems.length})` },
                        ].map((item) => {
                            const active = messageFilter === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => setMessageFilter(item.id)}
                                    style={[styles.messageFilterChip, active && styles.messageFilterChipActive]}
                                >
                                    <Text style={[styles.messageFilterChipText, active && styles.messageFilterChipTextActive]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}
                <FlatList
                    key={`messages-${messageFilter}`}
                    data={
                        showMessageSections
                            ? [...pinnedSection, ...requestSection, ...regularSection]
                            : messagesTabItems
                    }
                    keyExtractor={(item, idx) => inboxConversationRowId(item) || String(idx)}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { void refreshData(); }}
                            tintColor="#FFFFFF"
                        />
                    }
                    renderItem={({ item, index }) => {
                        const showPinnedHeader =
                            showMessageSections && index === 0 && pinnedSection.length > 0 && item.isPinned;
                        const showRequestsHeader =
                            showMessageSections &&
                            pinnedSection.length === index &&
                            requestSection.length > 0 &&
                            !!item.isRequest;
                        const showRegularHeader =
                            showMessageSections &&
                            pinnedSection.length + requestSection.length === index &&
                            regularSection.length > 0 &&
                            !item.isPinned &&
                            !item.isRequest;

                        return (
                            <View>
                                {showPinnedHeader ? <Text style={styles.sectionHeader}>Pinned</Text> : null}
                                {showRequestsHeader ? <Text style={styles.sectionHeader}>Message Requests</Text> : null}
                                {showRegularHeader ? <Text style={styles.sectionHeader}>Messages</Text> : null}
                                {renderConversationRow(item)}
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No messages yet.</Text>
                        </View>
                    }
                />
                </>
            )}

            <InboxChatInfoSheet
                visible={!!inboxChatInfo}
                conv={inboxChatInfo}
                avatarSrc={
                    inboxChatInfo && inboxChatInfo.kind !== 'group'
                        ? dmAvatarMap[inboxChatInfo.otherHandle] || getAvatarForHandle(inboxChatInfo.otherHandle)
                        : undefined
                }
                onClose={() => setInboxChatInfo(null)}
                onOpenChat={() => {
                    const c = inboxChatInfo;
                    setInboxChatInfo(null);
                    if (c) void openConversation(c);
                }}
                onViewProfile={
                    inboxChatInfo && inboxChatInfo.kind !== 'group'
                        ? () => {
                              const handle = inboxChatInfo.otherHandle;
                              setInboxChatInfo(null);
                              navigation.navigate('ViewProfile', { handle });
                          }
                        : undefined
                }
                onAcceptRequest={
                    inboxChatInfo?.isRequest
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) void handleAcceptRequest(c);
                          }
                        : undefined
                }
                onMarkRead={
                    inboxChatInfo && (inboxChatInfo.unread || 0) > 0
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) void handleMarkRead(c);
                          }
                        : undefined
                }
                onMarkUnread={
                    inboxChatInfo && inboxChatInfo.kind !== 'group' && !(inboxChatInfo.unread || 0)
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) void handleMarkUnread(c);
                          }
                        : undefined
                }
                onTogglePin={
                    inboxChatInfo && inboxChatInfo.kind !== 'group'
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) void handleTogglePin(c);
                          }
                        : undefined
                }
                onToggleMute={
                    inboxChatInfo && inboxChatInfo.kind !== 'group'
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) void handleToggleMute(c);
                          }
                        : undefined
                }
                onDeleteOrLeave={
                    inboxChatInfo
                        ? () => {
                              const c = inboxChatInfo;
                              setInboxChatInfo(null);
                              if (c) handleDeleteOrLeave(c);
                          }
                        : undefined
                }
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    pageShell: {
        backgroundColor: '#070a12',
    },
    loadingShell: {
        flex: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
    },
    header: {
        paddingHorizontal: ox(12),
        paddingTop: ox(8),
        paddingBottom: ox(12),
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: ox(20),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerActionText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '500',
    },
    listActionRow: {
        alignItems: 'flex-end',
        paddingHorizontal: ox(12),
        paddingBottom: ox(8),
        paddingTop: ox(4),
    },
    storiesRail: {
        paddingHorizontal: ox(12),
        paddingBottom: ox(4),
        gap: ox(12),
        alignItems: 'flex-start',
    },
    storiesRailScroll: {
        flexGrow: 0,
        height: ox(84),
        marginBottom: ox(8),
    },
    storyRailItem: {
        width: ox(72),
        alignItems: 'center',
        gap: ox(4),
    },
    storyRing: {
        width: ox(56),
        height: ox(56),
        borderRadius: ox(28),
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    storyRingSeen: {
        backgroundColor: 'rgba(255,255,255,0.2)',
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
    storyRailLabel: {
        maxWidth: ox(72),
        fontSize: ox(11),
        color: '#D1D5DB',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937',
        marginBottom: ox(8),
        backgroundColor: 'transparent',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ox(6),
        gap: ox(4),
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#FFFFFF',
    },
    tabText: {
        fontSize: ox(12),
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    badge: {
        backgroundColor: '#FFFFFF',
        borderRadius: ox(10),
        minWidth: ox(16),
        height: ox(16),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ox(4),
    },
    badgeText: {
        color: '#111827',
        fontSize: ox(9),
        fontWeight: '700',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ox(8),
        paddingVertical: ox(12),
        marginHorizontal: ox(4),
        borderRadius: ox(8),
        gap: ox(10),
        position: 'relative',
    },
    itemUnread: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderLeftWidth: 4,
        borderLeftColor: '#FFFFFF',
    },
    insightThumb: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(10),
        backgroundColor: '#1F2937',
    },
    insightThumbText: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(10),
        backgroundColor: '#1e3a5f',
        padding: ox(5),
        justifyContent: 'center',
    },
    insightThumbTextInner: {
        color: '#E5E7EB',
        fontSize: ox(8),
        lineHeight: ox(10),
        fontWeight: '600',
    },
    insightThumbFallback: {
        width: ox(48),
        height: ox(48),
        borderRadius: ox(10),
        backgroundColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemMessageStrong: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    conversationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ox(6),
        paddingVertical: ox(10),
        marginHorizontal: ox(8),
        marginBottom: ox(2),
        borderRadius: ox(8),
        backgroundColor: '#070a12',
        gap: ox(10),
    },
    conversationRowUnread: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    conversationTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(6),
        minWidth: 0,
    },
    conversationMetaCol: {
        alignItems: 'flex-end',
        gap: ox(4),
        flexShrink: 0,
    },
    moreBtn: {
        padding: ox(6),
    },
    sectionHeader: {
        color: '#9CA3AF',
        fontSize: ox(11),
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        paddingHorizontal: ox(14),
        paddingTop: ox(10),
        paddingBottom: ox(6),
    },
    requestBadgeText: {
        marginTop: ox(4),
        color: '#F8D26A',
        fontSize: ox(11),
        fontWeight: '700',
    },
    itemContent: {
        flex: 1,
        minWidth: 0,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: ox(4),
        gap: ox(8),
    },
    itemTitle: {
        fontSize: ox(13),
        fontWeight: '600',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    itemMessage: {
        fontSize: ox(11),
        color: '#6B7280',
        marginTop: 1,
    },
    itemMessageLink: {
        color: '#7DD3FC',
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
    itemTime: {
        fontSize: ox(10),
        color: '#9CA3AF',
    },
    itemIcon: {
        flexShrink: 0,
    },
    notifKindChip: {
        paddingHorizontal: ox(6),
        paddingVertical: ox(2),
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    notifKindChipText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: ox(9),
        fontWeight: '700',
    },
    storyUnavailableChip: {
        alignSelf: 'flex-start',
        marginTop: ox(6),
        borderRadius: ox(6),
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
        backgroundColor: 'rgba(239,68,68,0.1)',
        paddingHorizontal: ox(6),
        paddingVertical: ox(4),
    },
    storyUnavailableChipText: {
        color: '#FCA5A5',
        fontSize: ox(10),
    },
    notificationAvatarWrap: {
        position: 'relative',
    },
    notificationTypeBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: ox(18),
        height: ox(18),
        borderRadius: ox(9),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#070a12',
    },
    followRequestActions: {
        flexDirection: 'row',
        gap: ox(8),
        marginTop: ox(8),
    },
    followRequestBtn: {
        borderRadius: ox(8),
        paddingHorizontal: ox(12),
        paddingVertical: ox(6),
    },
    followRequestAcceptBtn: {
        backgroundColor: '#FFFFFF',
    },
    followRequestDenyBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    followRequestAcceptText: {
        color: '#111827',
        fontSize: ox(12),
        fontWeight: '700',
    },
    followRequestDenyText: {
        color: '#E5E7EB',
        fontSize: ox(12),
        fontWeight: '600',
    },
    storyThumbWrap: {
        width: ox(44),
        height: ox(56),
        borderRadius: ox(6),
        overflow: 'hidden',
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
    },
    rowActionIcon: {
        paddingHorizontal: ox(6),
        paddingVertical: ox(4),
    },
    messageFiltersScroll: {
        flexGrow: 0,
        maxHeight: ox(44),
    },
    messageFiltersRow: {
        flexDirection: 'row',
        gap: ox(6),
        paddingHorizontal: ox(12),
        paddingVertical: ox(8),
        alignItems: 'center',
    },
    messageFilterChip: {
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
        minHeight: ox(32),
        justifyContent: 'center',
    },
    messageFilterChipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    messageFilterChipText: {
        color: '#D1D5DB',
        fontSize: ox(10),
        fontWeight: '600',
    },
    messageFilterChipTextActive: {
        color: '#111827',
    },
    unreadDot: {
        position: 'absolute',
        right: ox(10),
        top: ox(18),
        width: 8,
        height: 8,
        borderRadius: ox(4),
        backgroundColor: '#FFFFFF',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    emptyText: {
        fontSize: ox(14),
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: ox(20),
        paddingHorizontal: ox(12),
    },
});












