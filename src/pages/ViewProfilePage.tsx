import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiBell, FiShare2, FiMessageSquare, FiMoreHorizontal, FiX, FiLock, FiMapPin, FiEye, FiUserPlus, FiMaximize, FiPlay, FiSearch, FiUsers, FiHeart, FiRepeat, FiVolume2, FiVolumeX, FiAlertCircle } from 'react-icons/fi';
import Avatar from '../components/Avatar';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { MOCK_FOLLOWING_GRAPH } from '../api/mockFollowGraph';
import Flag from '../components/Flag';
import { useAuth } from '../context/Auth';
import { fetchPostsPage, toggleFollowForPost, getFollowedUsers, getFollowState, setFollowState, setReclipState, posts as allPosts, toggleLike, reclipPost, incrementViews, deletePost, transformLaravelPost } from '../api/posts';
import { enqueue } from '../utils/mutationQueue';
import { useOnline } from '../hooks/useOnline';
import { FeedCard } from '../App';
import CommentsModal from '../components/CommentsModal';
import ShareModal from '../components/ShareModal';
import ScenesModal from '../components/ScenesModal';
import { getEffectiveTextStyleForPost, getTextOnlyFallbackBackground, getTextOnlyPreviewTextClass } from '../utils/effectiveTextPostStyle';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';
import { fetchFollowers, fetchFollowing, fetchUserProfile, toggleFollow } from '../api/client';
import type { Post } from '../types';
import { 
  isProfilePrivate, 
  canViewProfile, 
  canSendMessage, 
  hasPendingFollowRequest,
  createFollowRequest,
  removeFollowRequest
} from '../api/privacy';
import Swal from 'sweetalert2';
import ShareProfileModal from '../components/ShareProfileModal';
import InviteToGroupModal from '../components/InviteToGroupModal';
import { getStableUserId } from '../utils/userId';
import { followRequestSentBottomSheet, accountIsPrivateBottomSheet, bottomSheet } from '../utils/swalBottomSheet';
import { parsePlacesFromBio } from '../utils/suggestedPlaces';

const DEBUG_PROFILE_GRID_PAGING =
    import.meta.env.DEV && import.meta.env.VITE_DEBUG_PROFILE_GRID_PAGING === 'true';

/** Resolve places for the location icon. Uses Travel Info lists first, then parses BOTH profile and auth bios so "places in my bio" always counts. */
function getEffectivePlacesTraveled(profileUser: any, authUser: any): string[] {
    const fromProfileList = Array.isArray(profileUser?.placesTraveled) && profileUser.placesTraveled.length > 0
        ? profileUser.placesTraveled
        : [];
    if (fromProfileList.length > 0) return fromProfileList;

    const fromAuthList = Array.isArray(authUser?.placesTraveled) && authUser.placesTraveled.length > 0
        ? authUser.placesTraveled
        : [];
    if (fromAuthList.length > 0) return fromAuthList;

    // Always parse BOTH bios so we never miss "places in my bio" (Auth user or profile)
    const profileBio = typeof profileUser?.bio === 'string' ? profileUser.bio : '';
    const authBio = typeof authUser?.bio === 'string' ? authUser.bio : '';
    const fromProfileBio = parsePlacesFromBio(profileBio);
    const fromAuthBio = parsePlacesFromBio(authBio);
    const merged = [...fromProfileBio, ...fromAuthBio];
    const deduped = [...new Set(merged)];
    return deduped;
}

/** Get effective places with localStorage fallback so we never miss bio or Travel Info saved in Profile. */
function getEffectivePlacesWithStorageFallback(profileUser: any, authUser: any): string[] {
    let places = getEffectivePlacesTraveled(profileUser, authUser);
    if (places.length > 0) return places;
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return [];
        const u = JSON.parse(raw);
        const storedList = Array.isArray(u?.placesTraveled) && u.placesTraveled.length > 0 ? u.placesTraveled : [];
        if (storedList.length > 0) return storedList;
        const bio = typeof u?.bio === 'string' ? (u.bio as string).trim() : '';
        if (bio) {
            const fromBio = parsePlacesFromBio(bio);
            if (fromBio.length > 0) return fromBio;
            const commaSplit = bio.split(',').map((s: string) => s.trim()).filter(Boolean);
            if (commaSplit.length > 0) return commaSplit;
        }
    } catch (_) {}
    return [];
}

function normalizeHandleKeyForMockGraph(value: string): string {
    return value.replace(/^@/, '').trim().toLowerCase();
}

/** Same logic as mock connection lists — used so header stats match the modal after refresh (loadProfile overwrites earlier effects). */
function computeMockGraphFollowCounts(
    decodedHandle: string,
    viewerHandle: string | undefined,
    viewerFollows: string[],
): { followers: number; following: number } {
    const normalizedTarget = normalizeHandleKeyForMockGraph(decodedHandle);
    const viewerFollowedSet = new Set(viewerFollows.map((h) => normalizeHandleKeyForMockGraph(h)));
    const followersSet = new Set<string>();
    Object.entries(MOCK_FOLLOWING_GRAPH).forEach(([followerHandle, followingList]) => {
        const followsTarget = (followingList || []).some((entry) => normalizeHandleKeyForMockGraph(entry) === normalizedTarget);
        if (followsTarget) followersSet.add(normalizeHandleKeyForMockGraph(followerHandle));
    });
    if (viewerHandle && viewerFollowedSet.has(normalizedTarget)) {
        followersSet.add(normalizeHandleKeyForMockGraph(viewerHandle));
    }
    const followingSet = new Set<string>(
        (MOCK_FOLLOWING_GRAPH[normalizedTarget] || []).map((entry) => normalizeHandleKeyForMockGraph(entry)),
    );
    if (viewerHandle && normalizeHandleKeyForMockGraph(viewerHandle) === normalizedTarget) {
        viewerFollows.forEach((entry) => followingSet.add(normalizeHandleKeyForMockGraph(String(entry))));
    }
    return { followers: followersSet.size, following: followingSet.size };
}

const PROFILE_GRID_PEEK_LONG_PRESS_MS = 450;

type ProfilePostFeedSlideProps = {
    post: Post;
    onLike: (post: Post) => Promise<void>;
    onFollow: () => Promise<void>;
    onShare: (post: Post) => void;
    onOpenComments: (post: Post) => void;
    onView: (post: Post) => Promise<void>;
    onReclip: (post: Post) => Promise<void>;
    onOpenScenes: (post: Post) => void;
    onShareSuccess: (postId: string) => void;
    onDelete?: (post: Post) => Promise<void>;
    onOpenDM?: (handle: string) => void;
    onBoost?: () => Promise<void>;
    showBoostIcon: boolean;
    priority?: boolean;
};

const ProfilePostFeedSlide = React.memo(
    React.forwardRef<HTMLDivElement, ProfilePostFeedSlideProps>(function ProfilePostFeedSlide(
        {
            post,
            onLike,
            onFollow,
            onShare,
            onOpenComments,
            onView,
            onReclip,
            onOpenScenes,
            onShareSuccess,
            onDelete,
            onOpenDM,
            onBoost,
            showBoostIcon,
            priority = false,
        },
        ref,
    ) {
        return (
            <div
                ref={ref}
                className="w-full shrink-0 [&_article]:animate-none"
            >
                <FeedCard
                    post={post}
                    priority={priority}
                    onLike={() => onLike(post)}
                    onFollow={onFollow}
                    onShare={async () => {
                        onShare(post);
                    }}
                    onOpenComments={() => onOpenComments(post)}
                    onView={() => onView(post)}
                    onReclip={() => onReclip(post)}
                    onOpenScenes={() => onOpenScenes(post)}
                    showBoostIcon={showBoostIcon}
                    onBoost={onBoost}
                    onDelete={onDelete ? () => onDelete(post) : undefined}
                    onOpenDM={onOpenDM}
                    onShareSuccess={onShareSuccess}
                    engagementVariant="default"
                />
            </div>
        );
    }),
);

/** Short vibration when the grid peek opens (Android / supported browsers; iOS WebView may vary). */
function hapticProfilePeekOpen() {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(14);
        }
    } catch {
        /* ignore */
    }
}

/** Light pattern when peek is dismissed by dragging down. */
function hapticProfilePeekDismiss() {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([10, 28, 12]);
        }
    } catch {
        /* ignore */
    }
}

