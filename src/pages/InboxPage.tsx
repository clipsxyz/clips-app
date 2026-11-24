import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiMessageCircle, FiCornerUpLeft, FiSmile, FiUserPlus, FiUser, FiX, FiCheck, FiBell, FiBellOff, FiTrash2, FiBookmark, FiHeart, FiRepeat, FiShare2, FiUsers } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/Auth';
import { getAvatarForHandle } from '../api/users';
import { setAvatarForHandle } from '../api/users';
import { getNotifications, type Notification, type NotificationType, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api/notifications';
import { getPostById, toggleLike, toggleFollowForPost, reclipPost } from '../api/posts';
import type { Post } from '../types';
import ScenesModal from '../components/ScenesModal';
import CommentsModal from '../components/CommentsModal';
import ShareModal from '../components/ShareModal';
import { getStoryInsightsForUser, type StoryInsight, fetchFollowedUsersStoryGroups, fetchStoryGroupByHandle } from '../api/stories';
import { reachPercent, storyInsightRowStats, summarizeStoryInsights } from '../utils/storyInsightsAnalytics';
import { listConversations, type ConversationSummary, pinConversation, unpinConversation, acceptMessageRequest, muteConversation, unmuteConversation, deleteConversation, markConversationRead, markConversationUnread } from '../api/messages';
import { timeAgo } from '../utils/timeAgo';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { showToast } from '../utils/toast';
import { getFollowedUsers } from '../api/posts';
import type { StoryGroup } from '../types';
import { toggleFollow, acceptFollowRequest, denyFollowRequest } from '../api/client';
import { fetchUserProfile } from '../api/client';
import { describeFetchError } from '../api/httpClient';
import { getSocket } from '../services/socketio';
import { leaveChatGroup } from '../api/client';
import { markGroupConversationReadById } from '../api/messages';
import { getNotificationPreferences, isNotificationTypeEnabled } from '../services/notifications';
import {
    countsTowardInboxNotificationBadge,
    inboxUnreadPartsFromLists,
    publishInboxUnreadParts,
} from '../utils/inboxUnread';
import { notificationKindLabel, resolveNotificationKind } from '../utils/notificationKind';
import { followRequestIdentity } from '../utils/followRequestNotification';
import { groupInvitePresentation } from '../utils/groupInviteNotification';
import {
    acceptChatGroupInvite,
    declineChatGroupInvite,
    fetchPendingGroupInvites,
    pendingInviteGroupName,
    pendingInviteInviterHandle,
    type ChatGroupInviteRow,
} from '../api/chatGroups';
import {
    isFollowInboxNotification,
    isPostRelatedInboxNotification,
    resolveInboxNotificationRoute,
} from '../utils/inboxNotificationNav';
import { groupNotificationsIntoSections } from '../utils/notificationSections';

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

function displayHandle(handle: string): string {
    const raw = (handle || '').trim();
    if (!raw) return 'User';
    const name = raw.split('@')[0]?.trim();
    return name || raw;
}

function compactInboxTime(timestamp?: number): string {
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

function sameDmHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

function conversationPreviewText(conv: ConversationSummary, viewerHandle?: string | null): string {
    const last = conv.lastMessage;
    if (!last) return conv.kind === 'group' ? 'Open group' : 'Open conversation';
    const fromMe = !!viewerHandle && sameDmHandle(last.senderHandle, viewerHandle);
    if (last.storyId) {
        const body = last.text?.trim();
        if (last.storyContextText === 'Reacted to your story' && body) {
            return fromMe ? `You reacted ${body} to their story` : `Reacted ${body} to your story`;
        }
        if (last.storyContextText === 'Reacted to your story') {
            return fromMe ? 'You reacted to their story' : 'Reacted to your story';
        }
        if (body === 'Replied to your story') {
            return fromMe ? 'You replied to their story' : 'Replied to your story';
        }
        if (body && body !== 'Replied to your story') return body;
        if (last.storyContextText?.trim()) return last.storyContextText.trim();
        return fromMe ? 'You replied to their story' : 'Replied to your story';
    }
    if (last.text?.trim()) {
        const body = last.text.replace(/\s+/g, ' ').trim();
        if (/^liked (your|a) post/i.test(body)) return body;
        if (fromMe) return body.startsWith('You: ') ? body : `You: ${body}`;
        return body;
    }
    if (last.commentText?.trim()) return `Commented: ${last.commentText}`;
    if (last.imageUrl) return fromMe ? 'You: Photo' : 'Photo';
    if (last.audioUrl) return fromMe ? 'You: Voice message' : 'Voice message';
    return conv.kind === 'group' ? 'Open group' : 'Open conversation';
}

function inboxConversationRowId(conv: ConversationSummary): string {
    if (conv.kind === 'group' && conv.chatGroupId) return `g:${conv.chatGroupId}`;
    return conv.otherHandle;
}

function StoryReplyThumb({ imageUrl }: { imageUrl: string }) {
    const isDataImage = /^data:image\//i.test(imageUrl);
    const isDataVideo = /^data:video\//i.test(imageUrl);
    const looksLikeImageFile = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(imageUrl);
    const shouldUseImage = isDataImage || (!isDataVideo && looksLikeImageFile);
    const [videoErrored, setVideoErrored] = React.useState(false);

    if (!shouldUseImage) {
        return (
            <div className="relative h-7 w-7 rounded overflow-hidden bg-black/50">
                {!videoErrored ? (
                    <video
                        src={imageUrl}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onError={() => setVideoErrored(true)}
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/80 text-[10px] font-semibold">
                        MP4
                    </div>
                )}
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt="Story replied to"
            className="h-7 w-7 rounded object-cover"
        />
    );
}

// Conversation Item Component
function ConversationItem({ 
    conv, 
    onPin, 
    navigate,
    currentUserHandle,
    onToggleMute,
    onDeleteConversation,
    onMarkRead,
    onMarkUnread,
    isSwipeOpen,
    onSwipeOpenChange,
    onOpenChatInfo,
    getAvatarSrc,
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
    /** Opens black & white chat info sheet (inbox list). */
    onOpenChatInfo?: (conv: ConversationSummary) => void;
    getAvatarSrc?: (handle: string) => string | undefined;
}) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
    const SWIPE_ACTION_WIDTH = viewportWidth < 360 ? 188 : viewportWidth < 430 ? 208 : 224;
    const SWIPE_OPEN_THRESHOLD_RATIO = viewportWidth < 360 ? 0.26 : viewportWidth < 430 ? 0.3 : 0.35;
    const rowId = inboxConversationRowId(conv);
    const isGroupRow = conv.kind === 'group';
    const displayTitle = isGroupRow
        ? (conv.groupName || 'Group chat')
        : (conv.displayName?.trim() || displayHandle(conv.otherHandle));
    const preview = conversationPreviewText(conv, currentUserHandle);
    const timestamp = compactInboxTime(conv.lastMessage?.timestamp);
    const hasStory = !isGroupRow && (conv.hasUnviewedStories || false);
    const [swipeOffset, setSwipeOffset] = React.useState(0);
    const [pulseOpen, setPulseOpen] = React.useState(false);
    const touchStartXRef = React.useRef<number | null>(null);
    const touchStartYRef = React.useRef<number | null>(null);
    const touchLastXRef = React.useRef<number | null>(null);
    const touchLastTsRef = React.useRef<number | null>(null);
    const touchStartTsRef = React.useRef<number | null>(null);
    const swipeStartOffsetRef = React.useRef(0);
    const isSwipingRef = React.useRef(false);

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
    const rowShadow = revealProgress > 0 ? '0 8px 24px rgba(255, 255, 255, 0.08)' : 'none';

    return (
        <div className="relative overflow-hidden" data-conversation-row="true">
            <div
                className="pointer-events-none absolute inset-0 rounded-lg"
                style={{
                    opacity: revealProgress * 0.9,
                    background: 'linear-gradient(90deg, rgba(8,12,18,0) 0%, rgba(8,12,18,0.14) 45%, rgba(8,12,18,0.34) 100%)',
                    transition: isSwipingRef.current ? 'none' : 'opacity 180ms ease',
                }}
            />
            <div
                className="absolute inset-y-0 right-0 z-0 flex items-stretch"
                style={{
                    width: SWIPE_ACTION_WIDTH,
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
                        className="min-w-0 flex-1 bg-white/20 px-1 text-[10px] font-semibold leading-tight text-white"
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
                        className="min-w-0 flex-1 bg-white/25 px-1 text-[10px] font-semibold leading-tight text-white"
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
                        className="min-w-0 flex-1 bg-white/15 px-1 text-[10px] font-semibold leading-tight text-white"
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
                        className="min-w-0 flex-1 bg-red-600/90 px-1 text-[10px] font-semibold leading-tight text-white"
                        title={isGroupRow ? 'Leave group' : 'Delete conversation'}
                    >
                        {isGroupRow ? 'Leave' : 'Delete'}
                    </button>
                )}
            </div>

            <div
                className="relative z-10 flex items-center gap-3.5 border-b border-white/[0.06] bg-transparent px-4 py-3"
                style={{
                    transform: `translateX(-${swipeOffset}px) scale(${rowScale})`,
                    transformOrigin: 'right center',
                    boxShadow: pulseOpen ? '0 0 0 2px rgba(255, 255, 255, 0.35)' : rowShadow,
                    transition: isSwipingRef.current ? 'none' : 'transform 180ms ease, box-shadow 180ms ease',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={(event) => {
                    event.preventDefault();
                    closeSwipeActions();
                    onOpenChatInfo?.(conv);
                }}
            >
            <div className="relative h-14 w-14 flex-shrink-0 overflow-visible">
                <Avatar
                    name={displayTitle}
                    src={
                        isGroupRow
                            ? conv.groupAvatarUrl || undefined
                            : (getAvatarSrc ? getAvatarSrc(conv.otherHandle) : undefined) ||
                              conv.avatarUrl ||
                              getAvatarForHandle(conv.otherHandle) ||
                              undefined
                    }
                    size={52}
                    hideBorder={!hasStory}
                    hasStory={hasStory}
                    onClick={handleAvatarClick}
                />
            </div>
            <button
                type="button"
                onClick={handleConversationClick}
                className="min-w-0 flex-1 text-left"
            >
                <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={`truncate text-[16px] text-white ${conv.unread > 0 ? 'font-bold' : 'font-semibold'}`}>{displayTitle}</span>
                    <span className="shrink-0 text-[13px] text-[#8E8E93]">{timestamp}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`min-w-0 flex-1 truncate text-[14px] ${conv.unread > 0 ? 'font-semibold text-white' : 'text-[#8E8E93]'}`}>{preview}</div>
                    {conv.unread > 0 ? (
                        <span className="shrink-0 min-w-[18px] rounded-full bg-white px-1.5 text-center text-[11px] font-bold leading-[18px] text-black">
                            {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                    ) : null}
                </div>
            </button>
            </div>
        </div>
    );
}

export default function InboxPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [inboxPost, setInboxPost] = React.useState<Post | null>(null);
    const [inboxPostComments, setInboxPostComments] = React.useState(false);
    const [inboxSharePost, setInboxSharePost] = React.useState<Post | null>(null);
    const [insights, setInsights] = React.useState<StoryInsight[]>([]);
    const [unavailableStoryIds, setUnavailableStoryIds] = React.useState<Set<string>>(new Set());
    const [storyGroups, setStoryGroups] = React.useState<StoryGroup[]>([]);
    const [items, setItems] = React.useState<ConversationSummary[]>([]);
    const [pendingInvites, setPendingInvites] = React.useState<ChatGroupInviteRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<'insights' | 'notifications' | 'messages' | 'groups'>('messages');
    const [messageFilter, setMessageFilter] = React.useState<'all' | 'requests'>('all');
    const [openSwipeHandle, setOpenSwipeHandle] = React.useState<string | null>(null);
    const [inboxChatInfo, setInboxChatInfo] = React.useState<ConversationSummary | null>(null);
    const [compactPhone, setCompactPhone] = React.useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 390 : false));
    const [storyThumbMenu, setStoryThumbMenu] = React.useState<{ fromHandle: string; storyId: string } | null>(null);
    const [insightLikersModal, setInsightLikersModal] = React.useState<{ storyId: string; likers: string[] } | null>(null);
    const [insightAvatarMap, setInsightAvatarMap] = React.useState<Record<string, string>>({});
    const [dmAvatarMap, setDmAvatarMap] = React.useState<Record<string, string>>({});
    const insightAvatarFetchInFlightRef = React.useRef<Set<string>>(new Set());
    const storyThumbLongPressTimerRef = React.useRef<number | null>(null);
    const storyThumbLongPressTriggeredRef = React.useRef(false);
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

    const clearStoryThumbLongPressTimer = React.useCallback(() => {
        if (storyThumbLongPressTimerRef.current !== null) {
            window.clearTimeout(storyThumbLongPressTimerRef.current);
            storyThumbLongPressTimerRef.current = null;
        }
    }, []);

    const openStoryFromNotification = React.useCallback((fromHandle: string, storyId: string) => {
        navigate('/stories', {
            state: {
                openUserHandle: fromHandle,
                openStoryId: storyId,
            },
        });
    }, [navigate]);

    const getInsightsSeenStorageKey = React.useCallback(
        (handle: string) => `clips:insights-seen:${String(handle || '').trim().toLowerCase()}`,
        []
    );

    const getSeenInsightStoryIds = React.useCallback((handle: string): Set<string> => {
        try {
            const raw = localStorage.getItem(getInsightsSeenStorageKey(handle));
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return new Set<string>();
            return new Set(parsed.filter((v) => typeof v === 'string' && v.trim().length > 0));
        } catch {
            return new Set<string>();
        }
    }, [getInsightsSeenStorageKey]);

    const saveSeenInsightStoryIds = React.useCallback((handle: string, ids: Set<string>) => {
        try {
            localStorage.setItem(getInsightsSeenStorageKey(handle), JSON.stringify(Array.from(ids)));
        } catch {
            /* ignore */
        }
    }, [getInsightsSeenStorageKey]);

    const markInsightSeen = React.useCallback((storyId?: string) => {
        if (!user?.handle || !storyId) return;
        const seen = getSeenInsightStoryIds(user.handle);
        if (seen.has(storyId)) return;
        seen.add(storyId);
        saveSeenInsightStoryIds(user.handle, seen);
    }, [user?.handle, getSeenInsightStoryIds, saveSeenInsightStoryIds]);

    const markAllInsightsSeen = React.useCallback(() => {
        if (!user?.handle || !insights.length) return;
        const seen = getSeenInsightStoryIds(user.handle);
        insights.forEach((insight) => {
            if (insight.storyId) seen.add(insight.storyId);
        });
        saveSeenInsightStoryIds(user.handle, seen);
        // Trigger rerender to refresh unseen badge/count immediately.
        setInsights((prev) => [...prev]);
    }, [user?.handle, insights, getSeenInsightStoryIds, saveSeenInsightStoryIds]);

    const openInboxChatInfo = React.useCallback((c: ConversationSummary) => {
        setOpenSwipeHandle(null);
        setInboxChatInfo(c);
    }, []);

    React.useEffect(() => {
        setOpenSwipeHandle(null);
        setInboxChatInfo(null);
    }, [activeTab, messageFilter]);

    React.useEffect(() => {
        const onResize = () => setCompactPhone(typeof window !== 'undefined' ? window.innerWidth <= 390 : false);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    React.useEffect(() => {
        return () => {
            clearStoryThumbLongPressTimer();
        };
    }, [clearStoryThumbLongPressTimer]);

    React.useEffect(() => {
        if (user?.handle && user?.avatarUrl) {
            setAvatarForHandle(user.handle, user.avatarUrl);
            setDmAvatarMap((prev) => ({ ...prev, [user.handle]: user.avatarUrl! }));
            setInsightAvatarMap((prev) => ({ ...prev, [user.handle]: user.avatarUrl! }));
        }
    }, [user?.handle, user?.avatarUrl]);

    React.useEffect(() => {
        const handles = Array.from(
            new Set(
                insights
                    .flatMap((insight) => [
                        ...(insight.likers || []),
                        ...(insight.viewers || []),
                    ])
                    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
            )
        );
        const missing = handles.filter((handle) => !resolveInsightAvatar(handle));
        if (missing.length === 0) return;

        missing.forEach((handle) => {
            const fetchKey = normalizeHandleKey(handle) || handle;
            if (insightAvatarFetchInFlightRef.current.has(fetchKey)) return;
            insightAvatarFetchInFlightRef.current.add(fetchKey);
            fetchUserProfile(fetchKey, user?.id)
                .then((profile: any) => {
                    const avatarUrl = extractAvatarUrl(profile);
                    if (avatarUrl.length > 0) {
                        setAvatarForHandle(fetchKey, avatarUrl);
                        setInsightAvatarMap((prev) => ({ ...prev, [handle]: avatarUrl, [fetchKey]: avatarUrl }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    insightAvatarFetchInFlightRef.current.delete(fetchKey);
                });
        });
    }, [insights, resolveInsightAvatar, user?.id]);

    React.useEffect(() => {
        const known: Record<string, string> = {};
        const remember = (handle: string, avatar?: string | null) => {
            const url = typeof avatar === 'string' ? avatar.trim() : '';
            if (!handle.trim() || !url) return;
            setAvatarForHandle(handle, url);
            known[handle] = url;
        };
        items.forEach((conv) => {
            if (conv.kind === 'group') return;
            remember(conv.otherHandle, conv.avatarUrl);
        });
        notifications.forEach((note) => {
            remember(note.fromHandle, note.fromAvatarUrl);
        });
        if (Object.keys(known).length === 0) return;
        setDmAvatarMap((prev) => {
            let dirty = false;
            const merged = { ...prev };
            Object.entries(known).forEach(([handle, url]) => {
                if (merged[handle] !== url) {
                    merged[handle] = url;
                    dirty = true;
                }
            });
            return dirty ? merged : prev;
        });
    }, [notifications, items]);

    const loadData = React.useCallback(async () => {
        if (!user?.handle) return;
        setLoadError(null);
        try {
            const [notifs, storyInsights, conversations, followedUsers, pending] = await Promise.all([
                getNotifications(user.handle),
                getStoryInsightsForUser(user.handle),
                listConversations(user.handle),
                user?.id ? getFollowedUsers(user.id).catch(() => [] as string[]) : Promise.resolve([] as string[]),
                fetchPendingGroupInvites().catch(() => [] as ChatGroupInviteRow[]),
            ]);
            const pendingRows = Array.isArray(pending) ? pending : [];
            const pendingIds = new Set(pendingRows.map((invite) => invite.id));
            setPendingInvites(pendingRows);
            
            // Add follow status to conversations
            const conversationsWithFollowStatus = conversations.map(conv => ({
                ...conv,
                isFollowing: conv.kind === 'group' ? false : (followedUsers as string[]).includes(conv.otherHandle),
            }));
            
            const prefs = getNotificationPreferences();

            // Convert conversations to notifications format so they appear in Notifs tab
            // Only include conversations where the OTHER person sent the last message (not the user)
            const existingNotifHandles = new Set(notifs.filter(n => n.type === 'dm' || n.type === 'sticker' || n.type === 'reply').map(n => n.fromHandle));
            const conversationNotifications: Notification[] = conversations
                .filter(conv => {
                    // Only include if:
                    // 1. Has a last message
                    // 2. The OTHER person sent the last message (not the user)
                    // 3. Doesn't already have a notification for this handle
                    if (conv.kind === 'group') {
                        // Group conversation activity can surface in Notifs when Group Chat notifications are enabled.
                        if (!isNotificationTypeEnabled(prefs, 'group_chat')) return false;
                        if (!conv.chatGroupId || !conv.lastMessage) return false;
                        if (conv.lastMessage.senderHandle === user.handle) return false;
                        if (conv.unread === 0) return false;
                        return true;
                    }
                    if (!conv.lastMessage) return false;
                    if (conv.lastMessage.senderHandle === user.handle) return false; // User sent it, don't create notification
                    if (existingNotifHandles.has(conv.otherHandle)) return false; // Already has notification
                    if (!isNotificationTypeEnabled(prefs, 'dm')) return false;
                    return true;
                })
                .map(conv => {
                    // TypeScript: we know lastMessage exists and was sent by other person because of the filter above
                    const lastMsg = conv.lastMessage!;
                    if (conv.kind === 'group' && conv.chatGroupId) {
                        return {
                            id: `group-conv-${conv.chatGroupId}-${lastMsg.timestamp || Date.now()}`,
                            type: 'dm' as const,
                            fromHandle: conv.groupName || 'Group',
                            toHandle: user.handle,
                            message: lastMsg.text || '',
                            chatGroupId: conv.chatGroupId,
                            groupName: conv.groupName,
                            timestamp: lastMsg.timestamp || Date.now(),
                            read: conv.unread === 0
                        };
                    }
                    return {
                        id: `conv-${conv.otherHandle}-${lastMsg.timestamp || Date.now()}`,
                        type: 'dm' as const,
                        fromHandle: conv.otherHandle,
                        toHandle: user.handle,
                        message: lastMsg.text || '',
                        storyId: lastMsg.storyId,
                        imageUrl: lastMsg.storyId ? lastMsg.imageUrl : undefined,
                        storyContextText: lastMsg.storyContextText,
                        storyContextOwner: lastMsg.storyContextOwner,
                        timestamp: lastMsg.timestamp || Date.now(),
                        read: conv.unread === 0 // Mark as read if no unread messages
                    };
                });
            
            // Combine notifications and conversations, sorted by timestamp (newest first)
            const allNotifications = [
                ...notifs.filter((n) => {
                    if (n.type === 'group_invite') {
                        if (n.inviteStatus && n.inviteStatus !== 'pending') return false;
                        if (n.chatGroupInviteId && pendingIds.has(n.chatGroupInviteId)) return false;
                    }
                    return (
                        countsTowardInboxNotificationBadge(n.type) ||
                        isPostRelatedInboxNotification(n) ||
                        isFollowInboxNotification(n)
                    );
                }),
                ...conversationNotifications,
            ].sort((a, b) => b.timestamp - a.timestamp);

            // Resolve whether story-reply notifications still point to active stories.
            const storyReplyNotifs = allNotifications.filter((n) => !!n.storyId && !!n.fromHandle && !n.chatGroupId);
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
                    activeStoryIdsByHandle.set(
                        handle,
                        new Set((group?.stories || []).map((s) => s.id))
                    );
                });
                const unavailable = new Set<string>();
                storyReplyNotifs.forEach((n) => {
                    const storyId = n.storyId;
                    if (!storyId) return;
                    const activeIds = activeStoryIdsByHandle.get(n.fromHandle);
                    if (!activeIds || !activeIds.has(storyId)) unavailable.add(storyId);
                });
                setUnavailableStoryIds(unavailable);
            } else {
                setUnavailableStoryIds(new Set());
            }
            
            setNotifications(allNotifications);
            setInsights(storyInsights);
            setItems(conversationsWithFollowStatus);

            // Load story groups for followed users (for the horizontal stories row)
            if (user?.id) {
                try {
                    const groups = await fetchFollowedUsersStoryGroups(user.id, followedUsers as string[]);
                    // Enrich with the signed-in user's photo, or the stored profile photo.
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
            const message = describeFetchError(error);
            console.error('Error loading inbox data:', message, error);
            setLoadError(message);
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
            void loadData();
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
                const result = await toggleFollow(handle);
                s.follows[handle] = result && typeof result.following === 'boolean' ? result.following : false;
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
                } catch (apiError) {
                    throw apiError;
                }
            } else {
                const result = await toggleFollow(handle);
                if (result && typeof result.following === 'boolean') {
                    s.follows[handle] = result.following;
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

    const inboxUnreadParts = inboxUnreadPartsFromLists(items, notifications);
    const unreadNotifications = inboxUnreadParts.notifications;
    const unreadMessages = inboxUnreadParts.messages;
    const unreadGroups = inboxUnreadParts.groups;
    const unreadMessagesTotal = unreadMessages;

    React.useEffect(() => {
        if (!user?.handle) return;
        publishInboxUnreadParts({
            handle: user.handle,
            messages: unreadMessages,
            groups: unreadGroups + pendingInvites.length,
            notifications: unreadNotifications,
        });
    }, [user?.handle, unreadMessages, unreadGroups, unreadNotifications, pendingInvites.length]);
    const requestItems = items.filter((c) => c.kind !== 'group' && !!c.isRequest);
    const chatItems = items.filter((c) => !(c.kind !== 'group' && c.isRequest));
    const pinnedItems = chatItems.filter((c) => c.isPinned);
    const regularItems = chatItems.filter((c) => !c.isPinned);
    const groupItems = items.filter((c) => c.kind === 'group');
    const groupHeaderCount = unreadGroups + pendingInvites.length;
    const seenInsightIds = React.useMemo(
        () => (user?.handle ? getSeenInsightStoryIds(user.handle) : new Set<string>()),
        [user?.handle, insights, getSeenInsightStoryIds]
    );
    const actionableInsights = React.useMemo(
        () =>
            insights.filter(
                (insight) =>
                    (insight.views || 0) > 0 ||
                    (insight.likes > 0 && Array.isArray(insight.likers) && insight.likers.length > 0) ||
                    (Array.isArray(insight.reactions) && insight.reactions.length > 0) ||
                    (Array.isArray(insight.replies) && insight.replies.length > 0)
            ),
        [insights]
    );
    const unseenInsightsCount = React.useMemo(
        () =>
            actionableInsights.filter((insight) => insight.storyId && !seenInsightIds.has(insight.storyId))
                .length,
        [actionableInsights, seenInsightIds]
    );
    const insightsOverview = React.useMemo(
        () =>
            summarizeStoryInsights(actionableInsights, {
                local: user?.local,
                regional: user?.regional,
                national: user?.national,
            }),
        [actionableInsights, user?.local, user?.national, user?.regional],
    );

    if (!user) {
        return <div className="p-6">Please sign in to view notifications.</div>;
    }

    const handleNotificationClick = (notif: Notification) => {
        const route = resolveInboxNotificationRoute(notif);

        if (route.dest === 'post') {
            void getPostById(route.postId).then((post) => {
                if (post) {
                    setInboxPost(post);
                    setInboxPostComments(!!route.openComments);
                    return;
                }
                console.warn('[inbox] notification missing loadable post', notif.id, route.postId);
                if (notif.fromHandle) {
                    navigate(`/user/${encodeURIComponent(notif.fromHandle)}`);
                }
            });
        } else if (route.dest === 'profile') {
            navigate(`/user/${encodeURIComponent(route.handle)}`, {
                state: route.sourcePostId ? { sourcePostId: route.sourcePostId } : undefined,
            });
        } else if (route.dest === 'story') {
            navigate('/stories', {
                state: { openUserHandle: route.handle, openStoryId: route.storyId },
            });
        } else if (route.dest === 'messages') {
            if (route.chatGroupId) {
                navigate(`/messages/group/${encodeURIComponent(route.chatGroupId)}`);
            } else if (route.handle) {
                navigate(`/messages/${encodeURIComponent(route.handle)}`);
            }
        }

        if (!notif.read && user?.handle) {
            setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
            void markNotificationRead(notif.id, user.handle);
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
            case 'follow_request': {
                const who = followRequestIdentity(notif);
                return who.handle
                    ? `${who.handle} wants to follow you`
                    : `${who.title} wants to follow you`;
            }
            case 'new_post':
                return notif.message || 'posted a new clip';
            case 'like':
                return notif.message || 'liked your post';
            case 'share':
                return notif.message || 'shared your post';
            case 'reclip':
                return notif.message || 'reclipped your post';
            case 'follow':
                return notif.message || 'started following you';
            case 'group_invite':
                return notif.message || `invited you to join ${notif.groupName || 'a group'}`;
            default:
                return notif.message || '';
        }
    };

    const getNotificationIcon = (notif: Notification) => {
        const cls = 'w-5 h-5 text-gray-700 dark:text-white';
        switch (resolveNotificationKind(notif)) {
            case 'sticker':
                return <FiSmile className={cls} />;
            case 'reply':
                return <FiCornerUpLeft className={cls} />;
            case 'comment':
                return <FiMessageCircle className={cls} />;
            case 'like':
                return <FiHeart className={cls} />;
            case 'share':
                return <FiShare2 className={cls} />;
            case 'reclip':
                return <FiRepeat className={cls} />;
            case 'follow':
            case 'follow_request':
                return <FiUserPlus className={cls} />;
            case 'group_invite':
                return <FiUsers className={cls} />;
            case 'dm':
                return <FiMessageCircle className={cls} />;
            case 'new_post':
                return <FiBell className={cls} />;
            default:
                return <FiBell className={cls} />;
        }
    };

    const handleAcceptFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle || !user?.id) return;
        
        try {
            // Accept the follow request via API. They follow you; do not follow them back.
            const { acceptFollowRequest: acceptFollowRequestAPI } = await import('../api/client');
            await acceptFollowRequestAPI(notif.fromHandle);
            
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
            
            const requesterName = (notif.fromDisplayName || notif.fromHandle || 'They').trim();
            Swal.fire(bottomSheet({
                title: 'Follow Request Accepted',
                message: `${requesterName} is now following you`,
                icon: 'success',
            }));
        } catch (error) {
            console.error('Error accepting follow request:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to accept follow request', icon: 'alert' }));
        }
    };

    const handleGroupInviteDecision = async (
        notif: Notification,
        decision: 'accept' | 'decline',
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        if (!notif.chatGroupInviteId) return;
        try {
            if (decision === 'accept') {
                await acceptChatGroupInvite(notif.chatGroupInviteId);
            } else {
                await declineChatGroupInvite(notif.chatGroupInviteId);
            }
            setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
            setPendingInvites((prev) => prev.filter((invite) => invite.id !== notif.chatGroupInviteId));
            await loadData();
        } catch (error) {
            console.error('Error responding to group invite:', error);
            Swal.fire(bottomSheet({
                title: 'Invite',
                message: error instanceof Error ? error.message : 'Could not update this invite',
                icon: 'alert',
            }));
        }
    };

    const handleDenyFollowRequest = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.handle) return;
        
        try {
            // Deny the follow request via API
            const { denyFollowRequest: denyFollowRequestAPI } = await import('../api/client');
            await denyFollowRequestAPI(notif.fromHandle);
            
            await deleteNotification(notif.id, user.handle);
            await loadData();
        } catch (error) {
            console.error('Error denying follow request:', error);
            Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to deny follow request', icon: 'alert' }));
        }
    };

    return (
        <div className={compactPhone ? 'p-3' : 'p-4'}>
            <div className="mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate('/feed')}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                    aria-label="Back to feed"
                >
                    <FiChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="flex-1 text-[22px] font-bold text-white">
                    {activeTab === 'messages' && messageFilter === 'requests'
                        ? 'Requests'
                        : activeTab === 'notifications'
                          ? 'Notifications'
                          : activeTab === 'insights'
                            ? 'Insights'
                            : 'Messages'}
                </h1>
                {activeTab === 'messages' && requestItems.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setMessageFilter((prev) => (prev === 'requests' ? 'all' : 'requests'))}
                        className={`text-[15px] font-semibold ${messageFilter === 'requests' ? 'text-white' : 'text-white/60'}`}
                    >
                        {messageFilter === 'requests' ? 'Chats' : `Requests (${requestItems.length})`}
                    </button>
                ) : null}
            </div>

            {/* Stories row (TikTok / Instagram style) */}
            {storyGroups.length > 0 && (
                <div className="mb-4 overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-3 px-0.5">
                        {storyGroups.map((group) => (
                            (() => {
                                return (
                            <button
                                key={group.userId || group.userHandle}
                                type="button"
                                onClick={() => {
                                    const railHandles = storyGroups
                                        .map((g) => g.userHandle)
                                        .filter(Boolean);
                                    const latest = [...(group.stories || [])].sort(
                                        (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
                                    )[0];
                                    const mediaUrl = latest?.mediaUrl;
                                    const isVideo =
                                        latest?.mediaType === 'video' ||
                                        (!!mediaUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl));
                                    navigate('/stories', {
                                        state: {
                                            openUserHandle: group.userHandle,
                                            fromStories24Rail: true,
                                            skipStories24RailReturn: true,
                                            railHandles,
                                            previewThumb:
                                                (!isVideo && mediaUrl) ||
                                                group.avatarUrl ||
                                                undefined,
                                            previewVideoUrl: isVideo && mediaUrl ? mediaUrl : undefined,
                                        },
                                    });
                                }}
                                className="flex flex-col items-center gap-1 flex-shrink-0"
                            >
                                <div className="relative">
                                    {/* Story ring */}
                                    <div
                                        className="h-14 w-14 rounded-full bg-white p-px"
                                    >
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
                                );
                            })()
                        ))}
                    </div>
                </div>
            )}

            {loadError ? (
                <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/15 px-3 py-2.5">
                    <div className="text-sm font-semibold text-red-100">Could not load inbox</div>
                    <p className="mt-1 text-xs text-red-100/80">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => void loadData()}
                        className="mt-2 text-xs font-semibold text-white underline"
                    >
                        Retry
                    </button>
                </div>
            ) : null}

            {/* Tabs */}
            <div className="flex mb-4 border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'messages'
                            ? 'text-white border-b-2 border-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Messages</span>
                    {unreadMessagesTotal > 0 && (
                        <span className="px-1 py-0.5 bg-white text-gray-900 text-[9px] rounded-full min-w-[16px] text-center leading-none font-semibold">
                            {unreadMessagesTotal > 9 ? '9+' : unreadMessagesTotal}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('groups')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'groups'
                            ? 'text-white border-b-2 border-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Groups</span>
                    {groupHeaderCount > 0 && (
                        <span className="px-1 py-0.5 bg-white text-gray-900 text-[9px] rounded-full min-w-[16px] text-center leading-none font-semibold">
                            {groupHeaderCount > 9 ? '9+' : groupHeaderCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'notifications'
                            ? 'text-white border-b-2 border-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Notifs</span>
                    {unreadNotifications > 0 && (
                        <span className="px-1 py-0.5 bg-white text-gray-900 text-[9px] rounded-full min-w-[16px] text-center leading-none font-semibold">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center justify-center gap-1 ${activeTab === 'insights'
                            ? 'text-white border-b-2 border-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    <span>Insights</span>
                    {unseenInsightsCount > 0 && (
                        <span className="px-1 py-0.5 bg-white text-gray-900 text-[9px] rounded-full min-w-[16px] text-center leading-none font-semibold">
                            {unseenInsightsCount > 9 ? '9+' : unseenInsightsCount}
                        </span>
                    )}
                </button>
            </div>
            {loading ? (
                <div className="w-full" role="status" aria-label="Loading messages">
                    <div className="pt-1">
                        {Array.from({ length: 7 }, (_, i) => (
                            <div
                                key={i}
                                className="mx-2 flex items-center gap-2.5 px-1.5 py-3 animate-pulse"
                                style={{ animationDelay: `${i * 70}ms` }}
                            >
                                <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div
                                        className="h-2.5 rounded bg-white/15"
                                        style={{ width: `${36 + ((i * 11) % 28)}%` }}
                                    />
                                    <div
                                        className="h-2 rounded bg-white/10"
                                        style={{ width: `${48 + ((i * 9) % 26)}%` }}
                                    />
                                </div>
                                <div className="mt-0.5 h-2 w-7 shrink-0 rounded bg-white/10 self-start" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeTab === 'messages' ? (
                (messageFilter === 'requests' ? requestItems : chatItems).length === 0 ? (
                    <div className="py-8 text-center text-[#8E8E93]">
                        {messageFilter === 'requests' ? 'No message requests.' : 'No messages yet.'}
                    </div>
                ) : (
                    <div
                        className={compactPhone ? '-mx-3' : '-mx-4'}
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
                        {messageFilter === 'all' && (
                            <div>
                        {/* Pinned Conversations */}
                        {pinnedItems.length > 0 && (
                            <div>
                                <div className="px-3.5 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Pinned</div>
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
                                        onOpenChatInfo={openInboxChatInfo}
                                        compactPhone={compactPhone}
                                        getAvatarSrc={(handle) => dmAvatarMap[handle] || getAvatarForHandle(handle)}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {regularItems.length > 0 && pinnedItems.length > 0 ? (
                            <div className="px-3.5 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Messages</div>
                        ) : null}
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
                                onOpenChatInfo={openInboxChatInfo}
                                compactPhone={compactPhone}
                                getAvatarSrc={(handle) => dmAvatarMap[handle] || getAvatarForHandle(handle)}
                            />
                        ))}
                    </div>
                        )}

                        {messageFilter === 'requests' && requestItems.map(conv => (
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
                                onToggleMute={() => handleToggleMuteConversation(conv)}
                                onDeleteConversation={() => handleDeleteConversation(conv)}
                                onMarkRead={() => handleMarkConversationRead(conv)}
                                onMarkUnread={() => handleMarkConversationUnread(conv)}
                                isSwipeOpen={openSwipeHandle === inboxConversationRowId(conv)}
                                onSwipeOpenChange={setOpenSwipeHandle}
                                onOpenChatInfo={openInboxChatInfo}
                                getAvatarSrc={(handle) => dmAvatarMap[handle] || getAvatarForHandle(handle)}
                            />
                        ))}

                    </div>
                )
            ) : activeTab === 'notifications' ? (
                notifications.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">No notifications yet.</div>
                ) : (
                    <div className="space-y-2">
                        {pendingInvites.length > 0 ? (
                            <div className="mb-3 space-y-2">
                                <h2 className="px-1 pb-1 pt-1 text-[13px] font-semibold text-white/55">Group invites</h2>
                                {pendingInvites.map((invite) => {
                                    const inviterHandle = pendingInviteInviterHandle(invite);
                                    const groupName = pendingInviteGroupName(invite);
                                    const title = invite.inviter?.display_name || inviterHandle || 'Someone';
                                    return (
                                        <div key={invite.id} className="w-full rounded-xl border border-white/10 bg-[#161b22] p-3">
                                            <div className="font-medium text-white">{title}</div>
                                            {inviterHandle && title.toLowerCase() !== inviterHandle.toLowerCase() ? (
                                                <div className="text-xs text-gray-300">{inviterHandle}</div>
                                            ) : null}
                                            <div className="text-xs text-gray-400">invited you to join</div>
                                            <div className="text-sm font-bold text-white">{groupName}</div>
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleGroupInviteDecision(
                                                            {
                                                                id: invite.id,
                                                                type: 'group_invite',
                                                                fromHandle: inviterHandle,
                                                                toHandle: user?.handle || '',
                                                                chatGroupInviteId: invite.id,
                                                                groupName,
                                                                timestamp: Date.now(),
                                                                read: false,
                                                            },
                                                            'accept',
                                                            { stopPropagation() {} } as React.MouseEvent,
                                                        );
                                                    }}
                                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#111827]"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleGroupInviteDecision(
                                                            {
                                                                id: invite.id,
                                                                type: 'group_invite',
                                                                fromHandle: inviterHandle,
                                                                toHandle: user?.handle || '',
                                                                chatGroupInviteId: invite.id,
                                                                groupName,
                                                                timestamp: Date.now(),
                                                                read: false,
                                                            },
                                                            'decline',
                                                            { stopPropagation() {} } as React.MouseEvent,
                                                        );
                                                    }}
                                                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#E5E7EB]"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                        {unreadNotifications > 0 && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={async () => {
                                        if (user?.handle) {
                                            await markAllNotificationsRead(user.handle);
                                            await loadData();
                                        }
                                    }}
                                    className="text-xs text-white hover:text-white/70"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        )}
                        {groupNotificationsIntoSections(notifications).map((section) => (
                            <div key={section.id}>
                                <h2 className="px-1 pb-1 pt-4 text-[13px] font-semibold text-white/55">
                                    {section.label}
                                </h2>
                                {section.items.map(notif => {
                            const requester = notif.type === 'follow_request' ? followRequestIdentity(notif) : null;
                            const groupInvite = notif.type === 'group_invite' ? groupInvitePresentation(notif) : null;
                            const canRespondToInvite =
                                !!groupInvite &&
                                !!notif.chatGroupInviteId &&
                                (!notif.inviteStatus || notif.inviteStatus === 'pending');
                            return (
                            <div
                                key={notif.id}
                                className={`w-full rounded-xl bg-[#161b22] p-3 mb-2 border ${
                                    notif.read
                                        ? 'border-white/5'
                                        : 'border-l-4 border-l-emerald-400 border-white/10'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleNotificationClick(notif)}
                                        className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
                                    >
                                        <div className="mt-1 flex-shrink-0">
                                            {getNotificationIcon(notif)}
                                        </div>
                                        <Avatar
                                            name={notif.fromDisplayName || notif.groupName || notif.fromHandle}
                                            src={notif.chatGroupId ? undefined : (notif.fromAvatarUrl || dmAvatarMap[notif.fromHandle] || getAvatarForHandle(notif.fromHandle))}
                                            size="sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                            {requester ? (
                                                <>
                                                    <div className="font-medium truncate text-white">
                                                        {requester.title}
                                                    </div>
                                                    {requester.showHandle ? (
                                                        <div className="text-xs text-gray-300 truncate">
                                                            {requester.handle}
                                                        </div>
                                                    ) : null}
                                                    <div className="text-xs text-gray-400 truncate">
                                                        wants to follow you
                                                    </div>
                                                    {requester.isPrivate ? (
                                                        <div className="text-[11px] font-semibold text-[#F8D26A] truncate">
                                                            Private profile
                                                        </div>
                                                    ) : null}
                                                </>
                                            ) : groupInvite ? (
                                                <>
                                                    <div className="font-medium truncate text-white">
                                                        {groupInvite.title}
                                                    </div>
                                                    {groupInvite.showHandle ? (
                                                        <div className="text-xs text-gray-300 truncate">
                                                            {groupInvite.handle}
                                                        </div>
                                                    ) : null}
                                                    <div className="text-xs text-gray-400 truncate">
                                                        invited you to join
                                                    </div>
                                                    <div className="truncate text-sm font-bold text-white">
                                                        {groupInvite.groupName}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="font-medium truncate text-white">
                                                        {notif.groupName || notif.fromHandle}
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {formatNotificationMessage(notif)}
                                                    </div>
                                                </>
                                            )}
                                            {notif.storyId && (
                                                unavailableStoryIds.has(notif.storyId) ? (
                                                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-1">
                                                        <span className="text-[10px] text-red-300">Story unavailable</span>
                                                    </div>
                                                ) : notif.imageUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!notif.storyId) return;
                                                            if (storyThumbLongPressTriggeredRef.current) {
                                                                storyThumbLongPressTriggeredRef.current = false;
                                                                return;
                                                            }
                                                            openStoryFromNotification(notif.fromHandle, notif.storyId);
                                                        }}
                                                        onPointerDown={(e) => {
                                                            e.stopPropagation();
                                                            if (!notif.storyId) return;
                                                            storyThumbLongPressTriggeredRef.current = false;
                                                            clearStoryThumbLongPressTimer();
                                                            storyThumbLongPressTimerRef.current = window.setTimeout(() => {
                                                                storyThumbLongPressTriggeredRef.current = true;
                                                                setStoryThumbMenu({ fromHandle: notif.fromHandle, storyId: notif.storyId! });
                                                            }, 420);
                                                        }}
                                                        onPointerUp={clearStoryThumbLongPressTimer}
                                                        onPointerCancel={clearStoryThumbLongPressTimer}
                                                        onPointerLeave={clearStoryThumbLongPressTimer}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!notif.storyId) return;
                                                            setStoryThumbMenu({ fromHandle: notif.fromHandle, storyId: notif.storyId });
                                                        }}
                                                        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 hover:bg-white/10 transition-colors"
                                                        aria-label="Open story that was replied to"
                                                    >
                                                        <StoryReplyThumb imageUrl={notif.imageUrl} />
                                                        <span className="text-[10px] text-white/70">
                                                            {notif.storyContextOwner ? `Shared from @${notif.storyContextOwner}` : 'Story context'}
                                                        </span>
                                                    </button>
                                                ) : null
                                            )}
                                        </div>
                                    </button>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <div className="text-[10px] text-gray-400">
                                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {!notif.read && (
                                            <span className="w-2 h-2 bg-white rounded-full"></span>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold leading-none bg-white/10 text-white/80 border border-white/15">
                                            {notificationKindLabel(notif)}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label="Delete notification"
                                            className="p-1.5 text-gray-400 hover:text-white"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void deleteNotification(notif.id, user.handle).then(() => {
                                                    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                                                });
                                            }}
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {canRespondToInvite && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-[4.75rem]">
                                        <button
                                            type="button"
                                            onClick={(e) => handleGroupInviteDecision(notif, 'accept', e)}
                                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#111827] transition-colors hover:bg-white/90"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleGroupInviteDecision(notif, 'decline', e)}
                                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#E5E7EB] transition-colors hover:bg-white/15"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}
                                {notif.type === 'follow_request' && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-[4.75rem]">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!notif.fromHandle) return;
                                                navigate(`/user/${encodeURIComponent(notif.fromHandle)}`);
                                            }}
                                            className="rounded-lg border border-white/35 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/10"
                                        >
                                            View profile
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleAcceptFollowRequest(notif, e)}
                                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#111827] transition-colors hover:bg-white/90"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDenyFollowRequest(notif, e)}
                                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#E5E7EB] transition-colors hover:bg-white/15"
                                        >
                                            Deny
                                        </button>
                                    </div>
                                )}
                            </div>
                            );
                        })}
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'groups' ? (
                <>
                {pendingInvites.length > 0 ? (
                    <div className="mb-3 space-y-2">
                        <h2 className="px-1 pb-1 text-[13px] font-semibold text-white/55">Group invites</h2>
                        {pendingInvites.map((invite) => {
                            const inviterHandle = pendingInviteInviterHandle(invite);
                            const groupName = pendingInviteGroupName(invite);
                            const title = invite.inviter?.display_name || inviterHandle || 'Someone';
                            return (
                                <div key={invite.id} className="rounded-xl border border-white/10 bg-[#161b22] p-3">
                                    <div className="font-medium text-white">{title}</div>
                                    <div className="text-xs text-gray-400">invited you to join</div>
                                    <div className="text-sm font-bold text-white">{groupName}</div>
                                    <div className="mt-2 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleGroupInviteDecision(
                                                    {
                                                        id: invite.id,
                                                        type: 'group_invite',
                                                        fromHandle: inviterHandle,
                                                        toHandle: user?.handle || '',
                                                        chatGroupInviteId: invite.id,
                                                        groupName,
                                                        timestamp: Date.now(),
                                                        read: false,
                                                    },
                                                    'accept',
                                                    { stopPropagation() {} } as React.MouseEvent,
                                                );
                                            }}
                                            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#111827]"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleGroupInviteDecision(
                                                    {
                                                        id: invite.id,
                                                        type: 'group_invite',
                                                        fromHandle: inviterHandle,
                                                        toHandle: user?.handle || '',
                                                        chatGroupInviteId: invite.id,
                                                        groupName,
                                                        timestamp: Date.now(),
                                                        read: false,
                                                    },
                                                    'decline',
                                                    { stopPropagation() {} } as React.MouseEvent,
                                                );
                                            }}
                                            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#E5E7EB]"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                {groupItems.length > 0 ? (
                    <div
                        className={compactPhone ? '-mx-3' : '-mx-4'}
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
                                onOpenChatInfo={openInboxChatInfo}
                                compactPhone={compactPhone}
                                getAvatarSrc={(handle) => dmAvatarMap[handle] || getAvatarForHandle(handle)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-5 text-center text-sm text-gray-400 leading-relaxed">
                        No group chats yet. Use <span className="text-white/90">New group</span> on your profile or{' '}
                        <span className="text-white/90">Create group</span> on your own post (⋯ menu), then invite people from the{' '}
                        <span className="text-white/90">Invite</span> button in the group or from their profile.
                    </div>
                )}
                </>
            ) : activeTab === 'insights' ? (
                !actionableInsights || actionableInsights.length === 0 ? (
                    <div className="text-gray-500">No story insights yet.</div>
                ) : (
                <div className="space-y-2">
                    {(() => {
                        const reachTotal =
                            insightsOverview.localViews +
                                insightsOverview.regionalViews +
                                insightsOverview.discoverViews || insightsOverview.totalViews;
                        const reachRows: Array<{ label: string; count: number; color: string }> = [
                            { label: 'Local', count: insightsOverview.localViews, color: '#34D399' },
                            { label: 'Regional', count: insightsOverview.regionalViews, color: '#00F2FF' },
                            { label: 'Discover', count: insightsOverview.discoverViews, color: '#A78BFA' },
                        ];
                        return (
                            <div className="rounded-xl border border-white/10 bg-[#161b22] p-3.5 mb-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-1">
                                    Creator analytics
                                </div>
                                <div className="text-white font-semibold text-[16px] mb-3">Story performance</div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {[
                                        { value: String(insightsOverview.totalViews), label: 'Total views' },
                                        { value: `${insightsOverview.completionRate}%`, label: 'Completion' },
                                        { value: String(insightsOverview.directShares), label: 'Direct shares' },
                                    ].map((tile) => (
                                        <div
                                            key={tile.label}
                                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center"
                                        >
                                            <div className="text-white text-lg font-bold">{tile.value}</div>
                                            <div className="text-[10px] text-slate-400 font-semibold mt-1">{tile.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
                                    <div
                                        className="h-full rounded-full bg-cyan-400"
                                        style={{ width: `${insightsOverview.completionRate}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-slate-400 mb-3.5">
                                    Viewers who reacted or replied · {insightsOverview.uniqueViewers} unique
                                </div>
                                <div className="text-white text-xs font-bold mb-2">Geographical reach</div>
                                {reachRows.map((row) => {
                                    const pct = reachPercent(row.count, reachTotal);
                                    return (
                                        <div key={row.label} className="mb-2">
                                            <div className="flex justify-between text-[12px] mb-1">
                                                <span className="text-gray-200 font-semibold">{row.label}</span>
                                                <span className="text-slate-400">
                                                    {row.count} · {pct}%
                                                </span>
                                            </div>
                                            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ width: `${pct}%`, backgroundColor: row.color }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                    {unseenInsightsCount > 0 && (
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={markAllInsightsSeen}
                                className="text-xs text-white hover:text-white/70"
                            >
                                Mark all seen
                            </button>
                        </div>
                    )}
                    {actionableInsights.map(insight => {
                        const primaryLiker = insight.likers?.[0];
                        const primaryViewer = insight.viewers?.[0];
                        const primaryHandle = primaryLiker || primaryViewer;
                        const rowStats = storyInsightRowStats(insight);
                        return (
                        <div
                            key={insight.storyId}
                            onClick={() => {
                                markInsightSeen(insight.storyId);
                            }}
                            className={`w-full text-left flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                seenInsightIds.has(insight.storyId)
                                    ? 'opacity-80'
                                    : 'bg-white/10 border-l-4 border-white'
                            }`}
                        >
                            {primaryHandle ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/user/${encodeURIComponent(primaryHandle)}`);
                                    }}
                                    className="rounded-full"
                                    aria-label={`Open ${primaryHandle} profile`}
                                >
                                    <Avatar
                                        name={primaryHandle}
                                        src={resolveInsightAvatar(primaryHandle)}
                                        size="sm"
                                    />
                                </button>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                    {insight.text 
                                        ? (insight.text.length > 40 ? insight.text.slice(0, 40) + '…' : insight.text) 
                                        : 'Story'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {insight.likes > 0 && insight.likers && insight.likers.length > 0 ? (
                                        <>
                                            Liked by{' '}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/user/${encodeURIComponent(insight.likers[0])}`);
                                                }}
                                                className="text-sky-300 underline hover:text-sky-200"
                                            >
                                                {insight.likers[0]}
                                            </button>
                                            {insight.likes > 1 ? (
                                                <>
                                                    {' and '}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setInsightLikersModal({ storyId: insight.storyId, likers: insight.likers || [] });
                                                        }}
                                                        className="text-sky-300 underline hover:text-sky-200"
                                                    >
                                                        {`${insight.likes - 1} others`}
                                                    </button>
                                                </>
                                            ) : ''}
                                        </>
                                    ) : insight.views > 0 && insight.viewers && insight.viewers.length > 0 ? (
                                        <>
                                            Viewed by{' '}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/user/${encodeURIComponent(insight.viewers![0])}`);
                                                }}
                                                className="text-sky-300 underline hover:text-sky-200"
                                            >
                                                {insight.viewers[0]}
                                            </button>
                                            {insight.views > 1 ? ` and ${insight.views - 1} others` : ''}
                                        </>
                                    ) : (
                                        'New story activity'
                                    )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-gray-300">
                                        {rowStats.views} views
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-gray-300">
                                        {rowStats.completionRate}% done
                                    </span>
                                    {rowStats.directShares > 0 ? (
                                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-gray-300">
                                            {rowStats.directShares} direct
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {new Date(insight.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    )})}
                </div>
            )
            ) : null}

            {(() => {
                const c = inboxChatInfo;
                if (!c) return null;
                const isGroupRow = c.kind === 'group' && !!c.chatGroupId;
                const title = isGroupRow ? (c.groupName || 'Group') : (c.displayName?.trim() || c.otherHandle);
                const closeSheet = () => setInboxChatInfo(null);
                const goOpenChat = () => {
                    closeSheet();
                    if (isGroupRow && c.chatGroupId) {
                        navigate(`/messages/group/${encodeURIComponent(c.chatGroupId)}`);
                    } else {
                        navigate(`/messages/${encodeURIComponent(c.otherHandle)}`);
                    }
                };
                const rowBtn =
                    'w-full text-left px-4 py-3.5 text-sm font-medium text-white hover:bg-white/10 active:bg-white/15 border-b border-white/10 last:border-b-0 flex items-center gap-3';
                const rowIcon = 'w-4 h-4 text-white/55 flex-shrink-0';
                return (
                    <div className="fixed inset-0 z-[55] flex flex-col justify-end sm:items-center sm:justify-end sm:p-4">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/60"
                            onClick={closeSheet}
                            aria-label="Close chat info"
                        />
                        <div
                            className="relative mx-0 mb-0 sm:mb-0 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/20 bg-black text-white shadow-[0_-12px_48px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col max-h-[min(85vh,620px)]"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="inbox-chat-info-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="h-1 w-10 rounded-full bg-white/25 mx-auto mt-2 sm:hidden shrink-0" aria-hidden />
                            <div className="flex items-start gap-3 p-4 border-b border-white/15">
                                <Avatar
                                    name={title}
                                    src={
                                        isGroupRow
                                            ? c.groupAvatarUrl || undefined
                                            : dmAvatarMap[c.otherHandle] || c.avatarUrl || getAvatarForHandle(c.otherHandle) || undefined
                                    }
                                    size="lg"
                                />
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <h2 id="inbox-chat-info-title" className="font-semibold text-lg text-white truncate">
                                        {title}
                                    </h2>
                                    {!isGroupRow && <p className="text-sm text-white/50 truncate">@{c.otherHandle}</p>}
                                    {c.lastMessage?.text ? (
                                        <p className="text-xs text-white/40 truncate mt-1">{c.lastMessage.text}</p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={closeSheet}
                                    className="p-2 rounded-full hover:bg-white/10 -mr-1 -mt-1 text-white"
                                    aria-label="Close"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="overflow-y-auto py-1 pb-safe">
                                <button type="button" className={rowBtn} onClick={goOpenChat}>
                                    <FiMessageCircle className={rowIcon} />
                                    Open chat
                                </button>
                                {!isGroupRow && (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            closeSheet();
                                            navigate(`/user/${encodeURIComponent(c.otherHandle)}`);
                                        }}
                                    >
                                        <FiUser className={rowIcon} />
                                        View profile
                                    </button>
                                )}
                                {c.isRequest && user?.handle ? (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            void acceptMessageRequest(user.handle, c.otherHandle)
                                                .then(() => loadData())
                                                .finally(closeSheet);
                                        }}
                                    >
                                        <FiCheck className={rowIcon} />
                                        Accept request
                                    </button>
                                ) : null}
                                {c.unread > 0 ? (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            void handleMarkConversationRead(c).finally(closeSheet);
                                        }}
                                    >
                                        <FiCheck className={rowIcon} />
                                        Mark read
                                    </button>
                                ) : !isGroupRow ? (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            void handleMarkConversationUnread(c).finally(closeSheet);
                                        }}
                                    >
                                        <FiBellOff className={rowIcon} />
                                        Mark unread
                                    </button>
                                ) : null}
                                {!isGroupRow && user?.handle ? (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            if (c.isPinned) {
                                                void unpinConversation(user.handle, c.otherHandle)
                                                    .then(() => loadData())
                                                    .finally(closeSheet);
                                            } else {
                                                void pinConversation(user.handle, c.otherHandle)
                                                    .then(() => loadData())
                                                    .finally(closeSheet);
                                            }
                                        }}
                                    >
                                        <FiBookmark className={rowIcon} />
                                        {c.isPinned ? 'Unpin' : 'Pin'}
                                    </button>
                                ) : null}
                                {!isGroupRow ? (
                                    <button
                                        type="button"
                                        className={rowBtn}
                                        onClick={() => {
                                            void handleToggleMuteConversation(c).finally(closeSheet);
                                        }}
                                    >
                                        <FiBellOff className={rowIcon} />
                                        {c.isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className={`${rowBtn} border-b-0`}
                                    onClick={() => {
                                        closeSheet();
                                        void handleDeleteConversation(c);
                                    }}
                                >
                                    <FiTrash2 className={rowIcon} />
                                    {isGroupRow ? 'Leave group' : 'Delete conversation'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {storyThumbMenu && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4"
                    onClick={() => setStoryThumbMenu(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-white/20 bg-black text-white overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="w-full px-4 py-3.5 text-left text-sm font-semibold hover:bg-white/10 transition-colors"
                            onClick={() => {
                                const selected = storyThumbMenu;
                                setStoryThumbMenu(null);
                                openStoryFromNotification(selected.fromHandle, selected.storyId);
                            }}
                        >
                            View story
                        </button>
                        <button
                            type="button"
                            className="w-full px-4 py-3.5 text-left text-sm text-white/80 border-t border-white/10 hover:bg-white/10 transition-colors"
                            onClick={() => setStoryThumbMenu(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {inboxPost && (
                <ScenesModal
                    post={inboxPost}
                    isOpen={!!inboxPost}
                    onClose={() => {
                        setInboxPost(null);
                        setInboxPostComments(false);
                    }}
                    onLike={async () => {
                        if (!user?.id || !inboxPost) return;
                        const updated = await toggleLike(user.id, inboxPost.id, inboxPost);
                        setInboxPost((prev) => (prev ? { ...prev, ...updated } : prev));
                    }}
                    onFollow={async () => {
                        if (!user?.id || !inboxPost) return;
                        const updated = await toggleFollowForPost(user.id, inboxPost.id);
                        setInboxPost((prev) => (prev ? { ...prev, ...updated } : prev));
                    }}
                    onShare={async () => {
                        if (inboxPost) setInboxSharePost(inboxPost);
                    }}
                    onOpenComments={() => setInboxPostComments(true)}
                    onReclip={async () => {
                        if (!user?.id || !user?.handle || !inboxPost) return;
                        const { originalPost } = await reclipPost(user.id, inboxPost.id, user.handle);
                        setInboxPost((prev) => (prev ? { ...prev, ...originalPost } : prev));
                    }}
                />
            )}
            {inboxPost && (
                <CommentsModal
                    postId={inboxPost.id}
                    isOpen={inboxPostComments}
                    onClose={() => setInboxPostComments(false)}
                />
            )}
            {inboxSharePost && (
                <ShareModal
                    post={inboxSharePost}
                    isOpen={!!inboxSharePost}
                    onClose={() => setInboxSharePost(null)}
                />
            )}

            {insightLikersModal && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4"
                    onClick={() => setInsightLikersModal(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-white/20 bg-black text-white overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">Story likes</div>
                        <div className="max-h-[50vh] overflow-y-auto">
                            {insightLikersModal.likers.map((handle) => (
                                <button
                                    key={`${insightLikersModal.storyId}-${handle}`}
                                    type="button"
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                                    onClick={() => {
                                        setInsightLikersModal(null);
                                        navigate(`/user/${encodeURIComponent(handle)}`);
                                    }}
                                >
                                    {handle}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="w-full px-4 py-3 text-left text-sm text-white/80 border-t border-white/10 hover:bg-white/10 transition-colors"
                            onClick={() => setInsightLikersModal(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}


