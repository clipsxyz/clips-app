import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMessageCircle, FiCornerUpLeft, FiSmile, FiUserPlus, FiX, FiPlus, FiCheck, FiMoreHorizontal, FiBellOff, FiTrash2 } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle } from '../api/users';
import { getNotifications, type Notification, type NotificationType, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount, deleteNotification } from '../api/notifications';
import { getStoryInsightsForUser, type StoryInsight, fetchFollowedUsersStoryGroups } from '../api/stories';
import { listConversations, seedMockDMs, type ConversationSummary, pinConversation, unpinConversation, acceptMessageRequest, muteConversation, unmuteConversation, deleteConversation, markConversationRead, markConversationUnread } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { acceptFollowRequest as acceptFollowRequestLocal, denyFollowRequest as denyFollowRequestLocal, removeFollowRequest } from '../api/privacy';
import { showToast } from '../utils/toast';
import { getFollowedUsers } from '../api/posts';
import type { StoryGroup } from '../types';
import { FiBookmark } from 'react-icons/fi';
import { toggleFollow, acceptFollowRequest, denyFollowRequest } from '../api/client';
import { getSocket } from '../services/socketio';
import { leaveChatGroup } from '../api/client';
import { markGroupConversationReadById } from '../api/messages';

function inboxConversationRowId(conv: ConversationSummary): string {
    if (conv.kind === 'group' && conv.chatGroupId) return `g:${conv.chatGroupId}`;
    return conv.otherHandle;
}