export default function ViewProfilePage() {
    const navigate = useNavigate();
    const { handle } = useParams<{ handle: string }>();
    const { user } = useAuth();
    const [profileUser, setProfileUser] = React.useState<any>(null);
    const [posts, setPosts] = React.useState<Post[]>([]);
    const [profilePostsCursor, setProfilePostsCursor] = React.useState<string | null>(null);
    const [profilePostsHasMore, setProfilePostsHasMore] = React.useState(false);
    const [profilePostsLoadingMore, setProfilePostsLoadingMore] = React.useState(false);
    const profilePostsLoadMoreRef = React.useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [stats, setStats] = React.useState({ following: 0, followers: 0, likes: 0, views: 0 });
    const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
    const [gridPeekPost, setGridPeekPost] = React.useState<Post | null>(null);
    const [peekVideoMuted, setPeekVideoMuted] = React.useState(true);
    const [peekPullY, setPeekPullY] = React.useState(0);
    const [peekPullTransition, setPeekPullTransition] = React.useState('');
    const peekPullYRef = React.useRef(0);
    const peekPullStartYRef = React.useRef(0);
    const peekPullPointerIdRef = React.useRef<number | null>(null);
    const peekPullDraggingRef = React.useRef(false);
    const profilePostScrollRef = React.useRef<HTMLDivElement>(null);
    const profilePostSlideRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const gridLongPressTimerRef = React.useRef<number | null>(null);
    const suppressGridOpenClickRef = React.useRef(false);
    const [hasStory, setHasStory] = React.useState(false);
    const [canViewProfileState, setCanViewProfileState] = React.useState(true);
    const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
    const [profileIsPrivate, setProfileIsPrivate] = React.useState(false);
    const [showTraveledModal, setShowTraveledModal] = React.useState(false);
    const [placesForTravelModal, setPlacesForTravelModal] = React.useState<string[]>([]);
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);
    const [inviteToGroupOpen, setInviteToGroupOpen] = React.useState(false);
    const [profileCommentsOpen, setProfileCommentsOpen] = React.useState(false);
    const [profileCommentsPostId, setProfileCommentsPostId] = React.useState<string | null>(null);
    const [profileShareOpen, setProfileShareOpen] = React.useState(false);
    const [profileSharePost, setProfileSharePost] = React.useState<Post | null>(null);
    const [profileScenesOpen, setProfileScenesOpen] = React.useState(false);
    const [profileScenesPost, setProfileScenesPost] = React.useState<Post | null>(null);
    const [profileScenesInitialTime, setProfileScenesInitialTime] = React.useState<number | null>(null);
    const [profileScenesInitialMuted, setProfileScenesInitialMuted] = React.useState<boolean | null>(null);
    const profileViewerVideoTimesRef = React.useRef<Map<string, number>>(new Map());
    const online = useOnline();
    const [showQRCodeModal, setShowQRCodeModal] = React.useState(false);
    const [showShareProfileModal, setShowShareProfileModal] = React.useState(false);
    const [contentTab, setContentTab] = React.useState<'all' | 'videos' | 'photos' | 'text'>('all');
    const [showConnectionsModal, setShowConnectionsModal] = React.useState(false);
    const [connectionsScope, setConnectionsScope] = React.useState<'mutual' | 'followers' | 'following' | 'suggested'>('followers');
    const [followersList, setFollowersList] = React.useState<any[]>([]);
    const [followingList, setFollowingList] = React.useState<any[]>([]);
    const [connectionsSearch, setConnectionsSearch] = React.useState('');
    const [connectionsLoading, setConnectionsLoading] = React.useState(false);
    const [connectionsLoadingMore, setConnectionsLoadingMore] = React.useState(false);
    const [connectionsError, setConnectionsError] = React.useState<string | null>(null);
    const [connectionFollowMap, setConnectionFollowMap] = React.useState<Record<string, boolean>>({});
    const [connectionRequestMap, setConnectionRequestMap] = React.useState<Record<string, boolean>>({});
    const [connectionActionLoadingMap, setConnectionActionLoadingMap] = React.useState<Record<string, boolean>>({});
    const [connectionActionSuccessMap, setConnectionActionSuccessMap] = React.useState<Record<string, boolean>>({});
    const [followersCursor, setFollowersCursor] = React.useState<string | number | null>(0);
    const [followingCursor, setFollowingCursor] = React.useState<string | number | null>(0);
    const [followersHasMore, setFollowersHasMore] = React.useState(true);
    const [followingHasMore, setFollowingHasMore] = React.useState(true);
    const [viewerFollowedSet, setViewerFollowedSet] = React.useState<Set<string>>(new Set());
    const [compactConnectionsPhone, setCompactConnectionsPhone] = React.useState(false);
    const [debouncedConnectionsSearch, setDebouncedConnectionsSearch] = React.useState('');
    const [dismissedSuggestedMap, setDismissedSuggestedMap] = React.useState<Record<string, boolean>>({});
    const [dismissUndo, setDismissUndo] = React.useState<{ handleNoAt: string; expiresAt: number } | null>(null);
    /** Suggested tab: optional horizontal cards; default is vertical list (same as other connection tabs). */
    const [suggestedConnectionsLayout, setSuggestedConnectionsLayout] = React.useState<'carousel' | 'list'>('list');

    const loadMoreProfilePosts = React.useCallback(async () => {
        if (!handle || !profilePostsHasMore || !profilePostsCursor || profilePostsLoadingMore) return;
        const decodedHandle = decodeURIComponent(handle);
        setProfilePostsLoadingMore(true);
        try {
            const userProfileData = await fetchUserProfile(decodedHandle, user?.id, profilePostsCursor, 20);
            const rawItems = Array.isArray((userProfileData as any)?.posts) ? (userProfileData as any).posts : [];
            const nextItems: Post[] = rawItems.map((p: any) => transformLaravelPost(p));
            if (DEBUG_PROFILE_GRID_PAGING) {
                console.info('[ProfileGrid][older-page]', {
                    handle: decodedHandle,
                    count: nextItems.length,
                    requestCursor: profilePostsCursor,
                    nextCursor: (userProfileData as any)?.postsNextCursor ?? null,
                    hasMore: !!(userProfileData as any)?.postsHasMore,
                });
            }
            if (nextItems.length > 0) {
                setPosts((prev) => {
                    const seen = new Set(prev.map((p) => String(p.id)));
                    const appended = nextItems.filter((p) => !seen.has(String(p.id)));
                    return [...prev, ...appended];
                });
            }
            setProfilePostsCursor((userProfileData as any)?.postsNextCursor ?? null);
            setProfilePostsHasMore(!!(userProfileData as any)?.postsHasMore);
        } catch (error) {
            console.error('Error loading more profile posts:', error);
        } finally {
            setProfilePostsLoadingMore(false);
        }
    }, [handle, profilePostsHasMore, profilePostsCursor, profilePostsLoadingMore, user?.id]);

    React.useEffect(() => {
        const sentinel = profilePostsLoadMoreRef.current;
        if (!sentinel) return;
        if (!profilePostsHasMore || profilePostsLoadingMore || contentTab !== 'all') return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (!entry?.isIntersecting) return;
                if (profilePostsLoadingMore || !profilePostsHasMore || !profilePostsCursor) return;
                void loadMoreProfilePosts();
            },
            {
                root: null,
                rootMargin: '250px 0px 300px 0px',
                threshold: 0.01,
            },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [
        contentTab,
        loadMoreProfilePosts,
        profilePostsCursor,
        profilePostsHasMore,
        profilePostsLoadingMore,
    ]);

    const flashConnectionActionSuccess = React.useCallback((key: string) => {
        setConnectionActionSuccessMap((prev) => ({ ...prev, [key]: true }));
        window.setTimeout(() => {
            setConnectionActionSuccessMap((prev) => ({ ...prev, [key]: false }));
        }, 320);
    }, []);

    const isOwnProfile = React.useMemo(() => {
        if (!handle || !user?.handle) return false;
        return decodeURIComponent(handle) === user.handle;
    }, [handle, user?.handle]);

    const filteredPosts = React.useMemo(() => {
        if (contentTab === 'videos') return posts.filter((p) => p.mediaType === 'video');
        if (contentTab === 'photos') return posts.filter((p) => !!p.mediaUrl && p.mediaType !== 'video');
        if (contentTab === 'text') return posts.filter((p) => !p.mediaUrl);
        return posts;
    }, [posts, contentTab]);

    const profileScenesFeedPosts = React.useMemo(
        () => filteredPosts.filter((p) => !!(p.mediaUrl || (p.mediaItems && p.mediaItems.length > 0))),
        [filteredPosts],
    );

    const mergeProfilePost = React.useCallback((postId: string, updater: (p: Post) => Post) => {
        setPosts((prev) => prev.map((p) => (String(p.id) === String(postId) ? updater(p) : p)));
    }, []);

    React.useEffect(() => {
        if (!profileUser?.handle || posts.length === 0) return;
        const h = String(profileUser.handle).replace(/^@/, '').trim().toLowerCase();
        setPosts((prev) =>
            prev.map((p) => {
                const ph = String(p.userHandle || '').replace(/^@/, '').trim().toLowerCase();
                return ph === h ? { ...p, isFollowing } : p;
            }),
        );
    }, [isFollowing, profileUser?.handle, posts.length]);

    const handleProfileFeedLike = React.useCallback(
        async (p: Post) => {
            if (!user) {
                Swal.fire(bottomSheet({ title: 'Sign in to like posts', icon: 'info' }));
                return;
            }
            const userId = getStableUserId(user);
            if (!online) {
                mergeProfilePost(p.id, (post) => {
                    const nextLiked = !post.userLiked;
                    return {
                        ...post,
                        userLiked: nextLiked,
                        stats: {
                            ...post.stats,
                            likes: Math.max(0, post.stats.likes + (nextLiked ? 1 : -1)),
                        },
                    };
                });
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
            }
            const nextLiked = !p.userLiked;
            const nextLikes = Math.max(0, p.stats.likes + (nextLiked ? 1 : -1));
            mergeProfilePost(p.id, (post) => ({
                ...post,
                userLiked: nextLiked,
                stats: { ...post.stats, likes: nextLikes },
            }));
            window.dispatchEvent(
                new CustomEvent(`likeToggled-${p.id}`, { detail: { liked: nextLiked, likes: nextLikes } }),
            );
            try {
                const updated = await toggleLike(userId, p.id, p);
                mergeProfilePost(p.id, () => ({ ...updated }));
                window.dispatchEvent(
                    new CustomEvent(`likeToggled-${p.id}`, {
                        detail: { liked: updated.userLiked, likes: updated.stats.likes },
                    }),
                );
            } catch (err) {
                console.warn('Profile viewer like failed, reverting:', err);
                mergeProfilePost(p.id, (post) => ({
                    ...post,
                    userLiked: p.userLiked,
                    stats: { ...post.stats, likes: p.stats.likes },
                }));
            }
        },
        [user, online, mergeProfilePost],
    );

    const handleProfileFeedView = React.useCallback(
        async (p: Post) => {
            if (!p?.id || !user) return;
            if (p.id.startsWith('mock-scenes-')) return;
            const userId = getStableUserId(user);
            if (!online) {
                await enqueue({ type: 'view', postId: p.id, userId });
                return;
            }
            try {
                const updated = await incrementViews(userId, p.id);
                if (updated.userHandle === 'Unknown') return;
                mergeProfilePost(p.id, (post) => ({
                    ...post,
                    stats:
                        updated.stats && typeof updated.stats.views === 'number'
                            ? { ...post.stats, views: updated.stats.views }
                            : post.stats,
                }));
                window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
            } catch (err) {
                console.warn('incrementViews error:', err);
            }
        },
        [user, online, mergeProfilePost],
    );

    const handleProfileFeedReclip = React.useCallback(
        async (p: Post) => {
            if (!user?.handle) {
                Swal.fire(bottomSheet({ title: 'Sign in to repost', icon: 'info' }));
                return;
            }
            if (p.userHandle === user.handle || p.userReclipped) return;
            const userId = getStableUserId(user);
            const newReclipsCount = p.stats.reclips + 1;
            const optimisticPost = {
                ...p,
                userReclipped: true,
                stats: { ...p.stats, reclips: newReclipsCount },
            };
            setReclipState(userId, p.id, true);
            mergeProfilePost(p.id, () => optimisticPost);
            window.dispatchEvent(
                new CustomEvent(`reclipAdded-${p.id}`, { detail: { reclips: newReclipsCount } }),
            );
            if (!online) {
                await enqueue({ type: 'reclip', postId: p.id, userId, userHandle: user.handle });
                return;
            }
            try {
                const { originalPost: updatedOriginalPost } = await reclipPost(userId, p.id, user.handle);
                mergeProfilePost(p.id, () => ({
                    ...p,
                    userReclipped: updatedOriginalPost.userReclipped,
                    stats: updatedOriginalPost.stats,
                }));
                if (updatedOriginalPost.stats.reclips !== newReclipsCount) {
                    window.dispatchEvent(
                        new CustomEvent(`reclipAdded-${p.id}`, {
                            detail: { reclips: updatedOriginalPost.stats.reclips },
                        }),
                    );
                }
            } catch (err) {
                console.warn('Reclip failed:', err);
            }
        },
        [user, online, mergeProfilePost],
    );

    const openProfileShare = React.useCallback((p: Post) => {
        setProfileSharePost(p);
        setProfileShareOpen(true);
    }, []);

    const openProfileComments = React.useCallback((p: Post) => {
        setProfileCommentsPostId(p.id);
        setProfileCommentsOpen(true);
    }, []);

    const openProfileScenes = React.useCallback((p: Post) => {
        const t = profileViewerVideoTimesRef.current.get(p.id);
        setProfileScenesInitialTime(t !== undefined ? t : null);
        setProfileScenesInitialMuted(null);
        setProfileScenesPost(p);
        setProfileScenesOpen(true);
        window.dispatchEvent(new CustomEvent(`scenesOpening-${p.id}`));
    }, []);

    const handleCloseProfileComments = React.useCallback(() => {
        setProfileCommentsOpen(false);
        setProfileCommentsPostId(null);
    }, []);

    React.useLayoutEffect(() => {
        if (!selectedPost) return;
        const id = String(selectedPost.id);
        requestAnimationFrame(() => {
            const el = profilePostSlideRefs.current[id];
            el?.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
    }, [selectedPost?.id]);

    React.useEffect(() => {
        if (!selectedPost) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [selectedPost]);

    React.useEffect(() => {
        if (!selectedPost) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedPost(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedPost]);

    React.useEffect(() => {
        if (!selectedPost) return;
        if (!filteredPosts.some((p) => p.id === selectedPost.id)) {
            setSelectedPost(null);
        }
    }, [filteredPosts, selectedPost]);

    React.useEffect(() => {
        setPeekVideoMuted(true);
    }, [gridPeekPost?.id]);

    React.useEffect(() => {
        if (!gridPeekPost?.id) return;
        const fresh = posts.find((x) => String(x.id) === String(gridPeekPost.id));
        if (fresh) setGridPeekPost(fresh);
    }, [posts, gridPeekPost?.id]);

    const clearGridLongPressTimer = React.useCallback(() => {
        if (gridLongPressTimerRef.current) {
            clearTimeout(gridLongPressTimerRef.current);
            gridLongPressTimerRef.current = null;
        }
    }, []);

    const handleGridPointerDown = React.useCallback(
        (e: React.PointerEvent, _post: Post) => {
            clearGridLongPressTimer();
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            const t = window.setTimeout(() => {
                gridLongPressTimerRef.current = null;
                suppressGridOpenClickRef.current = true;
                hapticProfilePeekOpen();
                setGridPeekPost(_post);
            }, PROFILE_GRID_PEEK_LONG_PRESS_MS);
            gridLongPressTimerRef.current = t;
        },
        [clearGridLongPressTimer],
    );

    const handleGridPointerUp = React.useCallback(() => {
        clearGridLongPressTimer();
    }, [clearGridLongPressTimer]);

    const handleGridCellClick = React.useCallback((post: Post) => {
        if (suppressGridOpenClickRef.current) {
            suppressGridOpenClickRef.current = false;
            return;
        }
        setGridPeekPost(null);
        setSelectedPost(post);
    }, []);

    const closeGridPeek = React.useCallback(() => {
        setGridPeekPost(null);
        setPeekPullY(0);
        peekPullYRef.current = 0;
        peekPullDraggingRef.current = false;
        peekPullPointerIdRef.current = null;
        setPeekPullTransition('');
    }, []);

    const handlePeekPreviewPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if ((e.target as HTMLElement).closest('[data-no-peek-drag]')) return;
        peekPullPointerIdRef.current = e.pointerId;
        peekPullStartYRef.current = e.clientY;
        peekPullDraggingRef.current = true;
        setPeekPullTransition('');
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    }, []);

    const handlePeekPreviewPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (peekPullPointerIdRef.current !== e.pointerId || !peekPullDraggingRef.current) return;
        const dy = e.clientY - peekPullStartYRef.current;
        if (dy <= 0) {
            peekPullYRef.current = 0;
            setPeekPullY(0);
            return;
        }
        const rubber = Math.min(dy * 0.58 + Math.sqrt(dy) * 1.85, 240);
        peekPullYRef.current = rubber;
        setPeekPullY(rubber);
    }, []);

    const handlePeekPreviewPointerEnd = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (peekPullPointerIdRef.current !== e.pointerId) return;
            peekPullDraggingRef.current = false;
            peekPullPointerIdRef.current = null;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            const y = peekPullYRef.current;
            setPeekPullTransition('transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)');
            if (y > 88) {
                hapticProfilePeekDismiss();
                closeGridPeek();
                return;
            }
            peekPullYRef.current = 0;
            setPeekPullY(0);
        },
        [closeGridPeek],
    );

    React.useEffect(() => {
        if (!gridPeekPost) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setGridPeekPost(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gridPeekPost]);

    const handlePeekLike = React.useCallback(async () => {
        if (!gridPeekPost) return;
        await handleProfileFeedLike(gridPeekPost);
    }, [gridPeekPost, handleProfileFeedLike]);

    const handlePeekComment = React.useCallback(() => {
        if (!gridPeekPost) return;
        const p = gridPeekPost;
        openProfileComments(p);
        closeGridPeek();
    }, [gridPeekPost, openProfileComments, closeGridPeek]);

    const handlePeekReclip = React.useCallback(async () => {
        if (!gridPeekPost) return;
        if (!user?.handle) {
            Swal.fire(bottomSheet({ title: 'Sign in to repost', icon: 'info' }));
            return;
        }
        const p = gridPeekPost;
        try {
            await handleProfileFeedReclip(p);
            Swal.fire(bottomSheet({ title: 'Reposted', message: 'Added to your profile.', icon: 'success' }));
            closeGridPeek();
        } catch (e) {
            console.error(e);
            Swal.fire(bottomSheet({ title: 'Could not repost', icon: 'alert' }));
        }
    }, [gridPeekPost, user?.handle, handleProfileFeedReclip, closeGridPeek]);

    const handlePeekShare = React.useCallback(() => {
        if (!gridPeekPost) return;
        const p = gridPeekPost;
        openProfileShare(p);
        closeGridPeek();
    }, [gridPeekPost, openProfileShare, closeGridPeek]);

    const handlePeekReport = React.useCallback(() => {
        if (!gridPeekPost) return;
        void Swal.fire(
            bottomSheet({
                title: 'Report this post?',
                message: 'Our team will review it.',
                showCancelButton: true,
                confirmButtonText: 'Report',
                cancelButtonText: 'Cancel',
            }),
        ).then((r) => {
            if (r.isConfirmed) {
                Swal.fire(bottomSheet({ title: "Thanks — we'll review it.", icon: 'success' }));
                closeGridPeek();
            }
        });
    }, [gridPeekPost, closeGridPeek]);

    const normalizeHandleKey = React.useCallback((value: string) => value.replace(/^@/, '').trim().toLowerCase(), []);
    const getHandleCluster = React.useCallback((value: string) => {
        const normalized = normalizeHandleKey(value);
        const afterAt = normalized.split('@')[1] || '';
        return afterAt || normalized;
    }, [normalizeHandleKey]);
    const suggestedDismissStorageKey = React.useMemo(() => {
        const viewerKey = user?.id != null ? String(user.id) : (user?.handle || 'anon');
        return `clips_suggested_dismissed_${viewerKey}`;
    }, [user?.id, user?.handle]);

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(suggestedDismissStorageKey);
            setDismissedSuggestedMap(raw ? JSON.parse(raw) : {});
        } catch (_) {
            setDismissedSuggestedMap({});
        }
    }, [suggestedDismissStorageKey]);

    React.useEffect(() => {
        try {
            localStorage.setItem(suggestedDismissStorageKey, JSON.stringify(dismissedSuggestedMap));
        } catch (_) {}
    }, [dismissedSuggestedMap, suggestedDismissStorageKey]);

    const mapConnectionItem = React.useCallback((item: any, followedSet: Set<string>) => {
        const rawHandle = String(item?.handle || item?.username || '');
        const handleNoAt = rawHandle.replace(/^@/, '');
        const normalized = normalizeHandleKey(rawHandle);
        const isRequested = !!(user?.handle && hasPendingFollowRequest(user.handle, handleNoAt));
        return {
            id: String(item?.id || rawHandle),
            handle: handleNoAt ? `@${handleNoAt}` : '@unknown',
            handleNoAt,
            name: item?.display_name || item?.name || rawHandle || 'Unknown',
            bio: typeof item?.bio === 'string' ? item.bio : '',
            avatarUrl: item?.avatar_url || item?.avatarUrl || '',
            isPrivate: !!item?.is_private || isProfilePrivate(handleNoAt),
            isFollowing: followedSet.has(normalized),
            isRequested,
        };
    }, [normalizeHandleKey, user?.handle]);

    const buildMockConnectionsForTab = React.useCallback(async (tab: 'followers' | 'following', targetHandle: string, followedSet: Set<string>) => {
        const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
        const viewerFollows = await getFollowedUsers(viewerId);
        const viewerFollowsSet = new Set((Array.isArray(viewerFollows) ? viewerFollows : []).map((entry) => normalizeHandleKey(String(entry))));
        const normalizedTarget = normalizeHandleKey(targetHandle);
        const out: any[] = [];
        const pushRow = (rawHandle: string, rawName?: string, avatarUrl?: string) => {
            const handleNoAt = String(rawHandle || '').replace(/^@/, '');
            if (!handleNoAt) return;
            const normalized = normalizeHandleKey(handleNoAt);
            if (out.some((row) => normalizeHandleKey(row.handleNoAt) === normalized)) return;
            out.push({
                id: `mock-${tab}-${normalized}`,
                handle: `@${handleNoAt}`,
                handleNoAt,
                name: rawName || handleNoAt,
                bio: '',
                avatarUrl: avatarUrl || '',
                isPrivate: isProfilePrivate(handleNoAt),
                isFollowing: followedSet.has(normalized),
                isRequested: !!(user?.handle && hasPendingFollowRequest(user.handle, handleNoAt)),
            });
        };

        if (tab === 'followers') {
            // Populate followers by reversing the mock following graph.
            Object.entries(MOCK_FOLLOWING_GRAPH).forEach(([followerHandle, followingList]) => {
                const followsTarget = (followingList || []).some((entry) => normalizeHandleKey(entry) === normalizedTarget);
                if (!followsTarget) return;
                const profilePost = allPosts.find((p) => normalizeHandleKey(p.userHandle || '') === normalizeHandleKey(followerHandle));
                pushRow(
                    followerHandle,
                    profilePost?.userHandle || followerHandle,
                    getAvatarForHandle(followerHandle) || '',
                );
            });
            // Minimal reliable fallback: if viewer follows target, viewer appears in target's followers.
            if (user?.handle && viewerFollowsSet.has(normalizedTarget)) {
                pushRow(user.handle, user.name || user.handle, user.avatarUrl || '');
            }
        } else {
            const mockFollowing = MOCK_FOLLOWING_GRAPH[normalizedTarget] || [];
            mockFollowing.forEach((h) => {
                const handleNoAt = String(h || '').replace(/^@/, '');
                const profilePost = allPosts.find((p) => normalizeHandleKey(p.userHandle || '') === normalizeHandleKey(handleNoAt));
                pushRow(handleNoAt, profilePost?.userHandle || handleNoAt, getAvatarForHandle(handleNoAt) || '');
            });
            // For own profile in mock mode, show who the viewer follows.
            if (user?.handle && normalizeHandleKey(user.handle) === normalizedTarget) {
                viewerFollows.forEach((h) => {
                    const handleNoAt = String(h || '').replace(/^@/, '');
                    const profilePost = allPosts.find((p) => normalizeHandleKey(p.userHandle || '') === normalizeHandleKey(handleNoAt));
                    pushRow(handleNoAt, handleNoAt, getAvatarForHandle(handleNoAt) || '');
                    if (profilePost) {
                        // Improve display name if we have a post author handle variant
                        const existing = out.find((row) => normalizeHandleKey(row.handleNoAt) === normalizeHandleKey(handleNoAt));
                        if (existing) existing.name = profilePost.userHandle || existing.name;
                    }
                });
            }
        }
        return out;
    }, [normalizeHandleKey, user]);

    const loadConnections = React.useCallback(async (tab: 'followers' | 'following', opts?: { reset?: boolean }) => {
        if (!handle) return;
        const reset = !!opts?.reset;
        const decodedHandle = decodeURIComponent(handle);
        if (reset) {
            setConnectionsLoading(true);
            setConnectionsError(null);
        } else {
            setConnectionsLoadingMore(true);
        }
        try {
            const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
            const followedUsers = await getFollowedUsers(viewerId);
            const followedSet = new Set((Array.isArray(followedUsers) ? followedUsers : []).map((entry) => normalizeHandleKey(String(entry))));
            setViewerFollowedSet(followedSet);
            const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
            if (!useLaravelApi) {
                const normalized = await buildMockConnectionsForTab(tab, decodedHandle, followedSet);
                const followMapPatch: Record<string, boolean> = {};
                const requestMapPatch: Record<string, boolean> = {};
                normalized.forEach((row: any) => {
                    followMapPatch[row.handleNoAt] = row.isFollowing;
                    requestMapPatch[row.handleNoAt] = row.isRequested;
                });
                setConnectionFollowMap((prev) => ({ ...prev, ...followMapPatch }));
                setConnectionRequestMap((prev) => ({ ...prev, ...requestMapPatch }));
                if (tab === 'followers') {
                    setFollowersList(normalized);
                    setFollowersHasMore(false);
                    setFollowersCursor(0);
                    setStats((prev) => ({ ...prev, followers: normalized.length }));
                } else {
                    setFollowingList(normalized);
                    setFollowingHasMore(false);
                    setFollowingCursor(0);
                    setStats((prev) => ({ ...prev, following: normalized.length }));
                }
                return;
            }
            const cursor = tab === 'followers'
                ? (reset ? 0 : followersCursor)
                : (reset ? 0 : followingCursor);
            const response = tab === 'followers'
                ? await fetchFollowers(decodedHandle, cursor, 40)
                : await fetchFollowing(decodedHandle, cursor, 40);
            const items = Array.isArray(response?.items) ? response.items : [];
            const normalized = items.map((item: any) => mapConnectionItem(item, followedSet));
            const followMapPatch: Record<string, boolean> = {};
            const requestMapPatch: Record<string, boolean> = {};
            normalized.forEach((row: any) => {
                followMapPatch[row.handleNoAt] = row.isFollowing;
                requestMapPatch[row.handleNoAt] = row.isRequested;
            });
            setConnectionFollowMap((prev) => ({ ...prev, ...followMapPatch }));
            setConnectionRequestMap((prev) => ({ ...prev, ...requestMapPatch }));
            const hasMore = !!response?.hasMore || response?.nextCursor != null;
            const nextCursor = response?.nextCursor != null
                ? response.nextCursor
                : (typeof cursor === 'number' && hasMore ? cursor + 1 : null);
            if (tab === 'followers') {
                setFollowersList((prev) => {
                    if (reset) return normalized;
                    const merged = [...prev, ...normalized];
                    const dedup = new Map<string, any>();
                    merged.forEach((row: any) => dedup.set(row.handleNoAt.toLowerCase(), row));
                    return Array.from(dedup.values());
                });
                setFollowersHasMore(hasMore);
                setFollowersCursor(nextCursor);
            } else {
                setFollowingList((prev) => {
                    if (reset) return normalized;
                    const merged = [...prev, ...normalized];
                    const dedup = new Map<string, any>();
                    merged.forEach((row: any) => dedup.set(row.handleNoAt.toLowerCase(), row));
                    return Array.from(dedup.values());
                });
                setFollowingHasMore(hasMore);
                setFollowingCursor(nextCursor);
            }
        } catch (error) {
            console.error('Failed to load profile connections', error);
            const message = String((error as any)?.message || '');
            const isConnectionError = message === 'CONNECTION_REFUSED'
                || (error as any)?.name === 'ConnectionRefused'
                || message.includes('ERR_CONNECTION_REFUSED')
                || message.includes('Failed to fetch')
                || message.includes('NetworkError');
            if (isConnectionError) {
                try {
                    const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
                    const followedUsers = await getFollowedUsers(viewerId);
                    const followedSet = new Set((Array.isArray(followedUsers) ? followedUsers : []).map((entry) => normalizeHandleKey(String(entry))));
                    const normalized = await buildMockConnectionsForTab(tab, decodedHandle, followedSet);
                    if (tab === 'followers') {
                        setFollowersList(normalized);
                        setFollowersHasMore(false);
                        setFollowersCursor(0);
                        setStats((prev) => ({ ...prev, followers: normalized.length }));
                    } else {
                        setFollowingList(normalized);
                        setFollowingHasMore(false);
                        setFollowingCursor(0);
                        setStats((prev) => ({ ...prev, following: normalized.length }));
                    }
                    setConnectionsError(null);
                } catch (_) {
                    setConnectionsError('Could not load this list right now.');
                }
            } else {
                setConnectionsError('Could not load this list right now.');
                if (reset) {
                    if (tab === 'followers') setFollowersList([]);
                    else setFollowingList([]);
                }
            }
        } finally {
            if (reset) setConnectionsLoading(false);
            else setConnectionsLoadingMore(false);
        }
    }, [followersCursor, followingCursor, handle, mapConnectionItem, normalizeHandleKey, user]);

    const openConnections = React.useCallback((tab: 'followers' | 'following') => {
        setFollowersCursor(0);
        setFollowingCursor(0);
        setFollowersHasMore(true);
        setFollowingHasMore(true);
        setConnectionsScope(tab);
        setConnectionsSearch('');
        setShowConnectionsModal(true);
    }, []);

    React.useEffect(() => {
        if (!showConnectionsModal) return;
        if (connectionsScope === 'followers') {
            void loadConnections('followers', { reset: true });
            return;
        }
        if (connectionsScope === 'following') {
            void loadConnections('following', { reset: true });
            return;
        }
        if (connectionsScope === 'mutual') {
            void Promise.all([loadConnections('followers', { reset: true }), loadConnections('following', { reset: true })]);
        }
    }, [showConnectionsModal, connectionsScope, loadConnections]);

    React.useEffect(() => {
        if (!showConnectionsModal) return;
        const hydrateViewerFollows = async () => {
            try {
                const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
                const followedUsers = await getFollowedUsers(viewerId);
                setViewerFollowedSet(new Set((Array.isArray(followedUsers) ? followedUsers : []).map((entry) => normalizeHandleKey(String(entry)))));
            } catch (_) {}
        };
        void hydrateViewerFollows();
    }, [showConnectionsModal, user?.id, user?.handle, normalizeHandleKey]);

    React.useEffect(() => {
        const checkViewport = () => setCompactConnectionsPhone(window.innerWidth <= 390);
        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, []);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedConnectionsSearch(connectionsSearch);
        }, 160);
        return () => window.clearTimeout(timer);
    }, [connectionsSearch]);

    const visibleConnections = React.useMemo(() => {
        const followerMap = new Map(followersList.map((row) => [row.handleNoAt.toLowerCase(), row]));
        const followingMap = new Map(followingList.map((row) => [row.handleNoAt.toLowerCase(), row]));
        let source: any[] = [];
        if (connectionsScope === 'followers') {
            source = followersList;
        } else if (connectionsScope === 'following') {
            source = followingList;
        } else if (connectionsScope === 'mutual') {
            // Instagram-style mutuals: users both viewer and profile user follow.
            source = followingList.filter((row) => viewerFollowedSet.has(normalizeHandleKey(row.handleNoAt)));
        } else {
            const excluded = new Set<string>([
                (user?.handle || '').replace(/^@/, '').toLowerCase(),
                (profileUser?.handle || '').replace(/^@/, '').toLowerCase(),
                ...Object.keys(dismissedSuggestedMap).filter((key) => dismissedSuggestedMap[key]).map((key) => normalizeHandleKey(key)),
                ...Array.from(viewerFollowedSet),
            ]);
            const profileHandleLabel = profileUser?.handle ? `@${String(profileUser.handle).replace(/^@/, '')}` : 'this profile';
            const nowTs = Date.now();
            const postCountByHandle = new Map<string, number>();
            const recencyScoreByHandle = new Map<string, number>();
            allPosts.forEach((post) => {
                const key = String(post.userHandle || '').replace(/^@/, '').toLowerCase();
                if (!key) return;
                postCountByHandle.set(key, (postCountByHandle.get(key) || 0) + 1);
                const createdAt = Number(post.createdAt || 0);
                const ageHours = createdAt > 0 ? Math.max(0, (nowTs - createdAt) / 3600000) : 168;
                // Fresher posts contribute more, tapering over a week.
                const weight = Math.max(0.2, 1 - (ageHours / 168));
                recencyScoreByHandle.set(key, (recencyScoreByHandle.get(key) || 0) + weight);
            });
            const suggestedMap = new Map<string, any>();
            const resolveSuggestedAvatar = (handleNoAt: string): string => {
                const normalized = normalizeHandleKey(handleNoAt);
                const followerMatch = followersList.find((row) => normalizeHandleKey(row.handleNoAt) === normalized);
                if (followerMatch?.avatarUrl) return followerMatch.avatarUrl;
                const followingMatch = followingList.find((row) => normalizeHandleKey(row.handleNoAt) === normalized);
                if (followingMatch?.avatarUrl) return followingMatch.avatarUrl;
                return getAvatarForHandle(handleNoAt) || '';
            };
            const addSuggested = (rawHandle: string, rawName?: string) => {
                const key = rawHandle.replace(/^@/, '').trim();
                if (!key) return;
                const normalized = key.toLowerCase();
                if (excluded.has(normalized) || suggestedMap.has(normalized)) return;
                const inFollowers = followerMap.has(normalized);
                const inFollowing = followingMap.has(normalized);
                const mutualCount = (inFollowers ? 1 : 0) + (inFollowing ? 1 : 0);
                const clipCount = postCountByHandle.get(normalized) || 0;
                const recencyScore = recencyScoreByHandle.get(normalized) || 0;
                const mutualPreview = [
                    followerMap.get(normalized),
                    followingMap.get(normalized),
                ]
                    .filter(Boolean)
                    .map((entry: any) => ({
                        id: String(entry.id || entry.handleNoAt || ''),
                        handle: String(entry.handle || ''),
                        avatarUrl: String(entry.avatarUrl || ''),
                    }))
                    .filter((entry, index, arr) => arr.findIndex((x) => x.id === entry.id) === index)
                    .slice(0, 3);
                const suggestionReason = mutualCount === 2
                    ? `Mutual connection with ${profileHandleLabel}`
                    : inFollowing
                        ? `Followed by ${profileHandleLabel}`
                        : inFollowers
                            ? `Follows ${profileHandleLabel}`
                            : clipCount > 1
                                ? `${clipCount} recent clips`
                                : 'Suggested for you';
                const suggestionScore = (mutualCount * 100) + (recencyScore * 18) + (clipCount * 2);
                suggestedMap.set(normalized, {
                    id: `suggested-${normalized}`,
                    handle: `@${key}`,
                    handleNoAt: key,
                    name: rawName || key,
                    bio: suggestionReason,
                    avatarUrl: resolveSuggestedAvatar(key),
                    suggestionReason,
                    mutualCount,
                    mutualPreview,
                    suggestionScore,
                    isFollowing: viewerFollowedSet.has(normalized),
                    cluster: getHandleCluster(key),
                });
            };
            allPosts.forEach((post) => addSuggested(post.userHandle || '', post.userHandle || ''));
            const sorted = Array.from(suggestedMap.values()).sort((a, b) => b.suggestionScore - a.suggestionScore);
            const clusterCount = new Map<string, number>();
            const balanced: any[] = [];
            for (const item of sorted) {
                const cluster = String(item.cluster || 'other');
                const used = clusterCount.get(cluster) || 0;
                // Keep diversity so one local cluster does not flood suggestions.
                if (used >= 3 && balanced.length < 50) continue;
                balanced.push(item);
                clusterCount.set(cluster, used + 1);
                if (balanced.length >= 80) break;
            }
            source = balanced;
        }
        const query = debouncedConnectionsSearch.trim().toLowerCase();
        if (!query) return source;
        return source.filter((row) =>
            row.name.toLowerCase().includes(query) ||
            row.handle.toLowerCase().includes(query) ||
            row.bio.toLowerCase().includes(query),
        );
    }, [connectionsScope, followersList, followingList, debouncedConnectionsSearch, user?.handle, profileUser?.handle, dismissedSuggestedMap, normalizeHandleKey, getHandleCluster, viewerFollowedSet]);

    const dismissSuggestedRow = React.useCallback((handleNoAt: string) => {
        const key = normalizeHandleKey(handleNoAt);
        if (!key) return;
        setDismissedSuggestedMap((prev) => ({ ...prev, [key]: true }));
        setDismissUndo({ handleNoAt, expiresAt: Date.now() + 4200 });
    }, [normalizeHandleKey]);

    React.useEffect(() => {
        if (!dismissUndo) return;
        const remaining = Math.max(0, dismissUndo.expiresAt - Date.now());
        const timer = window.setTimeout(() => setDismissUndo(null), remaining);
        return () => window.clearTimeout(timer);
    }, [dismissUndo]);

    const handleUndoDismissSuggestion = React.useCallback(() => {
        if (!dismissUndo?.handleNoAt) return;
        const key = normalizeHandleKey(dismissUndo.handleNoAt);
        setDismissedSuggestedMap((prev) => ({ ...prev, [key]: false }));
        setDismissUndo(null);
    }, [dismissUndo, normalizeHandleKey]);

    const handleConnectionFollowToggle = React.useCallback(async (row: any) => {
        if (!row?.handleNoAt || !user) return;
        const key = row.handleNoAt;
        if (connectionActionLoadingMap[key]) return;
        const followUserId = user.id != null ? String(user.id) : getStableUserId(user);
        const targetHandle = String(row.handleNoAt).trim();
        const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';

        setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: true }));
        const rowPrivate = !!row?.isPrivate;
        const current = connectionFollowMap[key] ?? !!row.isFollowing;
        const requested = connectionRequestMap[key] ?? !!row.isRequested;
        if (!current && rowPrivate && requested) {
            if (user?.handle) {
                removeFollowRequest(user.handle, key);
            }
            setConnectionRequestMap((prev) => ({ ...prev, [key]: false }));
            setFollowersList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isRequested: false } : item));
            setFollowingList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isRequested: false } : item));
            flashConnectionActionSuccess(key);
            setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: false }));
            return;
        }
        if (!current && rowPrivate) {
            if (user?.handle) {
                createFollowRequest(user.handle, key);
            }
            setConnectionRequestMap((prev) => ({ ...prev, [key]: true }));
            setFollowersList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isRequested: true } : item));
            setFollowingList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isRequested: true } : item));
            flashConnectionActionSuccess(key);
            setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: false }));
            return;
        }
        setConnectionFollowMap((prev) => ({ ...prev, [key]: !current }));
        setConnectionRequestMap((prev) => ({ ...prev, [key]: false }));
        setFollowersList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isFollowing: !current, isRequested: false } : item));
        setFollowingList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isFollowing: !current, isRequested: false } : item));
        try {
            if (!useLaravelApi) {
                setFollowState(followUserId, targetHandle, !current);
                window.dispatchEvent(
                    new CustomEvent('followToggled', { detail: { handle: targetHandle, isFollowing: !current } }),
                );
            } else {
                await toggleFollow(targetHandle);
                setFollowState(followUserId, targetHandle, !current);
            }
            flashConnectionActionSuccess(key);
        } catch (error) {
            console.error('Failed to toggle follow from connections list', error);
            setConnectionFollowMap((prev) => ({ ...prev, [key]: current }));
            setConnectionRequestMap((prev) => ({ ...prev, [key]: requested }));
            setFollowersList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isFollowing: current } : item));
            setFollowingList((prev) => prev.map((item) => item.handleNoAt === key ? { ...item, isFollowing: current } : item));
        } finally {
            setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: false }));
        }
    }, [connectionActionLoadingMap, connectionFollowMap, connectionRequestMap, flashConnectionActionSuccess, user]);

    const handleConnectionsScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (connectionsLoading || connectionsLoadingMore || debouncedConnectionsSearch.trim()) return;
        const container = e.currentTarget;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom > 140) return;
        if (connectionsScope === 'followers' && followersHasMore) {
            void loadConnections('followers');
            return;
        }
        if (connectionsScope === 'following' && followingHasMore) {
            void loadConnections('following');
        }
    }, [
        connectionsLoading,
        connectionsLoadingMore,
        connectionsScope,
        debouncedConnectionsSearch,
        followersHasMore,
        followingHasMore,
        loadConnections,
    ]);

    const handleFollow = async () => {
        if (!user?.id || !handle) {
            console.error('Missing required data for follow:', { userId: user?.id, handle });
            Swal.fire(bottomSheet({ title: 'Error', message: 'Unable to follow user. Please try again.', icon: 'alert' }));
            return;
        }
        if (!user?.handle && isProfilePrivate(decodeURIComponent(handle))) {
            Swal.fire(bottomSheet({ title: 'Error', message: 'Unable to send follow request. Please sign in with a full profile.', icon: 'alert' }));
            return;
        }
        
        // Decode the handle from URL (in case it was encoded).
        // Use canonical handle from profile when available so API and follow state stay in sync (e.g. Bob@Cork vs bob@cork).
        const decodedHandle = decodeURIComponent(handle);
        const handleToUse = profileUser?.handle || decodedHandle;

        // Capture state at click time so mock path doesn't flip action after optimistic update
        const wasFollowingBeforeClick = isFollowing;
        const profilePrivate = isProfilePrivate(decodedHandle);

        // Use same key as Stories/Scenes (user.id) so follow state is shared; fallback to getStableUserId when id missing
        const followUserId = user?.id != null ? String(user.id) : getStableUserId(user);
        const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';

        // Mock-only: update state immediately and return (no API, no await) – same pattern as Stories so Follow always works
        if (!useLaravelApi) {
            const newFollowing = !wasFollowingBeforeClick;
            if (profilePrivate && newFollowing && user?.handle) {
                createFollowRequest(user.handle, handleToUse);
                setHasPendingRequest(true);
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                try {
                    const { createNotification } = await import('../api/notifications');
                    await createNotification({ type: 'follow_request', fromHandle: user.handle, toHandle: decodedHandle, message: `${user.handle} wants to follow you` });
                } catch (_) {}
                Swal.fire(followRequestSentBottomSheet());
            } else {
                setFollowState(followUserId, handleToUse, newFollowing);
                setIsFollowing(newFollowing);
                setHasPendingRequest(false);
                if (!newFollowing) {
                    setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
                    if (profileUser) setProfileUser((prev: any) => ({ ...prev, stats: { ...prev.stats, followers: Math.max(0, (prev.stats?.followers || 0) - 1) } }));
                } else {
                    setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
                    if (profileUser) setProfileUser((prev: any) => ({ ...prev, stats: { ...prev.stats, followers: (prev.stats?.followers || 0) + 1 } }));
                }
                if (profilePrivate) setCanViewProfileState(newFollowing);
            }
            window.dispatchEvent(new CustomEvent('followToggled', { detail: { handle: handleToUse, isFollowing: profilePrivate && newFollowing ? false : newFollowing } }));
            return;
        }

        // Optimistic update when using Laravel API
        if (!wasFollowingBeforeClick && !profilePrivate) {
            setIsFollowing(true);
            setFollowState(followUserId, handleToUse, true);
            setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
            if (profileUser) {
                setProfileUser((prev: any) => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        followers: (prev.stats?.followers || 0) + 1
                    }
                }));
            }
        }

        try {
            const followedUsers = await getFollowedUsers(followUserId);
            const isCurrentlyFollowing = followedUsers.some(h => h.toLowerCase() === handleToUse.toLowerCase());
            const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);

            let result;
            let useMockFallback = false;
            try {
                console.log('Calling toggleFollow with decoded handle:', decodedHandle);
                result = await toggleFollow(decodedHandle);
                console.log('Toggle follow result:', result);
            } catch (apiError: any) {
                // Check if it's a connection error (backend not running)
                const isConnectionError = 
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch') ||
                    apiError?.message?.includes('ERR_CONNECTION_REFUSED') ||
                    apiError?.message?.includes('NetworkError');
                
                if (isConnectionError) {
                    console.log('Backend not available, using mock fallback');
                    useMockFallback = true;
                    
                    const newFollowingState = !isCurrentlyFollowing;
                    
                    // Private profile + trying to follow = send request only. Do NOT add to follow list.
                    // User only becomes "following" after Sarah accepts.
                    if (profilePrivate && newFollowingState && !isCurrentlyFollowing && user?.handle) {
                        createFollowRequest(user.handle, handleToUse);
                        setHasPendingRequest(true);
                        setIsFollowing(false);
                        setFollowState(followUserId, handleToUse, false); // never add to follow list until accepted
                        
                        try {
                            const { createNotification } = await import('../api/notifications');
                            await createNotification({
                                type: 'follow_request',
                                fromHandle: user.handle,
                                toHandle: decodedHandle,
                                message: `${user.handle} wants to follow you`
                            });
                        } catch (error) {
                            console.warn('Failed to create follow request notification:', error);
                        }
                        
                        Swal.fire(followRequestSentBottomSheet());
                        return;
                    }
                    
                    // Normal follow/unfollow (public, or unfollow): update post state and shared follow state
                    if (posts[0]?.id) {
                        await toggleFollowForPost(followUserId, posts[0].id);
                    } else {
                        const userPost = allPosts.find(p => p.userHandle?.toLowerCase() === handleToUse.toLowerCase());
                        if (userPost) {
                            await toggleFollowForPost(followUserId, userPost.id);
                        }
                    }
                    setFollowState(followUserId, handleToUse, newFollowingState);
                    
                    setIsFollowing(newFollowingState);
                    setHasPendingRequest(false);
                    
                    if (newFollowingState) {
                        setCanViewProfileState(true);
                    } else if (profilePrivate) {
                        setCanViewProfileState(false);
                    }
                    
                    // Dispatch event to update newsfeed
                    window.dispatchEvent(new CustomEvent('followToggled', {
                        detail: { handle: handleToUse, isFollowing: newFollowingState }
                    }));
                    
                    // Update stats optimistically when using mock fallback
                    // Increment/decrement followers count based on follow state
                    if (newFollowingState) {
                        // User just followed - increment Bob's follower count
                        setStats(prev => ({
                            ...prev,
                            followers: prev.followers + 1
                        }));
                        if (profileUser) {
                            setProfileUser((prev: any) => ({
                                ...prev,
                                stats: {
                                    ...prev.stats,
                                    followers: (prev.stats?.followers || 0) + 1
                                }
                            }));
                        }
                    } else {
                        // User just unfollowed - decrement Bob's follower count
                        setStats(prev => ({
                            ...prev,
                            followers: Math.max(0, prev.followers - 1)
                        }));
                        if (profileUser) {
                            setProfileUser((prev: any) => ({
                                ...prev,
                                stats: {
                                    ...prev.stats,
                                    followers: Math.max(0, (prev.stats?.followers || 0) - 1)
                                }
                            }));
                        }
                    }
                    
                    return; // Exit early since we handled it with mock
                } else {
                    // Re-throw if it's a different error
                    throw apiError;
                }
            }
            
            // Continue with API result handling if we got here
            
            // Use the API response to determine the new state.
            // Backend is expected to return a status of 'unfollowed', 'pending', or 'accepted',
            // but we also handle a generic "following: true/false" shape.
            if (result.status === 'unfollowed') {
                // Unfollow
                // Also update local state for consistency
                if (posts[0]?.id) {
                    await toggleFollowForPost(followUserId, posts[0].id);
                }
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                setHasPendingRequest(false);
                removeFollowRequest(user.handle, handleToUse);
                
                // If profile was private, user can no longer view
                if (profilePrivate) {
                    setCanViewProfileState(false);
                }
            } else if (result.status === 'pending') {
                // Private profile - follow request sent (only if not already pending)
                if (!hasPending && user?.handle) {
                    createFollowRequest(user.handle, handleToUse);
                    setHasPendingRequest(true);
                setIsFollowing(false);
                    
                    // Create notification for the recipient
                    try {
                        const { createNotification } = await import('../api/notifications');
                        await createNotification({
                            type: 'follow_request',
                            fromHandle: user.handle,
                            toHandle: handleToUse,
                            message: `${user.handle} wants to follow you`
                        });
                    } catch (error) {
                        console.warn('Failed to create follow request notification:', error);
                    }
                    
                    Swal.fire(followRequestSentBottomSheet());
                }
            } else if (result.status === 'accepted' || result.following === true) {
                // Public profile - follow immediately
                // Also update local state for consistency
                if (posts[0]?.id) {
                    await toggleFollowForPost(followUserId, posts[0].id);
                }
                setIsFollowing(true);
                setFollowState(followUserId, decodedHandle, true);
                setHasPendingRequest(false);
                setCanViewProfileState(true);
            } else {
                // Fallback: if backend returned an unexpected shape,
                // optimistically toggle follow state so the UI still updates.
                console.warn('toggleFollow: unexpected response shape, applying optimistic toggle', result);
                const newFollowingState = !isCurrentlyFollowing;
                setIsFollowing(newFollowingState);
                setHasPendingRequest(false);
                setFollowState(followUserId, decodedHandle, newFollowingState);
                if (newFollowingState && profilePrivate) {
                    setCanViewProfileState(true);
                } else if (!newFollowingState && profilePrivate) {
                    setCanViewProfileState(false);
                }
            }

            // Dispatch event to update newsfeed
            window.dispatchEvent(new CustomEvent('followToggled', {
                detail: { handle: handleToUse, isFollowing: !isCurrentlyFollowing }
            }));

            // Refresh profile counts in background (don't block UI)
            fetchUserProfile(handleToUse, user?.id).then((userProfileData) => {
                const followingCount = userProfileData.following_count || 0;
                const followersCount = userProfileData.followers_count || 0;
                setStats(prev => ({ ...prev, following: followingCount, followers: followersCount }));
                if (profileUser) {
                    setProfileUser((prev: any) => ({
                        ...prev,
                        stats: { ...prev.stats, following: followingCount, followers: followersCount }
                    }));
                }
            }).catch((error) => {
                console.error('Error refreshing profile counts:', error);
            });
        } catch (error: any) {
            console.error('Error toggling follow:', error);

            // Revert optimistic update only when we had set "Following" and the API then failed
            if (!profilePrivate && isFollowing) {
                setIsFollowing(false);
                setFollowState(followUserId, handleToUse, false);
                setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
                if (profileUser) {
                    setProfileUser((prev: any) => ({
                        ...prev,
                        stats: { ...prev.stats, followers: Math.max(0, (prev.stats?.followers || 0) - 1) }
                    }));
                }
            }
            
            // Check if it's a connection error (backend not running)
            const isConnectionError = 
                error?.message === 'CONNECTION_REFUSED' ||
                error?.name === 'ConnectionRefused' ||
                error?.message?.includes('Failed to fetch') ||
                error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                error?.message?.includes('NetworkError');
            
            if (isConnectionError) {
                Swal.fire(bottomSheet({
                    title: 'Backend Server Not Running',
                    html: `<p class="swal-bottom-sheet-message">The Laravel backend server is not running. To enable the follow feature: Open a terminal, navigate to <code>laravel-backend</code>, and run <code>php artisan serve</code>.</p>`,
                    icon: 'alert',
                    confirmButtonText: 'OK',
                }));
            } else {
                Swal.fire(bottomSheet({ title: 'Error', message: error?.message || 'Failed to follow user. Please try again.', icon: 'alert' }));
            }
        }
    };

    React.useEffect(() => {
        const loadProfile = async () => {
            if (!handle) return;

            // Decode the handle from URL (in case it was encoded)
            const decodedHandle = decodeURIComponent(handle);
            setLoading(true);
            setProfilePostsCursor(null);
            setProfilePostsHasMore(false);
            setProfilePostsLoadingMore(false);
            try {
                // Check privacy using localStorage
                const profilePrivate = isProfilePrivate(decodedHandle);
                setProfileIsPrivate(profilePrivate);
                
                if (user?.id && user?.handle) {
                    const followUserId = user.id != null ? String(user.id) : getStableUserId(user);
                    const followedUsers = await getFollowedUsers(followUserId);
                    const canView = canViewProfile(user?.handle || '', decodedHandle, followedUsers);
                    const isFollowingUser = followedUsers.some(h => h.toLowerCase() === decodedHandle.toLowerCase());
                    const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);
                    
                    // Base values from follow list
                    let effectiveCanView = canView;
                    let effectiveIsFollowing = isFollowingUser;

                    // If profile is private and there is a pending request but not actually following,
                    // treat this as "request sent, waiting" – user cannot view yet and is not following.
                    if (profilePrivate && hasPending && !isFollowingUser) {
                        effectiveCanView = false;
                        effectiveIsFollowing = false;
                    }

                    setCanViewProfileState(effectiveCanView);
                    setIsFollowing(effectiveIsFollowing);
                    setHasPendingRequest(hasPending);
                    
                    // Show SweetAlert if profile is private and user can't view (same bottom-sheet style as Follow Request Sent)
                    if (!canView && profilePrivate && decodedHandle !== user.handle) {
                        Swal.fire(accountIsPrivateBottomSheet()).then(async (result) => {
                            // Only create follow request if user explicitly clicked "Follow"
                            // If they clicked "Cancel" (result.isDismissed or !result.isConfirmed), do nothing
                            if (result.isConfirmed && user?.id) {
                                try {
                                    await handleFollow();
                                } catch (error) {
                                    console.error('Error following user:', error);
                                }
                            } else {
                                // User clicked Cancel - ensure no follow request is created
                                // If there's a stale pending request, we should NOT remove it here
                                // because the user might have created it from a different place (like the + icon)
                                // We'll just log it for debugging
                                const hasPending = hasPendingFollowRequest(user?.handle || '', decodedHandle);
                                if (hasPending) {
                                    console.log('Note: There is a pending follow request from a previous interaction. User clicked Cancel, so no new request was created. The existing pending request remains.');
                                } else {
                                    console.log('User cancelled follow request - no action taken, no pending request exists');
                                }
                            }
                        });
                        
                        setLoading(false);
                        return;
                    }
                }

                // Fetch posts by userHandle - check posts array first (instant, no API calls)
                // This is much faster than fetching from multiple tabs
                let userPosts: Post[] = [];
                
                // First, check the exported posts array directly (instant, no delays)
                if (allPosts && allPosts.length > 0) {
                    userPosts = allPosts.filter(post => post.userHandle === decodedHandle);
                }
                
                // If we found posts, we're done. Otherwise, try fetching from tabs as fallback
                // (This should rarely be needed since posts array should have all posts)
                if (userPosts.length === 0) {
                    const allTabs = ['finglas', 'dublin', 'ireland'];
                    // Fetch from tabs in parallel for better performance
                    const tabPromises = allTabs.map(async (tab) => {
                        try {
                            const page = await fetchPostsPage(tab, null, 100, user?.id || 'me', user?.local || '', user?.regional || '', user?.national || '', '');
                            return page.items.filter(post => post.userHandle === decodedHandle);
                        } catch (error) {
                            return [];
                        }
                    });
                    
                    const tabResults = await Promise.all(tabPromises);
                    userPosts = tabResults.flat();
                }

                // Remove duplicates by post ID
                const uniquePosts = userPosts.filter((post, index, self) =>
                    index === self.findIndex(p => p.id === post.id)
                );

                // Try to get avatar from user object if viewing own profile, otherwise use placeholder
                let avatarUrl = decodedHandle === user?.handle ? user?.avatarUrl : undefined;

                // Try to get avatar from avatar mapping
                if (!avatarUrl) {
                    const { getAvatarForHandle } = await import('../api/users');
                    avatarUrl = getAvatarForHandle(decodedHandle);
                }

                // Mock profile picture for Sarah@Artane
                if (decodedHandle === 'Sarah@Artane') {
                    avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop';
                }

                // Get bio, social links, placesTraveled, and profile background if viewing own profile
                let bio = decodedHandle === user?.handle ? user?.bio : undefined;
                let socialLinks = decodedHandle === user?.handle ? user?.socialLinks : undefined;
                let placesTraveled = decodedHandle === user?.handle ? user?.placesTraveled : undefined;
                let profileBackgroundUrl = decodedHandle === user?.handle ? (user as any)?.profileBackgroundUrl : undefined;
                
                // Debug: Log placesTraveled from user
                if (decodedHandle === user?.handle) {
                    console.log('Viewing own profile - user handle:', user?.handle, 'decodedHandle:', decodedHandle);
                    console.log('Viewing own profile, placesTraveled from user:', user?.placesTraveled);
                    console.log('Is array?', Array.isArray(user?.placesTraveled));
                    console.log('Length:', Array.isArray(user?.placesTraveled) ? user.placesTraveled.length : 'N/A');
                }

                // Mock data for test user Sarah@Artane
                if (decodedHandle === 'Sarah@Artane') {
                    bio = '📍 Living in Artane, Dublin! Love exploring Ireland, sharing local spots, and connecting with the community. Food enthusiast 🍳 Travel lover 🌍 Always up for an adventure!';
                    socialLinks = {
                        website: 'https://sarah-artane.com',
                        x: '@sarah_artane',
                        instagram: '@sarah.artane',
                        tiktok: '@sarah_artane_dublin'
                    };
                    placesTraveled = ['Dublin', 'Iceland', 'Japan', 'Egypt', 'Morocco', 'Spain', 'Italy', 'Greece', 'Thailand'];
                }

                // Mock data for test user Bob@Ireland
                if (decodedHandle === 'Bob@Ireland') {
                    bio = 'Based in Ireland. Love hiking and photography. Traveled to Cork, Galway, Belfast, London, Paris.';
                    placesTraveled = ['Cork', 'Galway', 'Belfast', 'London', 'Paris'];
                }

                if (decodedHandle === user?.handle && !profileBackgroundUrl) {
                    try {
                        const raw = localStorage.getItem('user');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed?.profileBackgroundUrl) {
                                profileBackgroundUrl = parsed.profileBackgroundUrl;
                            }
                        }
                    } catch (_) {}
                }

                // Calculate total likes and views from all posts
                const totalLikes = uniquePosts.reduce((sum, post) => sum + (post.stats?.likes || 0), 0);
                const totalViews = uniquePosts.reduce((sum, post) => sum + (post.stats?.views || 0), 0);

                // Fetch user profile data from API only when Laravel is enabled (avoids long timeouts when backend is off)
                let followingCount = 0;
                let followersCount = 0;
                let apiProfileData: any = null;
                const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
                if (useLaravelApi) {
                    try {
                        const userProfileData = await fetchUserProfile(decodedHandle, user?.id, null, 20);
                        apiProfileData = userProfileData;
                        followingCount = userProfileData.following_count || 0;
                        followersCount = userProfileData.followers_count || 0;

                        if (userProfileData.avatar_url && !avatarUrl) avatarUrl = userProfileData.avatar_url;
                        if (userProfileData.bio && !bio) bio = userProfileData.bio;
                        if (userProfileData.social_links && !socialLinks) socialLinks = userProfileData.social_links;
                        const apiPt =
                            (userProfileData as any).places_traveled ?? (userProfileData as any).placesTraveled;
                        if (Array.isArray(apiPt) && apiPt.length > 0) {
                            placesTraveled = apiPt.filter((s: unknown) => typeof s === 'string');
                        }
                    } catch (error: any) {
                        const isConnectionError =
                            error?.message === 'CONNECTION_REFUSED' ||
                            error?.name === 'ConnectionRefused' ||
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                            error?.message?.includes('NetworkError');
                        if (!isConnectionError) console.error('Error fetching user profile data:', error);
                    }
                }

                // When API failed or mock: if current user follows this profile, show at least 1 follower
                if (user?.id && decodedHandle !== user?.handle) {
                    try {
                        const followedList = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                        const followsThisProfile = followedList.some(h => h.toLowerCase() === decodedHandle.toLowerCase());
                        if (followsThisProfile && followersCount < 1) followersCount = 1;
                    } catch (_) {}
                }

                // When viewing own profile, ensure following count is at least the frontend follow list size
                // (e.g. user followed Ava from feed but backend count wasn't updated or API failed)
                const isOwnProfile = decodedHandle === user?.handle;
                if (isOwnProfile && user?.id) {
                    try {
                        const followedList = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                        if (followedList.length > followingCount) {
                            followingCount = followedList.length;
                        }
                    } catch (_) {}
                }

                // Mock mode: header counts must match modal lists (loadProfile runs after other effects and was overwriting with stale 1 follower).
                if (!useLaravelApi) {
                    try {
                        const followedList = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                        const mockCounts = computeMockGraphFollowCounts(decodedHandle, user?.handle, followedList);
                        followersCount = Math.max(followersCount, mockCounts.followers);
                        followingCount = Math.max(followingCount, mockCounts.following);
                    } catch (_) {}
                }

                // If no dedicated "Places traveled" list, derive places from bio (e.g. "Paris, London, Tokyo" or "I've been to Dublin and Cork")
                if ((!placesTraveled || placesTraveled.length === 0) && bio) {
                    const fromBio = parsePlacesFromBio(bio);
                    if (fromBio.length > 0) placesTraveled = fromBio;
                }

                // Always create profile data, even if no posts found
                // This ensures the profile page shows even for users with no posts
                const profileData = {
                    handle: decodedHandle,
                    name: decodedHandle.split('@')[0],
                    avatarUrl: avatarUrl,
                    bio: bio || undefined,
                    socialLinks: socialLinks || undefined,
                    placesTraveled: placesTraveled || undefined,
                    profileBackgroundUrl: profileBackgroundUrl || undefined,
                    stats: {
                        following: followingCount,
                        followers: followersCount,
                        likes: totalLikes || 0,
                        views: totalViews || 0
                    }
                };

                // Debug: Log profileData before setting
                console.log('Setting profileData with placesTraveled:', profileData.placesTraveled);
                console.log('Full profileData:', profileData);
                
                setProfileUser(profileData);
                setStats({
                    following: profileData.stats.following,
                    followers: profileData.stats.followers,
                    likes: profileData.stats.likes,
                    views: profileData.stats.views
                });
                const apiPostsRaw = Array.isArray(apiProfileData?.posts) ? apiProfileData.posts : [];
                if (apiPostsRaw.length > 0) {
                    const transformedApiPosts = apiPostsRaw.map((p: any) => transformLaravelPost(p));
                    if (DEBUG_PROFILE_GRID_PAGING) {
                        console.info('[ProfileGrid][initial-page]', {
                            handle: decodedHandle,
                            count: transformedApiPosts.length,
                            nextCursor: apiProfileData?.postsNextCursor ?? null,
                            hasMore: !!apiProfileData?.postsHasMore,
                        });
                    }
                    setPosts(transformedApiPosts);
                    setProfilePostsCursor(apiProfileData?.postsNextCursor ?? null);
                    setProfilePostsHasMore(!!apiProfileData?.postsHasMore);
                } else {
                    setPosts(uniquePosts);
                    setProfilePostsCursor(null);
                    setProfilePostsHasMore(false);
                }

            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [handle, user?.id, user?.placesTraveled, user?.bio]);

    // Check if user has stories (unviewed for others, any for current user)
    React.useEffect(() => {
        async function checkStory() {
            if (!handle) return;
            try {
                const isCurrentUser = handle === user?.handle;
                let result;
                if (isCurrentUser) {
                    // For current user, check if they have any stories
                    result = await userHasStoriesByHandle(handle);
                } else {
                    // For other users, check if current user has unviewed stories
                    result = await userHasUnviewedStoriesByHandle(handle);
                }
                setHasStory(result);
            } catch (error) {
                console.error('Error checking story:', error);
            }
        }
        checkStory();

        // Re-check periodically to update when stories expire after 24 hours
        const intervalId = setInterval(() => {
            checkStory();
        }, 60000); // Check every minute

        // Listen for storiesViewed event to remove border when stories are viewed
        const handleStoriesViewed = (event: CustomEvent) => {
            const viewedHandle = event.detail?.userHandle;
            if (handle === viewedHandle) {
                setHasStory(false);
            }
        };

        window.addEventListener('storiesViewed', handleStoriesViewed as EventListener);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('storiesViewed', handleStoriesViewed as EventListener);
        };
    }, [handle]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    if (!profileUser && !loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Show private profile message if can't view
    if (!canViewProfileState && profileIsPrivate && !loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white">
                <div className="sticky top-0 bg-gray-950 z-10 border-b border-gray-800">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-900 rounded-full transition-colors"
                        >
                            <FiChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-center min-h-[80vh]">
                    <div className="text-center px-4">
                        <FiLock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold mb-2">This Account is Private</h2>
                        <p className="text-gray-400 mb-6">To view this user's profile you must be following them.</p>
                        {!hasPendingRequest && (
                            <button
                                onClick={handleFollow}
                                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-semibold transition-colors"
                            >
                                Follow
                            </button>
                        )}
                        {hasPendingRequest && (
                            <p className="text-gray-500">Follow request sent</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
            {/* Sticky profile top bar (TikTok/Instagram-style hierarchy) */}
            <div className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md">
                <div className="flex items-center justify-between px-3 py-2.5">
                    <button
                        onClick={() => navigate(-1)}
                        className="h-11 w-11 rounded-full border border-white/20 bg-black/70 text-white flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95"
                        aria-label="Go back"
                    >
                        <FiChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 text-center px-2">
                        <div className="text-sm font-semibold truncate">{profileUser?.name || 'Profile'}</div>
                        <div className="text-[11px] text-gray-400 truncate">{profileUser?.handle || ''}</div>
                    </div>
                    <button
                        onClick={() => setShowShareProfileModal(true)}
                        className="h-11 w-11 rounded-full border border-white/20 bg-black/70 text-white flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95"
                        aria-label="Share profile"
                    >
                        <FiShare2 className="h-4.5 w-4.5" />
                    </button>
                </div>
            </div>

            {/* Passport Title */}
            <div className="w-full text-center pt-4 pb-3">
                <h1 className="text-[28px] font-semibold tracking-tight text-white">Passport</h1>
                <p className="mt-1 text-xs text-gray-400 uppercase tracking-[0.2em]">Profile</p>
            </div>

            {/* Profile Info with World Map Background */}
            <div className="relative w-full overflow-hidden px-3">
                {/* World Map Background */}
                <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden border border-white/10">
                    {(() => {
                        const coverSrc = profileUser?.profileBackgroundUrl || "/placeholders/world-map.jpg";
                        const isCustomCover = !!profileUser?.profileBackgroundUrl;
                        return (
                    <img
                        src={coverSrc}
                        alt="World Map"
                        className={`w-full h-full object-cover ${isCustomCover ? 'opacity-95' : 'opacity-30 dark:opacity-20'}`}
                        style={{ 
                            filter: isCustomCover ? 'none' : 'grayscale(100%) brightness(1.2)',
                        }}
                        onError={(e) => {
                            // Fallback to Wikimedia map
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';
                        }}
                    />
                        );
                    })()}
                    {isOwnProfile && (
                        <button
                            type="button"
                            onClick={() => navigate('/profile/cover')}
                            className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full border border-white/40 bg-black/55 text-white text-xs font-semibold hover:bg-black/70 transition-colors"
                        >
                            Change cover
                        </button>
                    )}
                    {/* Overlay gradient for better text visibility */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/70"></div>
                    
                    {/* Profile Picture and Name Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        {/* Profile Picture */}
                        <div className="mb-3">
                            <Avatar
                                src={
                                    profileUser.avatarUrl ||
                                    getAvatarForHandle(profileUser.handle || decodeURIComponent(handle || ''))
                                }
                                name={profileUser.name}
                                size="xl"
                                className="!w-28 !h-28 border-4 border-white/90 shadow-2xl cursor-pointer"
                                hasStory={hasStory}
                                onClick={() => setShowProfileMenu(true)}
                            />
                        </div>

                        {/* Username */}
                        <div className="text-center">
                            <h1 className="text-2xl font-bold mb-1 text-white tracking-tight drop-shadow-lg">
                                {profileUser.name}
                            </h1>
                            <p className="text-sm text-gray-200/90 flex items-center justify-center gap-1">
                                <span>{profileUser.handle}</span>
                                <Flag
                                    value={profileUser.handle === user?.handle ? (user?.countryFlag || '') : (getFlagForHandle(profileUser.handle) || '')}
                                    size={16}
                                />
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Info Section (below world map) */}
            <div className="px-4 py-5">

                {/* Statistics */}
                <div className="grid grid-cols-4 gap-2 mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                    <button
                        type="button"
                        onClick={() => openConnections('following')}
                        className="text-center rounded-xl bg-black/40 py-2 hover:bg-white/10 active:scale-[0.99] transition-all"
                    >
                        <div className="text-base font-semibold">{stats.following}</div>
                        <div className="text-[11px] text-gray-400">Following</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => openConnections('followers')}
                        className="text-center rounded-xl bg-black/40 py-2 hover:bg-white/10 active:scale-[0.99] transition-all"
                    >
                        <div className="text-base font-semibold">{stats.followers > 1000 ? `${(stats.followers / 1000).toFixed(1)}K` : stats.followers}</div>
                        <div className="text-[11px] text-gray-400">Followers</div>
                    </button>
                    <div className="text-center rounded-xl bg-black/40 py-2">
                        <div className="text-base font-semibold">{stats.views > 1000 ? `${(stats.views / 1000).toFixed(1)}K` : stats.views}</div>
                        <div className="text-[11px] text-gray-400">Views</div>
                    </div>
                    <div className="text-center rounded-xl bg-black/40 py-2">
                        <div className="text-base font-semibold">{stats.likes > 1000 ? `${(stats.likes / 1000).toFixed(1)}K` : stats.likes}</div>
                        <div className="text-[11px] text-gray-400">Likes</div>
                    </div>
                </div>

                {/* Action Buttons - hide Follow/Message when viewing own profile (show when no user.handle so button isn't hidden) */}
                <div className="flex gap-2 mb-4 relative z-10">
                    {handle && (!user?.handle || decodeURIComponent(handle) !== user.handle) && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFollow();
                        }}
                        className="flex-1 py-2.5 rounded-xl font-semibold transition-colors bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!user?.id || !handle}
                    >
                        {hasPendingRequest ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
                    </button>
                    )}
                    {handle && (!user?.handle || decodeURIComponent(handle) !== user.handle) && (
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (handle && user?.handle && user?.id) {
                                // Decode the handle from URL
                                const decodedHandle = decodeURIComponent(handle);
                                // Check if user can message (privacy check)
                                const followedUsers = await getFollowedUsers(user?.id != null ? String(user.id) : getStableUserId(user));
                                if (!canSendMessage(user?.handle || '', decodedHandle, followedUsers)) {
                                    Swal.fire(bottomSheet({ title: 'Cannot Send Message', message: 'You must follow this user to send them a message.', icon: 'alert' }));
                                    return;
                                }
                                navigate(`/messages/${decodedHandle}`);
                            }
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-black text-white border border-white/30 font-semibold hover:bg-white/10 transition-colors relative z-20"
                    >
                        Message
                    </button>
                    )}
                </div>

                {/* Secondary quick action row */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Use helper that includes localStorage fallback so bio / Travel Info from Profile always count
                            const effectivePlaces = getEffectivePlacesWithStorageFallback(profileUser, user);
                            if (!effectivePlaces || effectivePlaces.length === 0) {
                                const decodedHandle = handle ? decodeURIComponent(handle) : 'This user';
                                Swal.fire(bottomSheet({
                                    title: 'No Places Traveled',
                                    message: `${decodedHandle} hasn't added any places they've traveled to their profile yet.`,
                                    icon: 'alert',
                                }));
                            } else {
                                setPlacesForTravelModal(effectivePlaces);
                                setShowTraveledModal(true);
                            }
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-black text-white border border-white/30 font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                        title="Places Traveled"
                    >
                        <FiMapPin className="w-4.5 h-4.5" />
                        Places
                    </button>
                    <button
                        onClick={() => setShowShareProfileModal(true)}
                        className="flex-1 py-2.5 rounded-xl bg-black text-white border border-white/30 font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <FiShare2 className="w-4.5 h-4.5" />
                        Share
                    </button>
                </div>

                {/* Bio */}
                {profileUser.bio ? (
                    <div className="mb-4 text-sm rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                        <p className="text-gray-200">{profileUser.bio}</p>
                    </div>
                ) : (
                    <div className="mb-4 text-sm text-gray-500 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                        <p>No bio yet</p>
                    </div>
                )}

                {/* Social Links */}
                {profileUser.socialLinks && (profileUser.socialLinks.website || profileUser.socialLinks.x || profileUser.socialLinks.instagram || profileUser.socialLinks.tiktok) && (
                    <div className="mb-6 flex flex-wrap gap-2.5">
                        {profileUser.socialLinks.website && (
                            <a
                                href={profileUser.socialLinks.website.startsWith('http') ? profileUser.socialLinks.website : `https://${profileUser.socialLinks.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-black text-white rounded-xl border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Website
                            </a>
                        )}
                        {profileUser.socialLinks.x && (
                            <a
                                href={`https://twitter.com/${profileUser.socialLinks.x.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-11 h-11 bg-black text-white rounded-xl border border-white/20 hover:bg-white/10 transition-colors active:scale-95 flex items-center justify-center"
                                title={profileUser.socialLinks.x}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        )}
                        {profileUser.socialLinks.instagram && (
                            <a
                                href={`https://instagram.com/${profileUser.socialLinks.instagram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-11 h-11 bg-black text-white rounded-xl border border-white/20 hover:bg-white/10 transition-colors active:scale-95 flex items-center justify-center"
                                title={profileUser.socialLinks.instagram}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.419-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.074-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                                </svg>
                            </a>
                        )}
                        {profileUser.socialLinks.tiktok && (
                            <a
                                href={`https://tiktok.com/@${profileUser.socialLinks.tiktok.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-11 h-11 bg-black rounded-xl border border-white/20 hover:bg-white/10 transition-colors active:scale-95 flex items-center justify-center"
                                title={profileUser.socialLinks.tiktok}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.65 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                </svg>
                            </a>
                        )}
                    </div>
                )}

            </div>

            {/* Content tabs + posts grid */}
            <div className="px-2">
                <div className="sticky top-[58px] z-20 mb-2 px-1 py-1.5 bg-black/75 backdrop-blur-md border-y border-white/10">
                    <div className="grid grid-cols-4 gap-1.5">
                        {([
                            { id: 'all', label: 'All' },
                            { id: 'videos', label: 'Videos' },
                            { id: 'photos', label: 'Photos' },
                            { id: 'text', label: 'Text' },
                        ] as const).map((tab) => {
                            const active = contentTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setContentTab(tab.id)}
                                    className={`py-2.5 min-h-[44px] text-xs font-semibold rounded-lg transition-colors active:scale-[0.98] ${
                                        active
                                            ? 'bg-white text-black'
                                            : 'bg-black text-white border border-white/20 hover:bg-white/10'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {filteredPosts.length > 0 ? (
                        filteredPosts.map((post) => (
                            <div
                                key={post.id}
                                role="button"
                                tabIndex={0}
                                className="aspect-square relative group cursor-pointer bg-gray-900 rounded-lg overflow-hidden border border-white/10 touch-manipulation select-none"
                                onPointerDown={(e) => handleGridPointerDown(e, post)}
                                onPointerUp={handleGridPointerUp}
                                onPointerCancel={handleGridPointerUp}
                                onPointerLeave={handleGridPointerUp}
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => handleGridCellClick(post)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleGridCellClick(post);
                                    }
                                }}
                            >
                                {post.mediaUrl ? (
                                    post.mediaType === 'video' ? (
                                        <div className="w-full h-full relative bg-gray-900">
                                            {/* Video element to show first frame */}
                                            <video
                                                src={post.mediaUrl}
                                                className="w-full h-full object-cover"
                                                muted
                                                playsInline
                                                preload="metadata"
                                            />
                                            {/* Play button overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-14 h-14 bg-black/60 rounded-full border border-white/25 flex items-center justify-center hover:bg-black/75 transition-colors">
                                                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Video indicator badge */}
                                            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 border border-white/25 rounded-md flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M6.5 4.5a.5.5 0 01.09.09L11 7.5a.5.5 0 110 .92l-4.41 2.91a.5.5 0 11-.59-.81l4.41-2.91L6.91 4.5A.5.5 0 016.5 4.5zm3 0a.5.5 0 01.09.09l5 5a.5.5 0 110 .92l-5 5a.5.5 0 11-.59-.81L13.5 10l-4.41-2.91A.5.5 0 019.5 4.5zm-6 0a.5.5 0 01.09.09l5 5a.5.5 0 11-.59.81L3 5.5l4.41 2.91a.5.5 0 11-.59-.81l-5-5A.5.5 0 010 4.5z" />
                                                </svg>
                                                <span className="text-xs text-white font-medium">Video</span>
                                            </div>
                                            {/* Location badge */}
                                            {post.locationLabel && (
                                                <div className="absolute top-2 left-2 max-w-[85%] px-2 py-0.5 bg-black/70 border border-white/25 rounded-md flex items-center gap-1">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="text-xs text-white font-medium truncate">{post.locationLabel}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <img
                                                src={post.mediaUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Location badge for images */}
                                            {post.locationLabel && (
                                                <div className="absolute top-2 left-2 max-w-[85%] px-2 py-0.5 bg-black/70 border border-white/25 rounded-md flex items-center gap-1">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="text-xs text-white font-medium truncate">{post.locationLabel}</span>
                                                </div>
                                            )}
                                        </>
                                    )
                                ) : (
                                    (() => {
                                        const tStyle = getEffectiveTextStyleForPost(post);
                                        const bg = getTextOnlyFallbackBackground(post);
                                        const color = tStyle?.color || '#ffffff';
                                        const fontFamily = tStyle?.fontFamily;
                                        const sizeCls = `${getTextOnlyPreviewTextClass(tStyle?.size)} font-semibold`;
                                        return (
                                    <div
                                        className="w-full h-full relative flex items-center justify-center p-3"
                                        style={{ background: bg, fontFamily: fontFamily || undefined }}
                                    >
                                        <p
                                            className={`${sizeCls} text-center line-clamp-6`}
                                            style={{ color }}
                                        >
                                            {post.text || 'No preview'}
                                        </p>
                                        {/* Location badge for text-only posts */}
                                        {post.locationLabel && (
                                            <div className="absolute top-2 left-2 max-w-[85%] px-2 py-0.5 bg-black/70 border border-white/25 rounded-md flex items-center gap-1">
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="text-xs text-white font-medium truncate">{post.locationLabel}</span>
                                            </div>
                                        )}
                                    </div>
                                        );
                                    })()
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </div>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-12 text-gray-500">
                            <p className="text-lg mb-2">
                                {contentTab === 'all'
                                    ? 'No posts yet'
                                    : `No ${contentTab} yet`}
                            </p>
                            <p className="text-sm">
                                {contentTab === 'all'
                                    ? "When this user posts, you'll see them here."
                                    : `Switch tabs to view other content.`}
                            </p>
                        </div>
                    )}
                </div>
                {contentTab === 'all' && profilePostsHasMore && (
                    <div ref={profilePostsLoadMoreRef} className="flex items-center justify-center py-4">
                        {profilePostsLoadingMore && (
                            <span className="text-sm text-gray-400">Loading more posts...</span>
                        )}
                    </div>
                )}
            </div>

            {/* Instagram-style long-press peek: blurred backdrop, preview card, action sheet */}
            {gridPeekPost && profileUser && (
                <div
                    className="fixed inset-0 z-[85] flex flex-col items-center justify-center px-4 py-6 overscroll-none"
                    style={{ overscrollBehavior: 'contain' }}
                    role="presentation"
                    onClick={closeGridPeek}
                >
                    <div
                        className="absolute inset-0 bg-black/55 backdrop-blur-2xl backdrop-grayscale transition-[opacity] duration-100"
                        style={{ opacity: Math.max(0.28, 1 - Math.min(peekPullY / 360, 0.58)) }}
                        aria-hidden
                    />
                    <div
                        className="relative z-10 w-full max-w-[360px] flex flex-col gap-2.5 will-change-transform"
                        style={{ transform: `translateY(${peekPullY}px)`, transition: peekPullTransition }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            role="presentation"
                            className="rounded-[14px] overflow-hidden bg-black border border-white/25 shadow-[0_24px_80px_rgba(0,0,0,0.75)] cursor-grab active:cursor-grabbing touch-pan-y"
                            onPointerDown={handlePeekPreviewPointerDown}
                            onPointerMove={handlePeekPreviewPointerMove}
                            onPointerUp={handlePeekPreviewPointerEnd}
                            onPointerCancel={handlePeekPreviewPointerEnd}
                        >
                            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/20 bg-black">
                                <Avatar
                                    src={
                                        profileUser.avatarUrl ||
                                        getAvatarForHandle(profileUser.handle || decodeURIComponent(handle || ''))
                                    }
                                    name={profileUser.name || profileUser.handle}
                                    size="sm"
                                    className="grayscale contrast-[1.02]"
                                />
                                <div className="min-w-0 flex-1 flex items-center gap-1">
                                    <span className="font-semibold text-white text-[15px] truncate">
                                        {(profileUser.handle || gridPeekPost.userHandle || '').replace(/^@/, '')
                                            ? `@${String(profileUser.handle || gridPeekPost.userHandle).replace(/^@/, '')}`
                                            : ''}
                                    </span>
                                    {profileUser.is_verified ? (
                                        <span
                                            className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white border border-white"
                                            title="Verified"
                                            aria-label="Verified"
                                        >
                                            <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                            </svg>
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="relative max-h-[min(52vh,420px)] min-h-[200px] bg-black flex items-center justify-center">
                                {!gridPeekPost.mediaUrl ? (
                                    (() => {
                                        const tStyle = getEffectiveTextStyleForPost(gridPeekPost);
                                        const fontFamily = tStyle?.fontFamily;
                                        const sizeCls = `${getTextOnlyPreviewTextClass(tStyle?.size)} font-semibold`;
                                        return (
                                    <div
                                        className="w-full min-h-[240px] flex items-center justify-center p-6 bg-white border-y border-white/10"
                                        style={{ fontFamily: fontFamily || undefined }}
                                    >
                                        <p
                                            className={`${sizeCls} leading-relaxed whitespace-pre-wrap text-center line-clamp-8 text-black`}
                                        >
                                            {gridPeekPost.text || gridPeekPost.caption || 'Post'}
                                        </p>
                                    </div>
                                        );
                                    })()
                                ) : gridPeekPost.mediaType === 'video' ? (
                                    <>
                                        <video
                                            key={gridPeekPost.id}
                                            src={gridPeekPost.mediaUrl}
                                            className="w-full max-h-[min(52vh,420px)] object-contain grayscale contrast-[1.05]"
                                            playsInline
                                            autoPlay
                                            muted={peekVideoMuted}
                                            loop
                                        />
                                        <button
                                            type="button"
                                            data-no-peek-drag
                                            onClick={() => setPeekVideoMuted((m) => !m)}
                                            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/95 border border-black/20 flex items-center justify-center text-black hover:bg-white"
                                            aria-label={peekVideoMuted ? 'Unmute' : 'Mute'}
                                        >
                                            {peekVideoMuted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
                                        </button>
                                    </>
                                ) : (
                                    <img
                                        src={gridPeekPost.mediaUrl}
                                        alt=""
                                        className="w-full max-h-[min(52vh,420px)] object-contain grayscale contrast-[1.05]"
                                    />
                                )}
                                {(gridPeekPost.text || gridPeekPost.caption || gridPeekPost.imageText) &&
                                gridPeekPost.mediaUrl ? (
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pb-3 pt-8">
                                        <p className="text-white text-sm leading-snug line-clamp-4 font-medium">
                                            {gridPeekPost.text || gridPeekPost.caption || gridPeekPost.imageText}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                            {gridPeekPost.mediaType === 'video' ? (
                                <div className="px-3 py-2 border-t border-white/20 flex items-center justify-between bg-black">
                                    <span className="text-[11px] text-white/55 truncate pr-2">Original audio</span>
                                </div>
                            ) : null}
                        </div>

                        <div
                            className="relative z-20 rounded-[14px] overflow-hidden bg-black border border-white/25 divide-y divide-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.65)] touch-manipulation pointer-events-auto"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePeekLike();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/10 active:bg-white/[0.14] transition-colors"
                            >
                                <FiHeart
                                    className={`w-5 h-5 shrink-0 text-white ${gridPeekPost.userLiked ? 'fill-white' : ''}`}
                                    strokeWidth={gridPeekPost.userLiked ? 2.5 : 2}
                                />
                                <span className="text-[15px] font-medium text-white">Like</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePeekComment();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/10 active:bg-white/[0.14] transition-colors"
                            >
                                <FiMessageSquare className="w-5 h-5 text-white shrink-0" />
                                <span className="text-[15px] font-medium text-white">Comment</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePeekReclip();
                                }}
                                disabled={isOwnProfile}
                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/10 active:bg-white/[0.14] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <FiRepeat className="w-5 h-5 text-white shrink-0" />
                                <span className="text-[15px] font-medium text-white">Repost</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePeekShare();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/10 active:bg-white/[0.14] transition-colors"
                            >
                                <FiShare2 className="w-5 h-5 text-white shrink-0" />
                                <span className="text-[15px] font-medium text-white">Share</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePeekReport();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/10 active:bg-white/[0.14] transition-colors"
                            >
                                <FiAlertCircle className="w-5 h-5 text-white/80 shrink-0" />
                                <span className="text-[15px] font-medium text-white/90">Report</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Traveled Modal - compute places at render time with localStorage fallback so bio / Travel Info always show */}
            {showTraveledModal && (() => {
                const placesToShow = getEffectivePlacesWithStorageFallback(profileUser, user);
                return (
                <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={() => setShowTraveledModal(false)}>
                    <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Places Traveled</h2>
                            <button
                                onClick={() => setShowTraveledModal(false)}
                                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                            >
                                <FiX className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        
                        {/* Places List */}
                        <div className="p-6">
                            {placesToShow.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {placesToShow.map((place: string, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                                            onClick={() => {
                                                // Navigate to feed with this location
                                                navigate(`/feed?location=${encodeURIComponent(place)}`);
                                                setShowTraveledModal(false);
                                            }}
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <FiMapPin className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-medium">{place}</p>
                                            </div>
                                            <button
                                                className="p-2 hover:bg-gray-600 rounded-full transition-colors flex-shrink-0"
                                                title="View"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Navigate to feed with this location
                                                    navigate(`/feed?location=${encodeURIComponent(place)}`);
                                                    setShowTraveledModal(false);
                                                }}
                                            >
                                                <FiEye className="w-5 h-5 text-gray-400 hover:text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FiMapPin className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                    <p className="text-gray-400">No places traveled yet</p>
                                    <p className="text-sm text-gray-500 mt-2">Add places you've traveled to in your profile settings</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Followers / Following Modal */}
            {showConnectionsModal && (
                <div className="fixed inset-0 z-[70] bg-black/95 text-white">
                    <div className="h-full w-full max-w-2xl mx-auto flex flex-col">
                        <div className={`sticky top-0 z-10 border-b border-white/10 bg-black/90 backdrop-blur ${compactConnectionsPhone ? 'px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2.5' : 'px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <h2 className={`${compactConnectionsPhone ? 'text-base' : 'text-lg'} font-semibold`}>
                                    {connectionsScope === 'mutual'
                                        ? 'Mutual'
                                        : connectionsScope === 'suggested'
                                            ? 'Suggested'
                                            : connectionsScope === 'followers'
                                                ? 'Followers'
                                                : 'Following'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowConnectionsModal(false)}
                                    className={`${compactConnectionsPhone ? 'p-1.5' : 'p-2'} rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
                                    aria-label="Close connections"
                                >
                                    <FiX className={`${compactConnectionsPhone ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                </button>
                            </div>
                            <div className={`${compactConnectionsPhone ? 'mt-2.5' : 'mt-3'} relative`}>
                                <div className="grid grid-cols-4 items-center">
                                <button
                                    type="button"
                                    onClick={() => setConnectionsScope('mutual')}
                                    className={`${compactConnectionsPhone ? 'pb-1 text-[13px]' : 'pb-1.5 text-[15px]'} text-center font-semibold transition-[color,transform,font-size] duration-200 ${connectionsScope === 'mutual' ? `${compactConnectionsPhone ? 'text-[15px]' : 'text-[17px]'} text-white scale-[1.04]` : 'text-white/65 hover:text-white'}`}
                                >
                                    Mutual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConnectionsScope('followers')}
                                    className={`${compactConnectionsPhone ? 'pb-1 text-[13px]' : 'pb-1.5 text-[15px]'} text-center font-semibold transition-[color,transform,font-size] duration-200 ${connectionsScope === 'followers' ? `${compactConnectionsPhone ? 'text-[15px]' : 'text-[17px]'} text-white scale-[1.04]` : 'text-white/65 hover:text-white'}`}
                                >
                                    Followers
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConnectionsScope('following')}
                                    className={`${compactConnectionsPhone ? 'pb-1 text-[13px]' : 'pb-1.5 text-[15px]'} text-center font-semibold transition-[color,transform,font-size] duration-200 ${connectionsScope === 'following' ? `${compactConnectionsPhone ? 'text-[15px]' : 'text-[17px]'} text-white scale-[1.04]` : 'text-white/65 hover:text-white'}`}
                                >
                                    Following
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConnectionsScope('suggested')}
                                    className={`${compactConnectionsPhone ? 'pb-1 text-[13px]' : 'pb-1.5 text-[15px]'} text-center font-semibold transition-[color,transform,font-size] duration-200 ${connectionsScope === 'suggested' ? `${compactConnectionsPhone ? 'text-[15px]' : 'text-[17px]'} text-white scale-[1.04]` : 'text-white/65 hover:text-white'}`}
                                >
                                    Suggested
                                </button>
                                </div>
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-1/4 transition-transform duration-300"
                                    style={{
                                        transitionTimingFunction: 'cubic-bezier(0.22, 1.15, 0.32, 1)',
                                        transform: `translateX(${
                                            connectionsScope === 'mutual'
                                                ? '0%'
                                                : connectionsScope === 'followers'
                                                    ? '100%'
                                                    : connectionsScope === 'following'
                                                        ? '200%'
                                                        : '300%'
                                        })`,
                                    }}
                                >
                                    <span className="block h-full w-full rounded-full bg-white" />
                                </div>
                            </div>
                            <div className={`${compactConnectionsPhone ? 'mt-2.5 px-2.5 py-1.5' : 'mt-3 px-3 py-2'} flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04]`}>
                                <FiSearch className={`${compactConnectionsPhone ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-400`} />
                                <input
                                    value={connectionsSearch}
                                    onChange={(e) => setConnectionsSearch(e.target.value)}
                                    placeholder={`Search ${connectionsScope}`}
                                    className={`w-full bg-transparent ${compactConnectionsPhone ? 'text-xs' : 'text-sm'} text-white placeholder:text-gray-500 outline-none`}
                                />
                            </div>
                        </div>
                        <div
                            onScroll={handleConnectionsScroll}
                            className={`flex-1 overflow-y-auto ${compactConnectionsPhone ? 'px-2.5 pt-2.5' : 'px-3 pt-3'} pb-[max(16px,env(safe-area-inset-bottom))]`}
                        >
                            {connectionsLoading ? (
                                <div className="space-y-2 py-1">
                                    {Array.from({ length: compactConnectionsPhone ? 6 : 7 }).map((_, idx) => (
                                        <div
                                            key={`connections-skeleton-${idx}`}
                                            className={`animate-pulse flex items-center ${compactConnectionsPhone ? 'gap-2.5 px-2.5 py-2 rounded-lg' : 'gap-3 px-3 py-2.5 rounded-xl'} border border-white/10 bg-white/[0.03]`}
                                        >
                                            <div className={`${compactConnectionsPhone ? 'h-8 w-8' : 'h-9 w-9'} rounded-full bg-white/12`} />
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <div className={`${compactConnectionsPhone ? 'h-3 w-24' : 'h-3.5 w-28'} rounded bg-white/12`} />
                                                <div className={`${compactConnectionsPhone ? 'h-2.5 w-20' : 'h-3 w-24'} rounded bg-white/10`} />
                                            </div>
                                            <div className={`${compactConnectionsPhone ? 'h-6 w-[74px]' : 'h-7 w-[84px]'} rounded-full bg-white/12`} />
                                        </div>
                                    ))}
                                </div>
                            ) : connectionsError ? (
                                <div className="py-16 text-center text-sm text-red-300">{connectionsError}</div>
                            ) : visibleConnections.length === 0 ? (
                                <div className="py-16 text-center text-sm text-gray-500">
                                    {connectionsSearch.trim() ? 'No people match your search.' : `No ${connectionsScope} yet.`}
                                </div>
                            ) : connectionsScope === 'suggested' && !debouncedConnectionsSearch.trim() && suggestedConnectionsLayout === 'carousel' ? (
                                <div className="vp-connections-fade-in">
                                    <div className="flex items-center justify-between mb-3 px-0.5">
                                        <h3 className="text-sm font-semibold text-white tracking-tight">Suggested for you</h3>
                                        <button
                                            type="button"
                                            onClick={() => setSuggestedConnectionsLayout('list')}
                                            className="text-xs font-semibold text-white/75 hover:text-white active:opacity-80"
                                        >
                                            See all
                                        </button>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-0.5 px-0.5">
                                        {visibleConnections.map((row) => {
                                            const isOwnRow = !!user?.handle && row.handleNoAt.toLowerCase() === user.handle.toLowerCase().replace(/^@/, '');
                                            const rowFollowing = connectionFollowMap[row.handleNoAt] ?? row.isFollowing;
                                            const rowRequested = connectionRequestMap[row.handleNoAt] ?? row.isRequested;
                                            const rowActionLoading = connectionActionLoadingMap[row.handleNoAt] ?? false;
                                            const rowActionSuccess = connectionActionSuccessMap[row.handleNoAt] ?? false;
                                            const handleLabel = row.handle?.startsWith('@') ? row.handle : `@${row.handleNoAt}`;
                                            const secondaryName =
                                                row.name &&
                                                String(row.name).replace(/^@/, '').toLowerCase() !== String(row.handleNoAt).toLowerCase()
                                                    ? row.name
                                                    : null;
                                            const contextLine = (row as { suggestionReason?: string }).suggestionReason || row.bio || '';
                                            return (
                                                <div
                                                    key={row.id}
                                                    className="relative shrink-0 w-[158px] rounded-3xl border border-[#363636] bg-[#121212] px-2.5 pb-3 pt-7 shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dismissSuggestedRow(row.handleNoAt);
                                                        }}
                                                        className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full text-[#a8a8a8] hover:text-white hover:bg-white/10 transition-colors"
                                                        title="Hide suggestion"
                                                        aria-label="Hide suggestion"
                                                    >
                                                        <FiX className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowConnectionsModal(false);
                                                            navigate(`/user/${encodeURIComponent(row.handleNoAt)}`);
                                                        }}
                                                        className="w-full flex flex-col items-center text-center"
                                                    >
                                                        <div className="w-[88px] h-[88px] mx-auto mb-2 rounded-full p-[2px] bg-white/25">
                                                            <div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center">
                                                                <Avatar src={row.avatarUrl} name={row.name} size={84} />
                                                            </div>
                                                        </div>
                                                        <p className="text-[13px] font-semibold text-white truncate w-full leading-tight">{handleLabel}</p>
                                                        {secondaryName ? (
                                                            <p className="text-[12px] text-[#a8a8a8] truncate w-full mt-0.5">{secondaryName}</p>
                                                        ) : null}
                                                        {contextLine ? (
                                                            <p className="text-[11px] text-[#8e8e8e] line-clamp-2 mt-1.5 min-h-[2.25rem] leading-snug w-full">
                                                                {contextLine}
                                                            </p>
                                                        ) : null}
                                                    </button>
                                                    {!isOwnRow && (
                                                        <button
                                                            type="button"
                                                            disabled={rowActionLoading}
                                                            onClick={() => void handleConnectionFollowToggle(row)}
                                                            className={`w-full mt-2.5 py-1.5 rounded-2xl text-xs font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${rowActionSuccess ? 'ring-1 ring-white/45' : ''} ${
                                                                rowFollowing
                                                                    ? 'border border-white/20 bg-transparent text-white hover:bg-white/10'
                                                                    : rowRequested
                                                                      ? 'border border-white/25 bg-white/10 text-white/75'
                                                                      : 'bg-white text-black hover:bg-white/90 border border-white/15'
                                                            }`}
                                                        >
                                                            {rowActionLoading ? (
                                                                <span className="inline-flex items-center justify-center gap-2">
                                                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                                    <span>Saving…</span>
                                                                </span>
                                                            ) : rowFollowing ? (
                                                                'Following'
                                                            ) : rowRequested ? (
                                                                'Requested'
                                                            ) : (
                                                                'Follow'
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div key={connectionsScope} className="vp-connections-fade-in space-y-2">
                                    {connectionsScope === 'suggested' && suggestedConnectionsLayout === 'list' && !debouncedConnectionsSearch.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setSuggestedConnectionsLayout('carousel')}
                                            className="mb-1 text-xs font-semibold text-white/75 hover:text-white"
                                        >
                                            ← Card view
                                        </button>
                                    )}
                                    {visibleConnections.map((row) => {
                                        const isOwnRow = !!user?.handle && row.handleNoAt.toLowerCase() === user.handle.toLowerCase().replace(/^@/, '');
                                        const rowFollowing = connectionFollowMap[row.handleNoAt] ?? row.isFollowing;
                                        const rowRequested = connectionRequestMap[row.handleNoAt] ?? row.isRequested;
                                        const rowActionLoading = connectionActionLoadingMap[row.handleNoAt] ?? false;
                                        const rowActionSuccess = connectionActionSuccessMap[row.handleNoAt] ?? false;
                                        const connectionFollowBtnClass =
                                            connectionsScope === 'suggested'
                                                ? `${compactConnectionsPhone ? 'min-w-[78px] px-2.5 py-1 text-[11px]' : 'min-w-[88px] px-3 py-1.5 text-xs'} rounded-full font-semibold transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70 ${rowActionSuccess ? 'ring-1 ring-white/50' : ''} ${
                                                      rowFollowing
                                                          ? 'border border-white/25 bg-black text-white hover:bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)] active:shadow-none'
                                                          : rowRequested
                                                            ? 'border border-white/35 bg-white/10 text-white/85 hover:bg-white/15'
                                                            : 'bg-white text-black hover:bg-white/90 border border-white/15'
                                                  }`
                                                : `${compactConnectionsPhone ? 'min-w-[78px] px-2.5 py-1 text-[11px]' : 'min-w-[88px] px-3 py-1.5 text-xs'} rounded-full font-semibold transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70 ${rowActionSuccess ? 'ring-1 ring-cyan-300/70 shadow-[0_0_0_1px_rgba(103,232,249,0.5),0_0_16px_-8px_rgba(34,211,238,0.95)]' : ''} ${rowFollowing ? 'border border-white/25 bg-black text-white hover:bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)] active:shadow-none' : rowRequested ? 'border border-cyan-400/50 bg-cyan-500/12 text-cyan-200 hover:bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_6px_14px_-10px_rgba(34,211,238,0.5)] active:shadow-[0_0_0_1px_rgba(34,211,238,0.14)]' : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_8px_18px_-10px_rgba(34,211,238,0.55)] active:shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'}`;
                                        return (
                                            <div
                                                key={row.id}
                                                className={`flex items-center ${compactConnectionsPhone ? 'gap-2.5 px-2.5 py-2 rounded-2xl' : 'gap-3 px-3 py-2.5 rounded-3xl'} border border-white/10 bg-white/[0.03]`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowConnectionsModal(false);
                                                        navigate(`/user/${encodeURIComponent(row.handleNoAt)}`);
                                                    }}
                                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                >
                                                    <Avatar src={row.avatarUrl} name={row.name} size="md" />
                                                    <div className="min-w-0">
                                                        <p className={`truncate ${compactConnectionsPhone ? 'text-[13px]' : 'text-sm'} font-semibold text-white`}>{row.name}</p>
                                                        <p className={`truncate ${compactConnectionsPhone ? 'text-[11px]' : 'text-xs'} text-gray-400`}>{row.handle}</p>
                                                        {connectionsScope === 'suggested' && (row.mutualCount || 0) > 0 ? (
                                                            <div className="mt-0.5 flex items-center gap-1.5">
                                                                <div className={`flex ${compactConnectionsPhone ? '-space-x-1.5' : '-space-x-1.5'}`}>
                                                                    {(Array.isArray(row.mutualPreview) ? row.mutualPreview : []).map((mutual: any, index: number) => (
                                                                        <div
                                                                            key={`${mutual.id}-${index}`}
                                                                            className={`${compactConnectionsPhone ? 'h-3.5 w-3.5' : 'h-4 w-4'} overflow-hidden rounded-full border border-black/70 bg-gray-700`}
                                                                            title={mutual.handle || 'Mutual'}
                                                                        >
                                                                            {mutual.avatarUrl ? (
                                                                                <img src={mutual.avatarUrl} alt="" className="h-full w-full object-cover" />
                                                                            ) : null}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <p className={`inline-flex items-center rounded-full border border-white/20 bg-white/[0.08] ${compactConnectionsPhone ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} font-semibold text-white/85`}>
                                                                    {row.mutualCount} mutual
                                                                </p>
                                                            </div>
                                                        ) : null}
                                                        {row.bio ? (
                                                            <p className={`truncate ${compactConnectionsPhone ? 'text-[11px]' : 'text-xs'} ${connectionsScope === 'suggested' ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                {row.bio}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </button>
                                                {connectionsScope === 'suggested' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => dismissSuggestedRow(row.handleNoAt)}
                                                        className={`${compactConnectionsPhone ? 'p-1' : 'p-1.5'} rounded-full text-white/55 hover:text-white hover:bg-white/10 transition-colors`}
                                                        title="Hide suggestion"
                                                        aria-label="Hide suggestion"
                                                    >
                                                        <FiX className={`${compactConnectionsPhone ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                                                    </button>
                                                )}
                                                {!isOwnRow && (
                                                    <button
                                                        type="button"
                                                        disabled={rowActionLoading}
                                                        onClick={() => void handleConnectionFollowToggle(row)}
                                                        className={connectionFollowBtnClass}
                                                    >
                                                        {rowActionLoading ? (
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <span className={`${compactConnectionsPhone ? 'h-2.5 w-2.5' : 'h-3 w-3'} animate-spin rounded-full border-2 border-current border-t-transparent`} />
                                                                <span>Saving</span>
                                                            </span>
                                                        ) : (rowFollowing ? 'Following' : rowRequested ? 'Requested' : 'Follow')}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {!connectionsSearch.trim() && connectionsLoadingMore && (
                                <div className="py-4 text-center text-xs text-gray-500">Loading more...</div>
                            )}
                        </div>
                    </div>
                    <style>{`
                        @keyframes vpConnectionsFadeIn {
                            0% { opacity: 0; transform: translateY(4px) scale(0.995); }
                            100% { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        .vp-connections-fade-in {
                            animation: vpConnectionsFadeIn 170ms ease-out;
                        }
                    `}</style>
                    {dismissUndo && (
                        <div className={`absolute left-1/2 -translate-x-1/2 ${compactConnectionsPhone ? 'bottom-3 px-3 py-2' : 'bottom-4 px-3.5 py-2.5'} flex items-center gap-3 rounded-full border border-white/20 bg-black/85 backdrop-blur text-white shadow-[0_10px_30px_-18px_rgba(0,0,0,0.85)]`}>
                            <span className={`${compactConnectionsPhone ? 'text-[11px]' : 'text-xs'} text-white/90`}>Suggestion hidden</span>
                            <button
                                type="button"
                                onClick={handleUndoDismissSuggestion}
                                className={`${compactConnectionsPhone ? 'text-[11px]' : 'text-xs'} font-semibold text-white hover:text-white/80`}
                            >
                                Undo
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Post viewer: vertical snap-scrolling feed through all grid posts (Instagram-style) */}
            {selectedPost && filteredPosts.length > 0 && (
                <div className="fixed inset-0 z-50 flex flex-col bg-[#030712] isolate">
                    {/*
                      FeedCard PostHeader uses z-20–z-50 (avatars/menus up to z-[200]). Keep chrome above so the X stays tappable while scrolling.
                    */}
                    <button
                        type="button"
                        onClick={() => setSelectedPost(null)}
                        className="absolute top-[max(12px,env(safe-area-inset-top))] left-3 z-[250] w-10 h-10 bg-black/70 hover:bg-black/90 border border-white/15 rounded-full flex items-center justify-center transition-colors shadow-md pointer-events-auto"
                        aria-label="Close post viewer"
                    >
                        <FiX className="w-6 h-6 text-white" />
                    </button>
                    <p className="absolute top-[max(12px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[250] text-[11px] text-white/55 pointer-events-none max-w-[70%] text-center">
                        Scroll for more posts
                    </p>
                    <div
                        ref={profilePostScrollRef}
                        className="relative z-0 flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] pb-8"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        {filteredPosts.map((post, index) => {
                            const hasMedia = !!(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
                            const priorityPostsCount = filteredPosts
                                .slice(0, index + 1)
                                .filter((q) => !!(q.mediaUrl || (q.mediaItems && q.mediaItems.length > 0))).length;
                            const isPriority = hasMedia && priorityPostsCount <= 3;
                            const viewerNorm = user?.handle?.replace(/^@/, '').trim().toLowerCase() || '';
                            const authorNorm = post.userHandle.replace(/^@/, '').trim().toLowerCase();
                            const showBoostIcon = !!(user?.handle && viewerNorm === authorNorm && !post.originalUserHandle);
                            return (
                                <ProfilePostFeedSlide
                                    key={post.id}
                                    ref={(el) => {
                                        profilePostSlideRefs.current[String(post.id)] = el;
                                    }}
                                    post={post}
                                    priority={isPriority}
                                    showBoostIcon={showBoostIcon}
                                    onLike={handleProfileFeedLike}
                                    onFollow={async () => {
                                        await handleFollow();
                                    }}
                                    onShare={openProfileShare}
                                    onOpenComments={openProfileComments}
                                    onView={handleProfileFeedView}
                                    onReclip={handleProfileFeedReclip}
                                    onOpenScenes={openProfileScenes}
                                    onShareSuccess={(postId) =>
                                        mergeProfilePost(postId, (x) => ({
                                            ...x,
                                            stats: { ...x.stats, shares: x.stats.shares + 1 },
                                        }))
                                    }
                                    onOpenDM={(dmHandle) => {
                                        const h = dmHandle.replace(/^@/, '').trim();
                                        if (h) navigate(`/messages/${encodeURIComponent(h)}`);
                                    }}
                                    onBoost={
                                        showBoostIcon
                                            ? async () => {
                                                  navigate('/boost');
                                              }
                                            : undefined
                                    }
                                    onDelete={
                                        user?.handle && viewerNorm === authorNorm && !post.originalUserHandle
                                            ? async (pRow) => {
                                                  const uid = getStableUserId(user!);
                                                  const result = await Swal.fire(
                                                      bottomSheet({
                                                          title: 'Delete post?',
                                                          message: "This can't be undone.",
                                                          icon: 'alert',
                                                          showCancelButton: true,
                                                          confirmButtonText: 'Delete',
                                                          cancelButtonText: 'Cancel',
                                                      }),
                                                  );
                                                  if (!result.isConfirmed) return;
                                                  try {
                                                      await deletePost(uid, pRow.id, user?.handle);
                                                      setPosts((cur) => cur.filter((x) => x.id !== pRow.id));
                                                      setSelectedPost((cur) => (cur?.id === pRow.id ? null : cur));
                                                  } catch (err) {
                                                      await Swal.fire(
                                                          bottomSheet({
                                                              title: 'Could not delete post',
                                                              message:
                                                                  err instanceof Error ? err.message : 'Try again.',
                                                              icon: 'alert',
                                                          }),
                                                      );
                                                  }
                                              }
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {profileCommentsPostId && (
                <CommentsModal
                    postId={profileCommentsPostId}
                    isOpen={profileCommentsOpen}
                    onClose={handleCloseProfileComments}
                />
            )}

            {profileSharePost && (
                <ShareModal
                    post={profileSharePost}
                    isOpen={profileShareOpen}
                    onClose={() => {
                        setProfileShareOpen(false);
                        setProfileSharePost(null);
                    }}
                />
            )}

            {profileScenesPost && (
                <ScenesModal
                    post={profileScenesPost}
                    isOpen={profileScenesOpen}
                    initialVideoTime={profileScenesInitialTime}
                    initialMutedState={profileScenesInitialMuted}
                    posts={profileScenesFeedPosts.length > 1 ? profileScenesFeedPosts : undefined}
                    feedLabel={
                        profileUser?.handle
                            ? `@${String(profileUser.handle).replace(/^@/, '')}`
                            : decodeURIComponent(handle || '') || undefined
                    }
                    onClose={(savedTime) => {
                        const closing = profileScenesPost;
                        if (savedTime != null && closing) {
                            profileViewerVideoTimesRef.current.set(closing.id, savedTime);
                        }
                        setProfileScenesOpen(false);
                        setProfileScenesPost(null);
                        setProfileScenesInitialTime(null);
                        setProfileScenesInitialMuted(null);
                        if (closing) {
                            window.dispatchEvent(
                                new CustomEvent(`resumeVideo-${closing.id}`, { detail: { time: savedTime } }),
                            );
                        }
                    }}
                    onLike={async () => {
                        const p = profileScenesPost;
                        if (p) await handleProfileFeedLike(p);
                    }}
                    onFollow={async () => {
                        await handleFollow();
                    }}
                    onShare={async () => {
                        const p = profileScenesPost;
                        if (p) openProfileShare(p);
                    }}
                    onOpenComments={() => {
                        const p = profileScenesPost;
                        if (p) openProfileComments(p);
                    }}
                    onReclip={async () => {
                        const p = profileScenesPost;
                        if (p) await handleProfileFeedReclip(p);
                    }}
                    onBoost={
                        user?.handle &&
                        profileScenesPost.userHandle.replace(/^@/, '').toLowerCase() ===
                            user.handle.replace(/^@/, '').toLowerCase() &&
                        !profileScenesPost.originalUserHandle
                            ? () => {
                                  navigate('/boost');
                              }
                            : undefined
                    }
                    onPostChange={(newIndex, savedVideoTime) => {
                        const list = profileScenesFeedPosts;
                        const prev = profileScenesPost;
                        if (prev && savedVideoTime != null) {
                            profileViewerVideoTimesRef.current.set(prev.id, savedVideoTime);
                        }
                        const next = list[newIndex];
                        if (next) {
                            setProfileScenesPost(next);
                            setProfileScenesInitialTime(profileViewerVideoTimesRef.current.get(next.id) ?? null);
                            setProfileScenesInitialMuted(null);
                        }
                    }}
                />
            )}

            {/* Profile Menu Modal */}
            {showProfileMenu && profileUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
                        onClick={() => setShowProfileMenu(false)}
                    />

                    {/* Menu - stopPropagation so backdrop doesn't steal click */}
                    <div
                        className="relative bg-black rounded-3xl p-4 sm:p-6 shadow-2xl mx-4 max-w-full border border-white/15"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center mb-5 pb-5 border-b border-white/10">
                            <Avatar
                                src={
                                    profileUser.avatarUrl ||
                                    getAvatarForHandle(profileUser.handle || decodeURIComponent(handle || ''))
                                }
                                name={profileUser.name || profileUser.handle}
                                size="lg"
                                className="!w-[72px] !h-[72px] border-2 border-white/25 shadow-lg"
                            />
                            <div className="mt-2.5 text-center max-w-[240px]">
                                <div className="text-white font-semibold text-sm truncate">{profileUser.name}</div>
                                <div className="text-white/50 text-xs truncate">{profileUser.handle}</div>
                            </div>
                        </div>
                        <div className="flex flex-row flex-wrap gap-3 sm:gap-6 items-center justify-center">
                            {/* View Stories - only show if user has stories */}
                            {hasStory && (
                                <button
                                    onClick={() => {
                                        setShowProfileMenu(false);
                                        navigate('/stories', { state: { openUserHandle: handle } });
                                    }}
                                    className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                                >
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                        <FiPlay className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-white font-medium text-center">View Stories</span>
                                </button>
                            )}

                            {/* Follow - only show when viewing someone else's profile */}
                            {handle && user?.handle && decodeURIComponent(handle) !== user.handle && (
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await handleFollow();
                                    setShowProfileMenu(false);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiUserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">{isFollowing ? 'Unfollow' : 'Follow'}</span>
                            </button>
                            )}

                            {handle &&
                                user?.handle &&
                                decodeURIComponent(handle) !== user.handle && (
                                    <button
                                        onClick={() => {
                                            setShowProfileMenu(false);
                                            setInviteToGroupOpen(true);
                                        }}
                                        className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                                    >
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                            <FiUsers className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                        </div>
                                        <span className="text-[10px] sm:text-xs text-white font-medium text-center">Invite to group</span>
                                    </button>
                                )}

                            {/* Share Profile */}
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    setShowShareProfileModal(true);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiShare2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">Share profile</span>
                            </button>

                            {/* QR Code */}
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    setShowQRCodeModal(true);
                                }}
                                className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-0"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center">
                                    <FiMaximize className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                                </div>
                                <span className="text-[10px] sm:text-xs text-white font-medium text-center">QR code</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal for Profile */}
            {showQRCodeModal && profileUser && (
                <ProfileQRCodeModal
                    isOpen={showQRCodeModal}
                    onClose={() => setShowQRCodeModal(false)}
                    handle={handle || ''}
                    name={profileUser.name || handle || ''}
                />
            )}

            {/* Share Profile Modal */}
            {showShareProfileModal && profileUser && (
                <ShareProfileModal
                    isOpen={showShareProfileModal}
                    onClose={() => setShowShareProfileModal(false)}
                    handle={handle || ''}
                    name={profileUser.name || handle || ''}
                    avatarUrl={profileUser.avatarUrl}
                />
            )}

            <InviteToGroupModal
                isOpen={inviteToGroupOpen}
                onClose={() => setInviteToGroupOpen(false)}
                inviteeHandle={handle ? decodeURIComponent(handle) : ''}
            />
        </div>
    );
}

// Profile QR Code Modal Component
function ProfileQRCodeModal({ isOpen, onClose, handle, name }: { isOpen: boolean; onClose: () => void; handle: string; name: string }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
    const [isGenerating, setIsGenerating] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && handle) {
            setQrCodeDataUrl('');
            setIsGenerating(true);
            generateQRCode();
        } else if (!isOpen) {
            setQrCodeDataUrl('');
            setIsGenerating(false);
        }
    }, [isOpen, handle]);

    async function generateQRCode() {
        if (!handle) {
            setIsGenerating(false);
            return;
        }

        setIsGenerating(true);
        try {
            const QRCode = (await import('qrcode')).default;
            const profileUrl = `${window.location.origin}/user/${encodeURIComponent(handle)}`;
            const qrDataUrl = await QRCode.toDataURL(profileUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrCodeDataUrl(qrDataUrl);
            setIsGenerating(false);
        } catch (error) {
            console.error('Error generating QR code:', error);
            setIsGenerating(false);
        }
    }

    if (!isOpen) return null;

    const displayName = name.split('@')[0]?.toUpperCase() || 'PROFILE';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm mx-4 bg-[#262626] dark:bg-[#1a1a1a] rounded-3xl shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
                    aria-label="Close"
                >
                    <FiX className="w-5 h-5 text-white" />
                </button>

                {/* Content */}
                <div className="p-6">
                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            {qrCodeDataUrl ? (
                                <img
                                    src={qrCodeDataUrl}
                                    alt="QR Code"
                                    className="w-64 h-64 rounded-2xl"
                                />
                            ) : (
                                <div className="w-64 h-64 rounded-2xl bg-white flex flex-col items-center justify-center gap-2">
                                    {isGenerating ? (
                                        <>
                                            <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-xs text-gray-500">Generating QR code...</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500">Failed to generate QR code</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile Info */}
                    <div className="text-center mb-4">
                        <div
                            className="text-sm font-medium mb-4"
                            style={{
                                background: 'linear-gradient(90deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                color: 'transparent',
                            }}
                        >
                            @{displayName}
                        </div>
                        <p className="text-white text-sm text-gray-300 px-4">
                            People can scan this QR code with their smartphone's camera to view this profile.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-3 mt-6">
                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

