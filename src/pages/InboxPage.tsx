import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMessageCircle, FiCornerUpLeft, FiSmile, FiUserPlus, FiX, FiPlus, FiCheck } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle } from '../api/users';
import { getNotifications, type Notification, type NotificationType, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, deleteNotification } from '../api/notifications';
import { getStoryInsightsForUser, type StoryInsight } from '../api/stories';
import { listConversations, seedMockDMs, type ConversationSummary, pinConversation, unpinConversation, acceptMessageRequest } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { acceptFollowRequest as acceptFollowRequestLocal, denyFollowRequest as denyFollowRequestLocal, removeFollowRequest } from '../api/privacy';
import { showToast } from '../utils/toast';
import { getFollowedUsers } from '../api/posts';
import { FiBookmark } from 'react-icons/fi';
import { toggleFollow, acceptFollowRequest, denyFollowRequest } from '../api/client';
import { getSocket } from '../services/socketio';

// Conversation Item Component
function ConversationItem({ 
    conv, 
    onPin, 
    onAcceptRequest,
    navigate,
    currentUserHandle,
    onFollow
}: { 
    conv: ConversationSummary; 
    onPin?: () => void;
    onAcceptRequest?: () => void;
    navigate: any;
    currentUserHandle?: string;
    onFollow?: (handle: string) => Promise<void>;
}) {
    const isCurrentUser = currentUserHandle === conv.otherHandle;
    const hasStory = conv.hasUnviewedStories || false;
    const isFollowing = conv.isFollowing || false;
    const [showFollowCheck, setShowFollowCheck] = React.useState(isFollowing);

    // Show follow checkmark briefly after following
    React.useEffect(() => {
        if (isFollowing) {
            setShowFollowCheck(true);
        } else {
            setShowFollowCheck(false);
        }
    }, [isFollowing]);

    const handleAvatarClick = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (hasStory) {
            // Navigate to stories page with state to auto-open this user's stories
            navigate('/stories', { state: { openUserHandle: conv.otherHandle } });
        } else {
            // Navigate to DM conversation
            navigate(`/messages/${encodeURIComponent(conv.otherHandle)}`);
        }
    };

    const handleFollowClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onFollow) {
            await onFollow(conv.otherHandle);
        }
    };

    const handleConversationClick = () => {
        navigate(`/messages/${encodeURIComponent(conv.otherHandle)}`);
    };

    return (
        <div className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
            {/* Avatar with story/follow - separate from conversation button */}
            <div className="relative overflow-visible flex-shrink-0">
                <Avatar
                    name={conv.otherHandle}
                    src={getAvatarForHandle(conv.otherHandle)}
                    size="md"
                    hasStory={hasStory}
                    onClick={handleAvatarClick}
                />
                {/* + icon overlay on profile picture to follow (TikTok style) */}
                {!isCurrentUser && onFollow && (isFollowing === false || isFollowing === undefined) && (
                    <button
                        onClick={handleFollowClick}
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-white dark:border-gray-900 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg z-30"
                        aria-label="Follow user"
                    >
                        <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </button>
                )}
                {/* Checkmark icon when following (replaces + icon) */}
                {!isCurrentUser && onFollow && isFollowing && showFollowCheck && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-lg z-30">
                        <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                )}
            </div>
            {/* Conversation content - clickable to open DM */}
            <button
                onClick={handleConversationClick}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{conv.otherHandle}</span>
                        {conv.isPinned && (
                            <FiBookmark className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />
                        )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {conv.lastMessage?.text || 'Photo'}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-[10px] text-gray-400">
                        {conv.lastMessage ? timeAgo(conv.lastMessage.timestamp) : ''}
                    </div>
                    {conv.unread > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full min-w-[18px] text-center">
                            {conv.unread > 9 ? '9+' : conv.unread}
                        </span>
                    )}
                </div>
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {conv.isRequest && onAcceptRequest && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAcceptRequest();
                        }}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                        title="Accept"
                    >
                        <span className="text-lg">✓</span>
                    </button>
                )}
                {onPin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPin();
                        }}
                        className={`p-2 rounded-full transition-colors ${
                            conv.isPinned 
                                ? 'text-blue-500 hover:bg-gray-700' 
                                : 'text-gray-400 hover:bg-gray-700 opacity-0 group-hover:opacity-100'
                        }`}
                        title={conv.isPinned ? 'Unpin' : 'Pin conversation'}
                    >
                        <FiBookmark className={`w-4 h-4 ${conv.isPinned ? 'fill-current' : ''}`} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function InboxPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [insights, setInsights] = React.useState<StoryInsight[]>([]);
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'insights' | 'notifications' | 'messages'>('notifications');
    const [selectedQuestionInsight, setSelectedQuestionInsight] = React.useState<StoryInsight | null>(null);

    const loadData = React.useCallback(async () => {
        if (!user?.handle) return;
        try {
            const [notifs, storyInsights, conversations, followedUsers] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
                listConversations(user.handle),
                user?.id ? getFollowedUsers(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[])
            ]);
            
            // Add follow status to conversations
            const conversationsWithFollowStatus = conversations.map(conv => ({
                ...conv,
                isFollowing: (followedUsers as string[]).includes(conv.otherHandle)
            }));
            
            // Convert conversations to notifications format so they appear in Notifs tab
            // Only include conversations where the OTHER person sent the last message (not the user)
            const existingNotifHandles = new Set(notifs.filter(n => n.type === 'dm' || n.type === 'sticker' || n.type === 'reply').map(n => n.fromHandle));
            const conversationNotifications: Notification[] = conversations
                .filter(conv => {
                    // Only include if:
                    // 1. Has a last message
                    // 2. The OTHER person sent the last message (not the user)
                    // 3. Doesn't already have a notification for this handle
                    if (!conv.lastMessage) return false;
                    if (conv.lastMessage.senderHandle === user.handle) return false; // User sent it, don't create notification
                    if (existingNotifHandles.has(conv.otherHandle)) return false; // Already has notification
                    return true;
                })
                .map(conv => {
                    // TypeScript: we know lastMessage exists and was sent by other person because of the filter above
                    const lastMsg = conv.lastMessage!;
                    return {
                        id: `conv-${conv.otherHandle}-${lastMsg.timestamp || Date.now()}`,
                        type: 'dm' as const,
                        fromHandle: conv.otherHandle,
                        toHandle: user.handle,
                        message: lastMsg.text || '',
                        timestamp: lastMsg.timestamp || Date.now(),
                        read: conv.unread === 0 // Mark as read if no unread messages
                    };
                });
            
            // Combine notifications and conversations, sorted by timestamp (newest first)
            const allNotifications = [...notifs, ...conversationNotifications].sort((a, b) => b.timestamp - a.timestamp);
            
            setNotifications(allNotifications);
            setInsights(storyInsights);
            setItems(conversationsWithFollowStatus);
            setLoading(false);
        } catch (error) {
            console.error('Error loading inbox data:', error);
            setNotifications([]);
            setInsights([]);
            setItems([]);
            setLoading(false);
        }
    }, [user?.handle, user?.id]);

    React.useEffect(() => {
        if (!user?.handle) return;
        loadData();

        const onNotificationUpdate = () => {
            getNotifications(user!.handle!).then(setNotifications);
        };
        const onConversationUpdate = () => {
            listConversations(user!.handle!).then(setItems);
        };

        window.addEventListener('notificationsUpdated', onNotificationUpdate as any);
        window.addEventListener('conversationUpdated', onConversationUpdate as any);
        
        // Also listen to Socket.IO events if connected
        const socket = getSocket();
        if (socket) {
            const handleSocketUpdate = (data: any) => {
                window.dispatchEvent(new CustomEvent('conversationUpdated', { detail: data }));
            };
            socket.on('conversationUpdated', handleSocketUpdate);
            socket.on('inboxUnreadChanged', (data: any) => {
                window.dispatchEvent(new CustomEvent('inboxUnreadChanged', { detail: data }));
            });
            
            return () => {
                window.removeEventListener('notificationsUpdated', onNotificationUpdate as any);
                window.removeEventListener('conversationUpdated', onConversationUpdate as any);
                socket.off('conversationUpdated', handleSocketUpdate);
                socket.off('inboxUnreadChanged');
            };
        }
        
        return () => {
            window.removeEventListener('notificationsUpdated', onNotificationUpdate as any);
            window.removeEventListener('conversationUpdated', onConversationUpdate as any);
        };
    }, [user?.handle, loadData]);

    const handleFollow = React.useCallback(async (handle: string) => {
        if (!user?.handle || !user?.id) return;
        
        try {
            const { getState } = await import('../api/posts');
            const { isProfilePrivate, createFollowRequest, hasPendingFollowRequest } = await import('../api/privacy');
            const { createNotification } = await import('../api/notifications');
            
            // Check if already following
            const s = getState(user.id);
            const wasFollowing = s.follows[handle] === true;
            
            // If already following, just unfollow
            if (wasFollowing) {
                s.follows[handle] = false;
                try {
                    const result = await toggleFollow(handle);
                    if (result && typeof result.following === 'boolean') {
                        s.follows[handle] = result.following;
                    }
                } catch (apiError) {
                    console.warn('API follow failed, using local state:', apiError);
                }
                await loadData();
                return;
            }
            
            // Check if profile is private
            const profilePrivate = isProfilePrivate(handle);
            const hasPending = hasPendingFollowRequest(user.handle, handle);
            
            // If profile is private and already has pending request, show message
            if (profilePrivate && hasPending) {
                Swal.fire(bottomSheet({
                    title: 'Follow Request Already Sent',
                    message: `You have already sent a follow request to ${handle}. You will be notified when they respond.`,
                    icon: 'alert',
                }));
                return;
            }
            
            // If profile is private and not already pending, create follow request
            if (profilePrivate && !hasPending) {
                try {
                    const encodedHandle = encodeURIComponent(handle);
                    const result = await toggleFollow(encodedHandle);
                    
                    if (result.status === 'pending') {
                        createFollowRequest(user.handle, handle);
                        
                        // Create notification
                        try {
                            await createNotification({
                                type: 'follow_request',
                                fromHandle: user.handle,
                                toHandle: handle,
                                message: `${user.handle} wants to follow you`
                            });
                        } catch (error) {
                            console.warn('Failed to create follow request notification:', error);
                        }
                        
                        Swal.fire(bottomSheet({
                            title: 'Follow Request Sent',
                            message: 'Your follow request has been sent. You will be notified when they accept.',
                            icon: 'alert',
                        }));
                        
                        await loadData();
                        return;
                    } else if (result.status === 'accepted' || result.following === true) {
                        // Public profile - follow immediately
                        s.follows[handle] = true;
                    }
                } catch (apiError: any) {
                    const isConnectionError = 
                        apiError?.message === 'CONNECTION_REFUSED' ||
                        apiError?.name === 'ConnectionRefused' ||
                        apiError?.message?.includes('Failed to fetch');
                    
                    if (isConnectionError && profilePrivate) {
                        // Mock fallback for private profile
                        createFollowRequest(user.handle, handle);
                        
                        try {
                            await createNotification({
                                type: 'follow_request',
                                fromHandle: user.handle,
                                toHandle: handle,
                                message: `${user.handle} wants to follow you`
                            });
                        } catch (error) {
                            console.warn('Failed to create follow request notification:', error);
                        }
                        
                        Swal.fire(bottomSheet({
                            title: 'Follow Request Sent',
                            message: 'Your follow request has been sent. You will be notified when they accept.',
                            icon: 'alert',
                        }));
                        
                        await loadData();
                        return;
                    }
                    
                    // For other errors, use optimistic update
                    s.follows[handle] = !wasFollowing;
                }
            } else {
                // Public profile - follow immediately
                s.follows[handle] = true;
                try {
                    const result = await toggleFollow(handle);
                    if (result && typeof result.following === 'boolean') {
                        s.follows[handle] = result.following;
                    }
                } catch (apiError) {
                    console.warn('API follow failed, using local state:', apiError);
                }
            }
            
            // Reload data to update follow status in UI
            await loadData();
        } catch (error) {
            console.error('Error toggling follow:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to follow/unfollow user', icon: 'alert' }));
        }
    }, [user, loadData]);

    if (!user) {
        return <div className="p-6">Please sign in to view notifications.</div>;
    }

    const unreadNotifications = notifications.filter(n => !n.read).length;

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.read && user?.handle) {
            await markNotificationRead(notif.id, user.handle);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }

        if (notif.type === 'sticker' || notif.type === 'reply') {
            navigate(`/messages/${encodeURIComponent(notif.fromHandle)}`);
        } else if (notif.type === 'dm') {
            navigate(`/messages/${encodeURIComponent(notif.fromHandle)}`);
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
                return <FiSmile className="w-5 h-5 text-purple-500" />;
            case 'reply':
                return <FiCornerUpLeft className="w-5 h-5 text-blue-500" />;
            case 'dm':
                return <FiMessageCircle className="w-5 h-5 text-green-500" />;
            case 'follow_request':
                return <FiUserPlus className="w-5 h-5 text-amber-500" />;
            default:
                return <FiMessageCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    const handleAcceptFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle || !user?.id) return;
        
        try {
            // Accept the follow request via API
            const { acceptFollowRequest: acceptFollowRequestAPI } = await import('../api/client');
            const encodedHandle = encodeURIComponent(notif.fromHandle);
            
            try {
                await acceptFollowRequestAPI(encodedHandle);
            } catch (apiError: any) {
                // If API fails, use localStorage fallback
                const isConnectionError = 
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');
                
                if (isConnectionError) {
                    // Use localStorage fallback
                    const { acceptFollowRequest: acceptFollowRequestLocal } = await import('../api/privacy');
                    acceptFollowRequestLocal(notif.fromHandle, user.handle);
                } else {
                    throw apiError;
                }
            }
            
            // Add to followed users (using the posts API state)
            const { toggleFollowForPost } = await import('../api/posts');
            const { posts } = await import('../api/posts');
            // Find a post by this user to toggle follow
            const userPost = posts.find(p => p.userHandle === notif.fromHandle);
            if (userPost) {
                await toggleFollowForPost(user.id, userPost.id);
            }
            
            // Create notification for the requester that their follow request was accepted
            try {
                const { createNotification } = await import('../api/notifications');
                await createNotification({
                    type: 'follow',
                    fromHandle: user.handle,
                    toHandle: notif.fromHandle,
                    message: `${user.handle} accepted your follow request`
                });
            } catch (error) {
                console.warn('Failed to create follow accepted notification:', error);
            }
            
            await deleteNotification(notif.id, user.handle);
            await loadData();
            
            Swal.fire(bottomSheet({
                title: 'Follow Request Accepted',
                message: `You are now following ${notif.fromHandle}`,
                icon: 'success',
            }));
        } catch (error) {
            console.error('Error accepting follow request:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to accept follow request', icon: 'alert' }));
        }
    };

    const handleDenyFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle) return;
        
        try {
            // Deny the follow request via API
            const { denyFollowRequest: denyFollowRequestAPI } = await import('../api/client');
            const encodedHandle = encodeURIComponent(notif.fromHandle);
            
            try {
                await denyFollowRequestAPI(encodedHandle);
            } catch (apiError: any) {
                // If API fails, use localStorage fallback
                const isConnectionError = 
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');
                
                if (isConnectionError) {
                    // Use localStorage fallback
                    const { denyFollowRequest: denyFollowRequestLocal } = await import('../api/privacy');
                    denyFollowRequestLocal(notif.fromHandle, user.handle);
                } else {
                    throw apiError;
                }
            }
            
            await deleteNotification(notif.id, user.handle);
            await loadData();
        } catch (error) {
            console.error('Error denying follow request:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to deny follow request', icon: 'alert' }));
        }
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => navigate('/feed')}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Back to feed"
                >
                    <FiChevronLeft className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold">Notifications</h1>
                <div className="flex-1" />
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            if (!user?.handle) return;
                            await seedMockDMs(user.handle);
                            // Reload conversations
                            const conversations = await listConversations(user.handle);
                            setItems(conversations);
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                    >
                        Add mock DMs
                    </button>
                    <button
                        onClick={async () => {
                            // Seed mock stories for Bob
                            const { seedMockStoriesForUser } = await import('../api/stories');
                            await seedMockStoriesForUser('Bob@Ireland', 'user-bob');
                            showToast('Mock 24hr stories added for Bob');
                            // Reload conversations to show purple border
                            if (user?.handle) {
                                const conversations = await listConversations(user.handle);
                                setItems(conversations);
                            }
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium transition-colors"
                    >
                        Add Bob Stories
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex mb-4 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'notifications'
                            ? 'text-green-500 border-b-2 border-green-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Notifs</span>
                    {unreadNotifications > 0 && (
                        <span className="px-1 py-0.5 bg-green-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'insights'
                            ? 'text-purple-500 border-b-2 border-purple-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Insights</span>
                    {insights && insights.length > 0 && (
                        <span className="px-1 py-0.5 bg-purple-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {insights.length > 9 ? '9+' : insights.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'messages'
                            ? 'text-blue-500 border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Messages</span>
                    {items && items.filter(c => c.unread > 0).length > 0 && (
                        <span className="px-1 py-0.5 bg-blue-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {items.filter(c => c.unread > 0).reduce((sum, c) => sum + c.unread, 0) > 9 ? '9+' : items.filter(c => c.unread > 0).reduce((sum, c) => sum + c.unread, 0)}
                        </span>
                    )}
                </button>
            </div>
            {loading ? (
                <div className="text-gray-500">Loading…</div>
            ) : activeTab === 'messages' ? (
                items.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No messages yet.</div>
                ) : (
                    <div className="space-y-1">
                        {/* Pinned Conversations */}
                        {items.filter(c => c.isPinned).length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-2">Pinned</div>
                                {items.filter(c => c.isPinned).map(conv => (
                                    <ConversationItem
                                        key={conv.otherHandle}
                                        conv={conv}
                                        onPin={() => {
                                            if (user?.handle) {
                                                unpinConversation(user.handle, conv.otherHandle);
                                                loadData();
                                            }
                                        }}
                                        onAcceptRequest={() => {
                                            if (user?.handle) {
                                                acceptMessageRequest(user.handle, conv.otherHandle);
                                                loadData();
                                            }
                                        }}
                                        navigate={navigate}
                                        currentUserHandle={user?.handle}
                                        onFollow={handleFollow}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Message Requests */}
                        {items.filter(c => c.isRequest).length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-2">Message Requests</div>
                                {items.filter(c => c.isRequest).map(conv => (
                                    <ConversationItem
                                        key={conv.otherHandle}
                                        conv={conv}
                                        onAcceptRequest={() => {
                                            if (user?.handle) {
                                                acceptMessageRequest(user.handle, conv.otherHandle);
                                                loadData();
                                            }
                                        }}
                                        navigate={navigate}
                                        currentUserHandle={user?.handle}
                                        onFollow={handleFollow}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Regular Conversations */}
                        {items.filter(c => !c.isPinned && !c.isRequest).map(conv => (
                            <ConversationItem
                                key={conv.otherHandle}
                                conv={conv}
                                onPin={() => {
                                    if (user?.handle) {
                                        pinConversation(user.handle, conv.otherHandle);
                                        loadData();
                                    }
                                }}
                                navigate={navigate}
                                currentUserHandle={user?.handle}
                                onFollow={handleFollow}
                            />
                        ))}
                    </div>
                )
            ) : activeTab === 'notifications' ? (
                notifications.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No notifications yet.</div>
                ) : (
                    <div className="space-y-2">
                        {unreadNotifications > 0 && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={async () => {
                                        if (user?.handle) {
                                            await markAllNotificationsRead(user.handle);
                                            await loadData();
                                        }
                                    }}
                                    className="text-xs text-green-500 hover:text-green-400"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                        {notifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${notif.read
                                        ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                        : 'bg-green-900/20 hover:bg-green-900/30 border-l-4 border-green-500'
                                    }`}
                            >
                                <button
                                    onClick={() => handleNotificationClick(notif)}
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                >
                                    <div className="flex-shrink-0">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <Avatar
                                        name={notif.fromHandle}
                                        src={getAvatarForHandle(notif.fromHandle)}
                                        size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{notif.fromHandle}</div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {formatNotificationMessage(notif)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-[10px] text-gray-400">
                                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {!notif.read && (
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        )}
                                    </div>
                                </button>
                                {notif.type === 'follow_request' && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={(e) => handleAcceptFollowRequest(notif, e)}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={(e) => handleDenyFollowRequest(notif, e)}
                                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
                                        >
                                            Deny
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'insights' ? (
                !insights || insights.length === 0 ? (
                    <div className="text-gray-500">No story insights yet.</div>
                ) : (
                <div className="space-y-2">
                    {insights.map(insight => (
                        <div
                            key={insight.storyId}
                            onClick={() => {
                                if (insight.question && insight.question.responseCount > 0) {
                                    setSelectedQuestionInsight(insight);
                                }
                            }}
                            className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${insight.question && insight.question.responseCount > 0 ? 'cursor-pointer' : ''}`}
                        >
                            {/* Show avatar from first responder if question, otherwise from first liker */}
                            {insight.question && insight.question.responses && insight.question.responses.length > 0 ? (
                                <Avatar
                                    name={insight.question.responses[0].userHandle}
                                    src={getAvatarForHandle(insight.question.responses[0].userHandle)}
                                    size="sm"
                                />
                            ) : insight.likes > 0 && insight.likers && insight.likers.length > 0 ? (
                                <Avatar
                                    name={insight.likers[0]}
                                    src={getAvatarForHandle(insight.likers[0])}
                                    size="sm"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                    {insight.question 
                                        ? `Q: ${insight.question.prompt.length > 30 ? insight.question.prompt.slice(0, 30) + '…' : insight.question.prompt}`
                                        : insight.text 
                                        ? (insight.text.length > 40 ? insight.text.slice(0, 40) + '…' : insight.text) 
                                        : 'Story'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {insight.question && insight.question.responseCount > 0 ? (
                                        insight.question.responseCount === 1
                                            ? `1 answer`
                                            : `${insight.question.responseCount} answers`
                                    ) : insight.likes === 0
                                        ? 'No likes yet'
                                        : !insight.likers || insight.likers.length === 0
                                        ? 'No likes yet'
                                        : insight.likes === 1
                                        ? `Liked by ${insight.likers[0]}`
                                        : insight.likes === 2
                                        ? `Liked by ${insight.likers.join(' and ')}`
                                        : `Liked by ${insight.likers.slice(0, 2).join(', ')} and ${insight.likes - 2} others`}
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {new Date(insight.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}
                </div>
            )
            ) : null}

            {/* Question Responses Modal */}
            {selectedQuestionInsight && selectedQuestionInsight.question && (
                <div 
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedQuestionInsight(null)}
                >
                    <div 
                        className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                Question Responses
                            </h2>
                            <button
                                onClick={() => setSelectedQuestionInsight(null)}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <FiX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                        
                        {/* Question Prompt */}
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 mb-4 text-center">
                            <p className="text-white font-semibold">{selectedQuestionInsight.question.prompt}</p>
                        </div>

                        {/* Responses List */}
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {selectedQuestionInsight.question.responses && selectedQuestionInsight.question.responses.length > 0 ? (
                                selectedQuestionInsight.question.responses.map((response) => (
                                    <div
                                        key={response.id}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Avatar
                                                name={response.userHandle}
                                                src={getAvatarForHandle(response.userHandle)}
                                                size="sm"
                                            />
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                                    {response.userHandle}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {timeAgo(response.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-gray-900 dark:text-gray-100 text-sm">
                                            {response.text}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    No responses yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