// Conversation Item Component
function ConversationItem({ 
    conv, 
    onPin, 
    onAcceptRequest,
    navigate,
    currentUserHandle,
    onFollow,
    onToggleMute,
    onDeleteConversation,
    onMarkRead,
    onMarkUnread,
    isSwipeOpen,
    onSwipeOpenChange,
    compactPhone,
}: { 
    conv: ConversationSummary; 
    onPin?: () => void;
    onAcceptRequest?: () => void;
    navigate: any;
    currentUserHandle?: string;
    onFollow?: (handle: string) => Promise<void>;
    onToggleMute?: () => void;
    onDeleteConversation?: () => void;
    onMarkRead?: () => void;
    onMarkUnread?: () => void;
    isSwipeOpen?: boolean;
    onSwipeOpenChange?: (handle: string | null) => void;
    compactPhone?: boolean;
}) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
    const SWIPE_ACTION_WIDTH = viewportWidth < 360 ? 188 : viewportWidth < 430 ? 208 : 224;
    const SWIPE_OPEN_THRESHOLD_RATIO = viewportWidth < 360 ? 0.26 : viewportWidth < 430 ? 0.3 : 0.35;
    const rowId = inboxConversationRowId(conv);
    const isGroupRow = conv.kind === 'group';
    const displayTitle = isGroupRow ? (conv.groupName || 'Group') : conv.otherHandle;
    const isCurrentUser = !isGroupRow && currentUserHandle === conv.otherHandle;
    const hasStory = !isGroupRow && (conv.hasUnviewedStories || false);
    const isFollowing = conv.isFollowing || false;
    const [showFollowCheck, setShowFollowCheck] = React.useState(isFollowing);
    const [showActions, setShowActions] = React.useState(false);
    const [swipeOffset, setSwipeOffset] = React.useState(0);
    const [pulseOpen, setPulseOpen] = React.useState(false);
    const touchStartXRef = React.useRef<number | null>(null);
    const touchStartYRef = React.useRef<number | null>(null);
    const touchLastXRef = React.useRef<number | null>(null);
    const touchLastTsRef = React.useRef<number | null>(null);
    const touchStartTsRef = React.useRef<number | null>(null);
    const swipeStartOffsetRef = React.useRef(0);
    const isSwipingRef = React.useRef(false);

    // Show follow checkmark briefly after following
    React.useEffect(() => {
        if (isFollowing) {
            setShowFollowCheck(true);
        } else {
            setShowFollowCheck(false);
        }
    }, [isFollowing]);

    React.useEffect(() => {
        if (isSwipeOpen) {
            setSwipeOffset(SWIPE_ACTION_WIDTH);
        } else if (!isSwipingRef.current && swipeOffset !== 0) {
            setSwipeOffset(0);
        }
    }, [isSwipeOpen, SWIPE_ACTION_WIDTH, swipeOffset]);

    const handleAvatarClick = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (isGroupRow && conv.chatGroupId) {
            navigate(`/messages/group/${encodeURIComponent(conv.chatGroupId)}`);
            return;
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
        if (swipeOffset > 0) {
            setSwipeOffset(0);
            onSwipeOpenChange?.(null);
            return;
        }
        if (isGroupRow && conv.chatGroupId) {
            navigate(`/messages/group/${encodeURIComponent(conv.chatGroupId)}`);
            return;
        }
        navigate(`/messages/${encodeURIComponent(conv.otherHandle)}`);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        touchStartXRef.current = t.clientX;
        touchStartYRef.current = t.clientY;
        touchLastXRef.current = t.clientX;
        touchLastTsRef.current = Date.now();
        touchStartTsRef.current = Date.now();
        swipeStartOffsetRef.current = swipeOffset;
        isSwipingRef.current = false;
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (touchStartXRef.current === null || touchStartYRef.current === null || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartXRef.current;
        const dy = t.clientY - touchStartYRef.current;
        if (!isSwipingRef.current) {
            if (Math.abs(dx) < 8) return;
            if (Math.abs(dy) > Math.abs(dx)) return;
            isSwipingRef.current = true;
        }
        const next = Math.max(0, Math.min(SWIPE_ACTION_WIDTH, swipeStartOffsetRef.current - dx));
        setSwipeOffset(next);
        touchLastXRef.current = t.clientX;
        touchLastTsRef.current = Date.now();
        if (Math.abs(dx) > 6) e.preventDefault();
    };

    const handleTouchEnd = () => {
        if (!isSwipingRef.current) {
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            return;
        }
        const now = Date.now();
        const lastX = touchLastXRef.current ?? touchStartXRef.current;
        const lastTs = touchLastTsRef.current ?? now;
        const startTs = touchStartTsRef.current ?? lastTs;
        const startX = touchStartXRef.current ?? lastX ?? 0;
        const dt = Math.max(1, lastTs - startTs);
        const vx = ((lastX ?? 0) - startX) / dt; // px/ms; negative means left fling
        const isQuickLeftFling = vx < -0.45;
        const shouldOpen = isQuickLeftFling || swipeOffset > SWIPE_ACTION_WIDTH * SWIPE_OPEN_THRESHOLD_RATIO;
        setSwipeOffset(shouldOpen ? SWIPE_ACTION_WIDTH : 0);
        if (shouldOpen) {
            setPulseOpen(true);
            window.setTimeout(() => setPulseOpen(false), 140);
        }
        onSwipeOpenChange?.(shouldOpen ? rowId : null);
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchLastXRef.current = null;
        touchLastTsRef.current = null;
        touchStartTsRef.current = null;
        isSwipingRef.current = false;
    };

    const closeSwipeActions = () => {
        setSwipeOffset(0);
        onSwipeOpenChange?.(null);
    };
    const revealProgress = Math.max(0, Math.min(1, swipeOffset / SWIPE_ACTION_WIDTH));
    const rowScale = 1 - revealProgress * 0.012;
    const rowShadow = revealProgress > 0 ? '0 8px 24px rgba(6, 182, 212, 0.16)' : 'none';

    return (
        <div className="relative overflow-hidden rounded-lg" data-conversation-row="true">
            <div
                className="pointer-events-none absolute inset-0 rounded-lg"
                style={{
                    opacity: revealProgress * 0.9,
                    background: 'linear-gradient(90deg, rgba(8,12,18,0) 0%, rgba(8,12,18,0.14) 45%, rgba(8,12,18,0.34) 100%)',
                    transition: isSwipingRef.current ? 'none' : 'opacity 180ms ease',
                }}
            />
            <div
                className="absolute inset-y-0 right-0 flex items-stretch z-0"
                style={{
                    opacity: revealProgress > 0.02 ? 1 : 0,
                    pointerEvents: revealProgress > 0.02 ? 'auto' : 'none',
                    transition: isSwipingRef.current ? 'none' : 'opacity 140ms ease',
                }}
            >
                {onPin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPin();
                            closeSwipeActions();
                        }}
                        className="w-14 sm:w-16 bg-cyan-600/90 hover:bg-cyan-500 active:brightness-110 active:scale-[0.98] transition-all text-white text-[11px] font-semibold"
                        title={conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                    >
                        {conv.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                )}
                {(onMarkRead || onMarkUnread) && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (conv.unread > 0) onMarkRead?.();
                            else onMarkUnread?.();
                            closeSwipeActions();
                        }}
                        className="w-14 sm:w-16 bg-sky-500/90 hover:bg-sky-400 active:brightness-110 active:scale-[0.98] transition-all text-white text-[11px] font-semibold"
                        title={conv.unread > 0 ? 'Mark as read' : 'Mark as unread'}
                    >
                        {conv.unread > 0 ? 'Read' : 'Unread'}
                    </button>
                )}
                {onToggleMute && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMute();
                            closeSwipeActions();
                        }}
                        className="w-14 sm:w-16 bg-cyan-800/90 hover:bg-cyan-700 active:brightness-110 active:scale-[0.98] transition-all text-white text-[11px] font-semibold"
                        title={conv.isMuted ? 'Unmute conversation' : 'Mute conversation'}
                    >
                        {conv.isMuted ? 'Unmute' : 'Mute'}
                    </button>
                )}
                {onDeleteConversation && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation();
                            closeSwipeActions();
                        }}
                        className="w-14 sm:w-16 bg-red-600/90 hover:bg-red-500 active:brightness-110 active:scale-[0.98] transition-all text-white text-[11px] font-semibold"
                        title={isGroupRow ? 'Leave group' : 'Delete conversation'}
                    >
                        {isGroupRow ? 'Leave' : 'Delete'}
                    </button>
                )}
            </div>

            <div
                className={`relative z-10 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group bg-white dark:bg-[#070a12] ${
                    compactPhone ? 'gap-2.5 py-2.5 px-1.5' : 'gap-3 py-3 px-2'
                }`}
                style={{
                    transform: `translateX(-${swipeOffset}px) scale(${rowScale})`,
                    transformOrigin: 'right center',
                    boxShadow: pulseOpen ? '0 0 0 2px rgba(34, 211, 238, 0.42), 0 10px 24px rgba(6, 182, 212, 0.24)' : rowShadow,
                    transition: isSwipingRef.current ? 'none' : 'transform 180ms ease, box-shadow 180ms ease',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
            <div
                className="pointer-events-none absolute inset-0 rounded-lg"
                style={{
                    opacity: pulseOpen ? 0.22 : 0,
                    background: 'linear-gradient(90deg, rgba(34,211,238,0.05) 0%, rgba(34,211,238,0.22) 100%)',
                    transition: 'opacity 140ms ease',
                }}
            />
            {/* Avatar with story/follow - separate from conversation button */}
            <div className="relative overflow-visible flex-shrink-0">
                <Avatar
                    name={displayTitle}
                    src={isGroupRow ? undefined : getAvatarForHandle(conv.otherHandle)}
                    size="md"
                    hasStory={hasStory}
                    onClick={handleAvatarClick}
                />
                {/* + icon overlay on profile picture to follow (TikTok style) */}
                {!isGroupRow && !isCurrentUser && onFollow && (isFollowing === false || isFollowing === undefined) && (
                    <button
                        onClick={handleFollowClick}
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-cyan-500 hover:bg-cyan-600 border-2 border-white dark:border-gray-900 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg z-30"
                        aria-label="Follow user"
                    >
                        <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </button>
                )}
                {/* Checkmark icon when following (replaces + icon) */}
                {!isGroupRow && !isCurrentUser && onFollow && isFollowing && showFollowCheck && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-lg z-30">
                        <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                )}
            </div>
            {/* Conversation content - clickable to open DM */}
            <button
                onClick={handleConversationClick}
                className={`flex items-center flex-1 min-w-0 text-left ${compactPhone ? 'gap-2.5' : 'gap-3'}`}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${compactPhone ? 'text-[13px]' : ''}`}>{displayTitle}</span>
                        {conv.isPinned && (
                            <FiBookmark className="w-3 h-3 text-cyan-400 fill-cyan-400 flex-shrink-0" />
                        )}
                    </div>
                    <div className={`text-gray-500 truncate ${compactPhone ? 'text-[11px]' : 'text-xs'}`}>
                        {conv.lastMessage?.text || 'Photo'}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-[10px] text-gray-400">
                        {conv.lastMessage ? timeAgo(conv.lastMessage.timestamp) : ''}
                    </div>
                    {conv.unread > 0 && (
                        <span className="px-1.5 py-0.5 bg-cyan-500 text-white text-[10px] rounded-full min-w-[18px] text-center">
                            {conv.unread > 9 ? '9+' : conv.unread}
                        </span>
                    )}
                </div>
            </button>
            <div className={`flex items-center gap-1 transition-opacity ${compactPhone ? 'pr-0.5' : ''}`}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        closeSwipeActions();
                        setShowActions((prev) => !prev);
                    }}
                    className={`rounded-full text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors ${
                        compactPhone ? 'p-1.5' : 'p-2'
                    }`}
                    title="More actions"
                >
                    <FiMoreHorizontal className="w-4 h-4" />
                </button>
            </div>
            {showActions && (
                <div className="absolute right-2 top-[52px] z-40 rounded-xl border border-white/15 bg-[#0c1119] shadow-2xl p-1 min-w-[170px]">
                    {conv.isRequest && onAcceptRequest && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAcceptRequest();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-white/10 text-white"
                        >
                            Accept request
                        </button>
                    )}
                    {onMarkRead && conv.unread > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkRead();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-white/10 text-white"
                        >
                            Mark as read
                        </button>
                    )}
                    {onMarkUnread && conv.unread === 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkUnread();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-white/10 text-white"
                        >
                            Mark as unread
                        </button>
                    )}
                    {onPin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPin();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-white/10 text-white flex items-center gap-2"
                        >
                            <FiBookmark className={`w-3.5 h-3.5 ${conv.isPinned ? 'fill-current text-cyan-400' : 'text-gray-300'}`} />
                            {conv.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                        </button>
                    )}
                    {onToggleMute && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleMute();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-white/10 text-white flex items-center gap-2"
                        >
                            <FiBellOff className="w-3.5 h-3.5 text-cyan-300" />
                            {conv.isMuted ? 'Unmute conversation' : 'Mute conversation'}
                        </button>
                    )}
                    {onDeleteConversation && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation();
                                setShowActions(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs rounded-lg hover:bg-red-500/15 text-red-300 flex items-center gap-2"
                        >
                            <FiTrash2 className="w-3.5 h-3.5" />
                            {isGroupRow ? 'Leave group' : 'Delete conversation'}
                        </button>
                    )}
                </div>
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
    const [storyGroups, setStoryGroups] = React.useState<StoryGroup[]>([]);
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'insights' | 'notifications' | 'messages'>('messages');
    const [messageFilter, setMessageFilter] = React.useState<'all' | 'groups' | 'unread' | 'requests' | 'pinned'>('all');
    const [conversationQuery, setConversationQuery] = React.useState('');
    const [selectedQuestionInsight, setSelectedQuestionInsight] = React.useState<StoryInsight | null>(null);
    const [openSwipeHandle, setOpenSwipeHandle] = React.useState<string | null>(null);
    const [compactPhone, setCompactPhone] = React.useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 390 : false));

    React.useEffect(() => {
        setOpenSwipeHandle(null);
    }, [activeTab, messageFilter, conversationQuery]);

    React.useEffect(() => {
        const onResize = () => setCompactPhone(typeof window !== 'undefined' ? window.innerWidth <= 390 : false);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const loadData = React.useCallback(async () => {
        if (!user?.handle) return;
        try {
            const [notifs, storyInsights, conversations, followedUsers, followedUsersForStories] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
                listConversations(user.handle),
                user?.id ? getFollowedUsers(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[]),
                user?.id ? getFollowedUsers(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[]),
            ]);
            
            // Add follow status to conversations
            const conversationsWithFollowStatus = conversations.map(conv => ({
                ...conv,
                isFollowing: conv.kind === 'group' ? false : (followedUsers as string[]).includes(conv.otherHandle),
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
                    if (conv.kind === 'group') return false;
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

            // Load story groups for followed users (for the horizontal stories row)
            if (user?.id) {
                try {
                    const groups = await fetchFollowedUsersStoryGroups(user.id, followedUsersForStories as string[]);
                    // Enrich with avatar URLs (use current user's avatar or mock avatars from getAvatarForHandle)
                    const groupsWithAvatars = groups.map((group) => {
                        if (group.userId === user.id && user.avatarUrl) {
                            return { ...group, avatarUrl: user.avatarUrl };
                        }
                        const avatarUrl = group.avatarUrl || getAvatarForHandle(group.userHandle);
                        return { ...group, avatarUrl };
                    });
                    setStoryGroups(groupsWithAvatars);
                } catch (e) {
                    console.warn('Failed to load story groups for inbox header:', e);
                    setStoryGroups([]);
                }
            } else {
                setStoryGroups([]);
            }
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

    const handleToggleMuteConversation = React.useCallback(async (conv: ConversationSummary) => {
        if (!user?.handle || conv.kind === 'group') return;
        try {
            if (conv.isMuted) {
                await unmuteConversation(user.handle, conv.otherHandle);
                showToast?.(`Unmuted ${conv.otherHandle}`);
            } else {
                await muteConversation(user.handle, conv.otherHandle);
                showToast?.(`Muted ${conv.otherHandle}`);
            }
            await loadData();
        } catch (error) {
            console.error('Error toggling mute:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to update mute setting', icon: 'alert' }));
        }
    }, [user?.handle, loadData]);

    const handleDeleteConversation = React.useCallback(async (conv: ConversationSummary) => {
        if (!user?.handle) return;
        const isGroup = conv.kind === 'group' && conv.chatGroupId;
        const result = await Swal.fire(bottomSheet({
            title: isGroup ? 'Leave group?' : 'Delete conversation?',
            message: isGroup
                ? `You will leave "${conv.groupName || 'this group'}". You can be invited again later.`
                : `This will remove your chat with ${conv.otherHandle}.`,
            icon: 'alert',
            showCancelButton: true,
            confirmButtonText: isGroup ? 'Leave' : 'Delete',
            cancelButtonText: 'Cancel',
        }));
        if (!result.isConfirmed) return;
        try {
            if (isGroup && conv.chatGroupId) {
                await leaveChatGroup(conv.chatGroupId);
                showToast?.('Left group');
            } else {
                await deleteConversation(user.handle, conv.otherHandle);
                showToast?.('Conversation deleted');
            }
            await loadData();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            Swal.fire(bottomSheet({
                title: 'Error',
                message: isGroup ? 'Failed to leave group' : 'Failed to delete conversation',
                icon: 'alert',
            }));
        }
    }, [user?.handle, loadData]);

    const handleMarkConversationRead = React.useCallback(async (conv: ConversationSummary) => {
        if (!user?.handle) return;
        try {
            if (conv.kind === 'group' && conv.chatGroupId) {
                await markGroupConversationReadById(conv.chatGroupId, user.handle);
            } else {
                await markConversationRead(user.handle, conv.otherHandle);
            }
            await loadData();
        } catch (error) {
            console.error('Error marking conversation read:', error);
        }
    }, [user?.handle, loadData]);

    const handleMarkConversationUnread = React.useCallback(async (conv: ConversationSummary) => {
        if (!user?.handle || conv.kind === 'group') return;
        try {
            await markConversationUnread(user.handle, conv.otherHandle);
            await loadData();
        } catch (error) {
            console.error('Error marking conversation unread:', error);
        }
    }, [user?.handle, loadData]);

    if (!user) {
        return <div className="p-6">Please sign in to view notifications.</div>;
    }

    const unreadNotifications = notifications.filter(n => !n.read).length;
    const unreadMessagesTotal = items.reduce((sum, c) => sum + c.unread, 0);
    const normalizedQuery = conversationQuery.trim().toLowerCase();
    const queriedItems = normalizedQuery
        ? items.filter((c) => {
            const hay = `${c.otherHandle} ${c.groupName || ''} ${c.lastMessage?.text || ''}`.toLowerCase();
            return hay.includes(normalizedQuery);
        })
        : items;
    const pinnedItems = queriedItems.filter(c => c.isPinned);
    const requestItems = queriedItems.filter(c => c.isRequest);
    const regularItems = queriedItems.filter(c => !c.isPinned && !c.isRequest);
    const unreadItems = queriedItems.filter(c => c.unread > 0);
    const groupItems = queriedItems.filter(c => c.kind === 'group');

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
        <div className={compactPhone ? 'p-3' : 'p-4'}>
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

            {/* Stories row (TikTok / Instagram style) */}
            {storyGroups.length > 0 && (
                <div className="mb-4 overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-3 px-0.5">
                        {storyGroups.map((group) => (
                            <button
                                key={group.userId || group.userHandle}
                                type="button"
                                onClick={() => {
                                    navigate('/stories', { state: { openUserHandle: group.userHandle } });
                                }}
                                className="flex flex-col items-center gap-1 flex-shrink-0"
                            >
                                <div className="relative">
                                    {/* Story ring */}
                                    <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-teal-400 via-sky-500 to-fuchsia-500">
                                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                                            <Avatar
                                                name={group.userHandle}
                                                src={group.avatarUrl}
                                                size="md"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <span className="max-w-[72px] text-[11px] text-gray-300 truncate">
                                    {group.userHandle}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex mb-4 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'messages'
                            ? 'text-cyan-400 border-b-2 border-cyan-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Messages</span>
                    {unreadMessagesTotal > 0 && (
                        <span className="px-1 py-0.5 bg-cyan-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {unreadMessagesTotal > 9 ? '9+' : unreadMessagesTotal}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'notifications'
                            ? 'text-cyan-400 border-b-2 border-cyan-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Notifs</span>
                    {unreadNotifications > 0 && (
                        <span className="px-1 py-0.5 bg-cyan-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'insights'
                            ? 'text-cyan-400 border-b-2 border-cyan-400'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Insights</span>
                    {insights && insights.length > 0 && (
                        <span className="px-1 py-0.5 bg-cyan-500 text-white text-[9px] rounded-full min-w-[16px] text-center leading-none">
                            {insights.length > 9 ? '9+' : insights.length}
                        </span>
                    )}
                </button>
            </div>
            {loading ? (
                <div className="text-gray-500">Loading…</div>
            ) : activeTab === 'messages' ? (
                queriedItems.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                        {conversationQuery.trim() ? 'No conversations match your search.' : 'No messages yet.'}
                    </div>
                ) : (
                    <div
                        className={compactPhone ? 'space-y-2.5' : 'space-y-3'}
                        onClickCapture={(e) => {
                            if (!openSwipeHandle) return;
                            const target = e.target as HTMLElement | null;
                            if (target?.closest('[data-conversation-row="true"]')) return;
                            setOpenSwipeHandle(null);
                        }}
                        onTouchStartCapture={(e) => {
                            if (!openSwipeHandle) return;
                            const target = e.target as HTMLElement | null;
                            if (target?.closest('[data-conversation-row="true"]')) return;
                            setOpenSwipeHandle(null);
                        }}
                    >
                        <div className={`flex items-center gap-2 rounded-xl border border-white/10 bg-[#09090d] ${compactPhone ? 'px-2.5 py-2' : 'px-3 py-2'}`}>
                            <FiMessageCircle className="w-4 h-4 text-cyan-300" />
                            <input
                                value={conversationQuery}
                                onChange={(e) => setConversationQuery(e.target.value)}
                                placeholder="Search conversations"
                                className={`flex-1 bg-transparent text-white placeholder:text-gray-500 focus:outline-none ${compactPhone ? 'text-[13px]' : 'text-sm'}`}
                            />
                            {conversationQuery && (
                                <button
                                    type="button"
                                    onClick={() => setConversationQuery('')}
                                    className="p-1 text-gray-400 hover:text-gray-200"
                                    aria-label="Clear search"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className={`flex overflow-x-auto scrollbar-hide pb-1 ${compactPhone ? 'gap-1.5' : 'gap-2'}`}>
                            {([
                                { id: 'all' as const, label: `All (${queriedItems.length})` },
                                { id: 'groups' as const, label: `Groups (${groupItems.length})` },
                                { id: 'unread' as const, label: `Unread (${unreadItems.length})` },
                                { id: 'requests' as const, label: `Requests (${requestItems.length})` },
                                { id: 'pinned' as const, label: `Pinned (${pinnedItems.length})` },
                            ]).map((chip) => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => setMessageFilter(chip.id)}
                                    className={`${compactPhone ? 'px-2.5 py-1.5 text-[10px] min-h-[32px]' : 'px-3 py-1.5 text-[11px]'} rounded-full font-medium whitespace-nowrap border transition-colors ${
                                        messageFilter === chip.id
                                            ? 'bg-cyan-500 text-white border-cyan-400'
                                            : 'bg-black/40 text-gray-300 border-white/15 hover:border-cyan-400/60'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        {messageFilter === 'all' && (
                            <div className="space-y-1">
                        {/* Pinned Conversations */}
                        {pinnedItems.length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-2">Pinned</div>
                                {pinnedItems.map(conv => (
                                    <ConversationItem
                                        key={inboxConversationRowId(conv)}
                                        conv={conv}
                                        onPin={conv.kind === 'group' ? undefined : () => {
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
                                        onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                        onDeleteConversation={() => handleDeleteConversation(conv)}
                                        onMarkRead={() => handleMarkConversationRead(conv)}
                                        onMarkUnread={() => handleMarkConversationUnread(conv)}
                                        isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                        onSwipeOpenChange={setOpenSwipeHandle}
                                        compactPhone={compactPhone}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Message Requests */}
                        {requestItems.length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-2">Message Requests</div>
                                {requestItems.map(conv => (
                                    <ConversationItem
                                        key={inboxConversationRowId(conv)}
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
                                        onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                        onDeleteConversation={() => handleDeleteConversation(conv)}
                                        onMarkRead={() => handleMarkConversationRead(conv)}
                                        onMarkUnread={() => handleMarkConversationUnread(conv)}
                                        isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                        onSwipeOpenChange={setOpenSwipeHandle}
                                        compactPhone={compactPhone}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Regular Conversations */}
                        {regularItems.map(conv => (
                            <ConversationItem
                                key={inboxConversationRowId(conv)}
                                conv={conv}
                                onPin={conv.kind === 'group' ? undefined : () => {
                                    if (user?.handle) {
                                        pinConversation(user.handle, conv.otherHandle);
                                        loadData();
                                    }
                                }}
                                navigate={navigate}
                                currentUserHandle={user?.handle}
                                onFollow={handleFollow}
                                onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                onDeleteConversation={() => handleDeleteConversation(conv)}
                                onMarkRead={() => handleMarkConversationRead(conv)}
                                onMarkUnread={() => handleMarkConversationUnread(conv)}
                                isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                onSwipeOpenChange={setOpenSwipeHandle}
                                compactPhone={compactPhone}
                            />
                        ))}
                    </div>
                        )}

                        {messageFilter === 'unread' && (
                            unreadItems.length > 0 ? (
                                <div className="space-y-1">
                                    {unreadItems.map(conv => (
                                        <ConversationItem
                                            key={inboxConversationRowId(conv)}
                                            conv={conv}
                                            onPin={conv.kind === 'group' ? undefined : () => {
                                                if (user?.handle) {
                                                    pinConversation(user.handle, conv.otherHandle);
                                                    loadData();
                                                }
                                            }}
                                            navigate={navigate}
                                            currentUserHandle={user?.handle}
                                            onFollow={handleFollow}
                                            onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                            onDeleteConversation={() => handleDeleteConversation(conv)}
                                            onMarkRead={() => handleMarkConversationRead(conv)}
                                            onMarkUnread={() => handleMarkConversationUnread(conv)}
                                            isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                            onSwipeOpenChange={setOpenSwipeHandle}
                                            compactPhone={compactPhone}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-5 text-center text-sm text-gray-400">
                                    You&apos;re all caught up.
                                </div>
                            )
                        )}

                        {messageFilter === 'requests' && (
                            requestItems.length > 0 ? (
                                <div className="space-y-1">
                                    {requestItems.map(conv => (
                                        <ConversationItem
                                            key={inboxConversationRowId(conv)}
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
                                            onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                            onDeleteConversation={() => handleDeleteConversation(conv)}
                                            onMarkRead={() => handleMarkConversationRead(conv)}
                                            onMarkUnread={() => handleMarkConversationUnread(conv)}
                                            isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                            onSwipeOpenChange={setOpenSwipeHandle}
                                            compactPhone={compactPhone}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-5 text-center text-sm text-gray-400">
                                    No message requests.
                                </div>
                            )
                        )}

                        {messageFilter === 'pinned' && (
                            pinnedItems.length > 0 ? (
                                <div className="space-y-1">
                                    {pinnedItems.map(conv => (
                                        <ConversationItem
                                            key={inboxConversationRowId(conv)}
                                            conv={conv}
                                            onPin={conv.kind === 'group' ? undefined : () => {
                                                if (user?.handle) {
                                                    unpinConversation(user.handle, conv.otherHandle);
                                                    loadData();
                                                }
                                            }}
                                            navigate={navigate}
                                            currentUserHandle={user?.handle}
                                            onFollow={handleFollow}
                                            onToggleMute={conv.kind === 'group' ? undefined : () => handleToggleMuteConversation(conv)}
                                            onDeleteConversation={() => handleDeleteConversation(conv)}
                                            onMarkRead={() => handleMarkConversationRead(conv)}
                                            onMarkUnread={() => handleMarkConversationUnread(conv)}
                                            isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                            onSwipeOpenChange={setOpenSwipeHandle}
                                            compactPhone={compactPhone}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-5 text-center text-sm text-gray-400">
                                    No pinned conversations.
                                </div>
                            )
                        )}

                        {messageFilter === 'groups' && (
                            groupItems.length > 0 ? (
                                <div className="space-y-1">
                                    {groupItems.map(conv => (
                                        <ConversationItem
                                            key={inboxConversationRowId(conv)}
                                            conv={conv}
                                            onPin={undefined}
                                            navigate={navigate}
                                            currentUserHandle={user?.handle}
                                            onFollow={handleFollow}
                                            onToggleMute={undefined}
                                            onDeleteConversation={() => handleDeleteConversation(conv)}
                                            onMarkRead={() => handleMarkConversationRead(conv)}
                                            onMarkUnread={() => handleMarkConversationUnread(conv)}
                                            isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                            onSwipeOpenChange={setOpenSwipeHandle}
                                            compactPhone={compactPhone}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-5 text-center text-sm text-gray-400 leading-relaxed">
                                    No group chats yet. Use <span className="text-cyan-300/90">New group</span> on your profile or{' '}
                                    <span className="text-cyan-300/90">Create group</span> on your own post (⋯ menu), then invite people from the{' '}
                                    <span className="text-cyan-300/90">+</span> button in the group or from their profile.
                                </div>
                            )
                        )}
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
                                    className="text-xs text-cyan-400 hover:text-cyan-300"
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
                                        : 'bg-cyan-900/20 hover:bg-cyan-900/30 border-l-4 border-cyan-500'
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
                                            <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
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


