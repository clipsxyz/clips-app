import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    Alert,
    Modal,
    Clipboard,
    RefreshControl,
    Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import AccountTypeBadge from '../components/AccountTypeBadge.native';
import VerifiedBadge from '../components/VerifiedBadge.native';
import {
    glassSearch,
    glassSurface,
    gazetteerHeader,
} from '../theme/gazetteerAmbientNative';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, getFollowedUsers, setReclipState, toggleLike, reclipPost, posts as allPosts, mapLaravelProfilePosts } from '../api/posts';
import { fetchUserProfile, fetchFollowers, fetchFollowing } from '../api/client';
import { followOrRequest } from '../utils/followOrRequest';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { userHasStoriesByHandle } from '../api/stories';
import { subscribeStoriesRefresh } from '../utils/storiesRefreshNative';
import {
    isProfilePrivate,
    canViewProfile,
    hasPendingFollowRequest,
    canSendMessage,
} from '../api/privacy';
import { MOCK_FOLLOWING_GRAPH, computeMockGraphFollowCounts } from '../api/mockFollowGraph';
import { isLaravelApiEnabled, isMockMode } from '../config/runtimeEnv';
import { FEED_UI } from '../constants/feedUiTokens';
import type { Post } from '../types';
import Flag from '../components/Flag.native';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet.native';
import ProfilePostNotifyBell from '../components/ProfilePostNotifyBell.native';
import ProfilePostNotifySheet, {
    type ProfilePostNotifySheetMode,
} from '../components/ProfilePostNotifySheet.native';
import ShareProfileSheet from '../components/ShareProfileSheet.native';
import ProfileQRCodeModal from '../components/ProfileQRCodeModal.native';
import ViewProfilePostsSheet from '../components/ViewProfilePostsSheet.native';
import ProfileGridPeekSheet from '../components/ProfileGridPeekSheet.native';
import PickGroupToInviteFeedUserModal from '../components/PickGroupToInviteFeedUserModal.native';
import ViewProfileConnectionsModal, {
    type ConnectionRow,
    type ConnectionsScope,
} from '../components/ViewProfileConnectionsModal.native';
import PostCommentsSheet from '../components/PostCommentsSheet';
import FeedShareModal from '../components/FeedShareModal';
import ProfileCoverHero from '../components/ProfileCoverHero.native';
import ProfileCoverActionsModal from '../components/ProfileCoverActionsModal.native';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { getEffectivePlacesTraveled, formatProfileStatCount } from '../utils/effectivePlacesTraveled';
import { getStableUserId } from '../utils/userId';
import type { ProfilePostNotifyLevel } from '../utils/profilePostNotifyPrefs';
import { ox } from '../constants/nativeOpticalScale';
import {
    clearProfilePostNotifyForCreatorMobile,
    getProfilePostNotifyLevelMobile,
    setProfilePostNotifyLevelMobile,
} from '../utils/profilePostNotifyPrefsMobile';

export default function ViewProfileScreen({ route, navigation }: any) {
    const { handle, sourcePostId } = route.params ?? {};
    const { user } = useAuth();

    const [profileUser, setProfileUser] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [hasStory, setHasStory] = useState(false);
    const [canView, setCanView] = useState(true);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [profileIsPrivate, setProfileIsPrivate] = useState(false);
    const [stats, setStats] = useState({ following: 0, followers: 0, likes: 0, views: 0 });
    const [showTraveledModal, setShowTraveledModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showProfileQR, setShowProfileQR] = useState(false);
    const [showPostsSheet, setShowPostsSheet] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [gridPeekPost, setGridPeekPost] = useState<Post | null>(null);
    const [peekCommentsPost, setPeekCommentsPost] = useState<Post | null>(null);
    const [peekSharePost, setPeekSharePost] = useState<Post | null>(null);
    const [showInviteToGroup, setShowInviteToGroup] = useState(false);
    const [showNoPlacesAlert, setShowNoPlacesAlert] = useState(false);
    const [showFollowRequestAlert, setShowFollowRequestAlert] = useState(false);
    const [profilePostsCursor, setProfilePostsCursor] = useState<string | number | null>(null);
    const [profilePostsHasMore, setProfilePostsHasMore] = useState(false);
    const [profilePostsLoadingMore, setProfilePostsLoadingMore] = useState(false);
    const suppressGridOpenClickRef = React.useRef(false);
    const [showConnectionsModal, setShowConnectionsModal] = useState(false);
    const [connectionsScope, setConnectionsScope] = useState<ConnectionsScope>('followers');
    const [followersList, setFollowersList] = useState<ConnectionRow[]>([]);
    const [followingList, setFollowingList] = useState<ConnectionRow[]>([]);
    const [connectionsSearch, setConnectionsSearch] = useState('');
    const [connectionsLoading, setConnectionsLoading] = useState(false);
    const [connectionsLoadingMore, setConnectionsLoadingMore] = useState(false);
    const [followersCursor, setFollowersCursor] = useState<number | string | null>(0);
    const [followingCursor, setFollowingCursor] = useState<number | string | null>(0);
    const [followersHasMore, setFollowersHasMore] = useState(true);
    const [followingHasMore, setFollowingHasMore] = useState(true);
    const [viewerFollowedSet, setViewerFollowedSet] = useState<Set<string>>(new Set());
    const [connectionFollowMap, setConnectionFollowMap] = useState<Record<string, boolean>>({});
    const [connectionRequestMap, setConnectionRequestMap] = useState<Record<string, boolean>>({});
    const [connectionActionLoadingMap, setConnectionActionLoadingMap] = useState<Record<string, boolean>>({});
    const [contentTab, setContentTab] = useState<'all' | 'videos' | 'photos' | 'text'>('all');
    const [postNotifyLevel, setPostNotifyLevel] = useState<ProfilePostNotifyLevel>('off');
    const [postNotifySheetMode, setPostNotifySheetMode] = useState<ProfilePostNotifySheetMode | null>(null);
    const [showShareProfileSheet, setShowShareProfileSheet] = useState(false);
    const socialLinks = (profileUser?.socialLinks || profileUser?.social_links || {}) as Record<string, string | undefined>;
    const decodedHandle = decodeURIComponent(handle || '');
    const isOwnProfile = Boolean(user?.handle && decodedHandle === user.handle);
    const profileAccountType = (() => {
        const raw =
            profileUser?.accountType ||
            profileUser?.account_type ||
            (profileUser?.is_business || profileUser?.isBusiness ? 'business' : undefined) ||
            (isOwnProfile ? user?.accountType : undefined);
        return String(raw || '').toLowerCase() === 'business' ? 'business' : String(raw || '').toLowerCase() === 'personal' ? 'personal' : undefined;
    })();

    useEffect(() => {
        if (!user?.id || !decodedHandle || isOwnProfile) {
            setPostNotifyLevel('off');
            return;
        }
        const viewerId = user.id != null ? String(user.id) : getStableUserId(user);
        void getProfilePostNotifyLevelMobile(viewerId, decodedHandle).then(setPostNotifyLevel);
    }, [user?.id, decodedHandle, isOwnProfile]);

    const profileDisplayName = React.useMemo(() => {
        const name = typeof profileUser?.name === 'string' ? profileUser.name.trim() : '';
        if (name) return name;
        return decodedHandle.replace(/^@/, '').split('@')[0] || 'User';
    }, [profileUser?.name, decodedHandle]);

    const effectivePlaces = React.useMemo(
        () => getEffectivePlacesTraveled(profileUser, isOwnProfile ? user : undefined),
        [profileUser, user, isOwnProfile]
    );

    const applyPostNotifyLevel = (level: ProfilePostNotifyLevel) => {
        if (!user?.id || !user?.handle) return;
        const viewerId = user.id != null ? String(user.id) : getStableUserId(user);
        void setProfilePostNotifyLevelMobile(viewerId, user.handle, decodedHandle, level).then(() => {
            setPostNotifyLevel(level);
            if (level === 'all') {
                setPostNotifySheetMode('confirm');
            } else {
                setPostNotifySheetMode(null);
            }
        });
    };
    const profileCoverUrl =
        profileUser?.profileBackgroundUrl ||
        profileUser?.profile_background_url ||
        (isOwnProfile ? user?.profileBackgroundUrl : undefined);

    useEffect(() => {
        let cancelled = false;
        void loadProfile(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [handle]);

    useEffect(() => {
        if (!decodedHandle) return;
        let cancelled = false;
        const check = () => {
            void userHasStoriesByHandle(decodedHandle)
                .then((has) => {
                    if (!cancelled) setHasStory(has);
                })
                .catch(() => {
                    if (!cancelled) setHasStory(false);
                });
        };
        check();
        const unsub = subscribeStoriesRefresh(check);
        return () => {
            cancelled = true;
            unsub();
        };
    }, [decodedHandle]);

    const loadProfile = async (isCancelled?: () => boolean) => {
        if (!handle) return;
        const cancelled = () => Boolean(isCancelled?.());
        setLoading(true);
        try {
            const decodedHandle = decodeURIComponent(handle);
            const profilePrivate = isProfilePrivate(decodedHandle);
            if (!cancelled()) setProfileIsPrivate(profilePrivate);

            let followedUsers: string[] = [];
            if (user?.id && user?.handle) {
                try {
                    followedUsers = await getFollowedUsers(user.id);
                } catch {
                    followedUsers = [];
                }
                if (cancelled()) return;

                const canViewProfileState = canViewProfile(user.handle, decodedHandle, followedUsers);
                const isFollowingUser = followedUsers.some(
                    (h) => h.toLowerCase() === decodedHandle.toLowerCase(),
                );
                const hasPending = hasPendingFollowRequest(user.handle, decodedHandle);

                setCanView(canViewProfileState);
                setIsFollowing(isFollowingUser);
                setHasPendingRequest(hasPending);

                if (!canViewProfileState && profilePrivate && decodedHandle !== user.handle) {
                    setLoading(false);
                    return;
                }
            }

            let userPosts: Post[] = [];
            let profileData: any;

            if (isLaravelApiEnabled()) {
                try {
                    profileData = await fetchUserProfile(
                        decodedHandle,
                        user?.id,
                        null,
                        20,
                        typeof sourcePostId === 'string' ? sourcePostId : undefined,
                        'all',
                    );
                    if (cancelled()) return;
                    userPosts = mapLaravelProfilePosts(profileData?.posts);
                } catch (error: any) {
                    console.error('[ViewProfile] profile fetch error', {
                        name: error?.name,
                        message: error?.message,
                        status: error?.status,
                        response: error?.response,
                        mockMode: isMockMode(),
                    });
                    if (error?.status === 403 && !cancelled()) {
                        setCanView(false);
                        setProfileIsPrivate(true);
                    }
                }
            } else {
                userPosts = await fetchPostsByUser(decodedHandle, 20);
                if (cancelled()) return;
            }

            const isOwn = Boolean(user?.handle && decodedHandle === user.handle);
            const paintLocalProfile = (apiData?: any) => {
                const pt = apiData?.placesTraveled ?? apiData?.places_traveled;
                const placesTraveled =
                    Array.isArray(pt) ? pt.filter((s: unknown) => typeof s === 'string') : undefined;
                const avatarUrl =
                    apiData?.avatarUrl ||
                    apiData?.avatar_url ||
                    (isOwn ? user?.avatarUrl : undefined) ||
                    getAvatarForHandle(decodedHandle);
                const bio = apiData?.bio || (isOwn ? user?.bio : undefined);
                const socialLinks =
                    apiData?.socialLinks ||
                    apiData?.social_links ||
                    (isOwn ? user?.socialLinks : undefined);
                const aggregateViews = userPosts.reduce((sum, p) => sum + (p.stats?.views ?? 0), 0);
                const aggregateLikes = userPosts.reduce((sum, p) => sum + (p.stats?.likes ?? 0), 0);
                let followersCount = apiData?.followers_count || 0;
                let followingCount = apiData?.following_count || 0;
                if (!apiData && user?.id && decodedHandle !== user?.handle) {
                    const followsThis = followedUsers.some(
                        (h) => h.toLowerCase() === decodedHandle.toLowerCase(),
                    );
                    if (followsThis && followersCount < 1) followersCount = 1;
                }
                if (!isLaravelApiEnabled()) {
                    const mockCounts = computeMockGraphFollowCounts(
                        decodedHandle,
                        user?.handle,
                        followedUsers,
                    );
                    followersCount = Math.max(followersCount, mockCounts.followers);
                    followingCount = Math.max(followingCount, mockCounts.following);
                }

                const resolvedAccountType =
                    apiData?.accountType === 'business' ||
                    apiData?.account_type === 'business' ||
                    apiData?.is_business === true ||
                    apiData?.isBusiness === true
                        ? 'business'
                        : apiData?.accountType === 'personal' || apiData?.account_type === 'personal'
                          ? 'personal'
                          : isOwn
                            ? user?.accountType
                            : undefined;

                setProfileUser({
                    handle: decodedHandle,
                    name:
                        apiData?.name ||
                        apiData?.display_name ||
                        (isOwn ? user?.name : undefined) ||
                        decodedHandle.split('@')[0],
                    avatarUrl,
                    bio,
                    socialLinks,
                    profileBackgroundUrl:
                        apiData?.profileBackgroundUrl ||
                        apiData?.profile_background_url ||
                        (isOwn ? user?.profileBackgroundUrl : undefined),
                    placesTraveled:
                        placesTraveled && placesTraveled.length > 0 ? placesTraveled : undefined,
                    ...(apiData || {}),
                    accountType: resolvedAccountType,
                });
                setPosts(userPosts);
                const handleKey = decodedHandle.trim().toLowerCase();
                const localHandlePosts = allPosts.filter(
                    (p) => String(p.userHandle || '').trim().toLowerCase() === handleKey,
                );
                const localLikes = localHandlePosts.reduce((sum, p) => sum + (p.stats?.likes ?? 0), 0);
                const localViews = localHandlePosts.reduce((sum, p) => sum + (p.stats?.views ?? 0), 0);
                const likesFromApi =
                    apiData?.likes_count ??
                    apiData?.stats?.likes_count ??
                    apiData?.stats?.likes;
                const viewsFromApi =
                    apiData?.views_count ??
                    apiData?.stats?.views_count ??
                    apiData?.stats?.views;
                setStats({
                    following: followingCount,
                    followers: followersCount,
                    likes: Math.max(
                        Number(likesFromApi) || 0,
                        aggregateLikes,
                        localLikes,
                    ),
                    views: Math.max(
                        Number(viewsFromApi) || 0,
                        aggregateViews,
                        localViews,
                    ),
                });
                setProfilePostsCursor(apiData?.postsNextCursor ?? null);
                setProfilePostsHasMore(Boolean(apiData?.postsHasMore) || userPosts.length >= 20);
            };

            paintLocalProfile(profileData);
            if (!cancelled()) setLoading(false);

            void userHasStoriesByHandle(decodedHandle)
                .then((has) => {
                    if (!cancelled()) setHasStory(has);
                })
                .catch((err) => {
                    console.error('[ViewProfile] stories lookup failed', err);
                    if (!cancelled()) setHasStory(false);
                });
        } catch (error) {
            console.error('Error loading profile:', error);
            if (!cancelled()) {
                // Still show a usable shell from the handle — never block behind a hard error alert.
                const decodedHandle = decodeURIComponent(handle);
                setProfileUser((prev: any) =>
                    prev || {
                        handle: decodedHandle,
                        name: decodedHandle.split('@')[0],
                        avatarUrl: getAvatarForHandle(decodedHandle),
                    },
                );
                setLoading(false);
            }
        }
    };

    const handleFollow = async () => {
        if (!user?.id || !handle) {
            Alert.alert('Error', 'Unable to follow user. Please try again.');
            return;
        }
        if (!user?.handle) {
            Alert.alert('Error', 'Unable to send follow request. Please sign in with a full profile.');
            return;
        }

        const decodedHandle = decodeURIComponent(handle);
        const handleToUse = profileUser?.handle || decodedHandle;
        const wasFollowingBeforeClick = isFollowing;
        const followUserId = user?.id != null ? String(user.id) : getStableUserId(user);

        try {
            // Requested → cancel; Following → unfollow; else → follow/request.
            const nextFollowing = hasPendingRequest
                ? false
                : !wasFollowingBeforeClick;
            const wasRequested = hasPendingRequest;
            const result = await followOrRequest({
                userId: followUserId,
                targetHandle: handleToUse,
                viewerHandle: user.handle,
                nextFollowing,
            });
            setIsFollowing(result.following);
            setHasPendingRequest(result.requested);
            if (result.requested && !wasRequested) {
                setShowFollowRequestAlert(true);
            }
            if (!result.following && !result.requested && wasFollowingBeforeClick) {
                void clearProfilePostNotifyForCreatorMobile(followUserId, user.handle, handleToUse);
                setPostNotifyLevel('off');
                setPostNotifySheetMode(null);
                setStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
                setCanView(canViewProfile(user.handle, handleToUse, await getFollowedUsers(followUserId)));
            } else if (result.following && !wasFollowingBeforeClick) {
                setStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
                setCanView(true);
            } else if (result.requested) {
                setCanView(false);
            }
        } catch (error: any) {
            console.error('Error toggling follow:', error);
            Alert.alert('Error', error?.message || 'Failed to follow user.');
        }
    };

    const handleStoryPress = () => {
        navigation.navigate('Stories', { openUserHandle: handle });
    };

    const openExternalLink = async (rawUrl?: string) => {
        const value = String(rawUrl || '').trim();
        if (!value) return;
        const url = value.startsWith('http') ? value : `https://${value}`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Invalid link', 'Could not open this link.');
        }
    };

    const normalizeConnectionItems = (items: any[]): ConnectionRow[] => {
        return (Array.isArray(items) ? items : [])
            .map((item: any) => {
                const handleRaw = String(item?.handle || item?.userHandle || item?.username || item?.name || '').replace(/^@/, '').trim();
                if (!handleRaw) return null;
                return {
                    handleNoAt: handleRaw,
                    displayName: String(item?.display_name || item?.displayName || item?.name || handleRaw),
                    avatarUrl: typeof item?.avatar_url === 'string' ? item.avatar_url : item?.avatarUrl,
                    isRequested: !!(item?.is_requested || item?.has_pending_request || item?.isRequested),
                    isPrivate: !!(item?.isPrivate || item?.is_private) || isProfilePrivate(handleRaw),
                };
            })
            .filter(Boolean) as ConnectionRow[];
    };

    const normalizeHandleKey = (value: string) => value.replace(/^@/, '').trim().toLowerCase();

    const buildMockConnectionsForTab = async (
        tab: 'followers' | 'following',
        targetHandle: string,
        followedSet: Set<string>,
    ): Promise<ConnectionRow[]> => {
        const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
        const viewerFollows = await getFollowedUsers(viewerId);
        const viewerFollowsSet = new Set(
            (Array.isArray(viewerFollows) ? viewerFollows : []).map((entry) => normalizeHandleKey(String(entry))),
        );
        const normalizedTarget = normalizeHandleKey(targetHandle);
        const out: ConnectionRow[] = [];
        const pushRow = (rawHandle: string, rawName?: string, avatarUrl?: string) => {
            const handleNoAt = String(rawHandle || '').replace(/^@/, '');
            if (!handleNoAt) return;
            const normalized = normalizeHandleKey(handleNoAt);
            if (out.some((row) => normalizeHandleKey(row.handleNoAt) === normalized)) return;
            out.push({
                handleNoAt,
                displayName: rawName || handleNoAt,
                avatarUrl: avatarUrl || getAvatarForHandle(handleNoAt) || undefined,
                isPrivate: isProfilePrivate(handleNoAt),
                isRequested: !!(user?.handle && hasPendingFollowRequest(user.handle, handleNoAt)),
            });
        };

        if (tab === 'followers') {
            Object.entries(MOCK_FOLLOWING_GRAPH).forEach(([followerHandle, followingList]) => {
                const followsTarget = (followingList || []).some(
                    (entry) => normalizeHandleKey(entry) === normalizedTarget,
                );
                if (!followsTarget) return;
                const profilePost = allPosts.find(
                    (p) => normalizeHandleKey(p.userHandle || '') === normalizeHandleKey(followerHandle),
                );
                pushRow(
                    followerHandle,
                    profilePost?.userHandle || followerHandle,
                    getAvatarForHandle(followerHandle) || '',
                );
            });
            if (user?.handle && viewerFollowsSet.has(normalizedTarget)) {
                pushRow(user.handle, user.name || user.handle, user.avatarUrl || '');
            }
        } else {
            const graphEntry = Object.entries(MOCK_FOLLOWING_GRAPH).find(
                ([k]) => normalizeHandleKey(k) === normalizedTarget,
            );
            const mockFollowing = graphEntry ? graphEntry[1] : [];
            mockFollowing.forEach((h) => {
                const handleNoAt = String(h || '').replace(/^@/, '');
                const profilePost = allPosts.find(
                    (p) => normalizeHandleKey(p.userHandle || '') === normalizeHandleKey(handleNoAt),
                );
                pushRow(handleNoAt, profilePost?.userHandle || handleNoAt, getAvatarForHandle(handleNoAt) || '');
            });
            if (user?.handle && normalizeHandleKey(user.handle) === normalizedTarget) {
                viewerFollows.forEach((h) => {
                    const handleNoAt = String(h || '').replace(/^@/, '');
                    pushRow(handleNoAt, handleNoAt, getAvatarForHandle(handleNoAt) || '');
                });
            }
        }
        return out;
    };

    const loadConnections = async (tab: 'followers' | 'following', reset = true) => {
        if (!handle) return;
        const decodedHandle = decodeURIComponent(handle);
        if (reset) setConnectionsLoading(true);
        else setConnectionsLoadingMore(true);
        try {
            const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
            const followedUsers = await getFollowedUsers(viewerId);
            const followedSet = new Set(
                (Array.isArray(followedUsers) ? followedUsers : []).map((h) => normalizeHandleKey(String(h))),
            );
            setViewerFollowedSet(followedSet);

            if (!isLaravelApiEnabled()) {
                const normalized = await buildMockConnectionsForTab(tab, decodedHandle, followedSet);
                const followPatch: Record<string, boolean> = {};
                const requestPatch: Record<string, boolean> = {};
                normalized.forEach((entry) => {
                    followPatch[entry.handleNoAt] = followedSet.has(normalizeHandleKey(entry.handleNoAt));
                    requestPatch[entry.handleNoAt] = !!entry.isRequested;
                });
                setConnectionFollowMap((prev) => ({ ...prev, ...followPatch }));
                setConnectionRequestMap((prev) => ({ ...prev, ...requestPatch }));
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

            const cursor = tab === 'followers' ? (reset ? 0 : followersCursor) : (reset ? 0 : followingCursor);
            const response = tab === 'followers'
                ? await fetchFollowers(decodedHandle, cursor, 40)
                : await fetchFollowing(decodedHandle, cursor, 40);
            const normalized = normalizeConnectionItems(Array.isArray(response?.items) ? response.items : []);
            const followPatch: Record<string, boolean> = {};
            const requestPatch: Record<string, boolean> = {};
            normalized.forEach((entry) => {
                followPatch[entry.handleNoAt] = followedSet.has(normalizeHandleKey(entry.handleNoAt));
                requestPatch[entry.handleNoAt] = !!entry.isRequested;
            });
            setConnectionFollowMap((prev) => ({ ...prev, ...followPatch }));
            setConnectionRequestMap((prev) => ({ ...prev, ...requestPatch }));
            const hasMore = !!response?.hasMore || response?.nextCursor != null;
            const nextCursor = response?.nextCursor != null
                ? response.nextCursor
                : (typeof cursor === 'number' && hasMore ? cursor + 1 : null);
            if (tab === 'followers') {
                setFollowersList((prev) => {
                    if (reset) return normalized;
                    const merged = [...prev, ...normalized];
                    const dedup = new Map<string, ConnectionRow>();
                    merged.forEach((row) => dedup.set(normalizeHandleKey(row.handleNoAt), row));
                    return Array.from(dedup.values());
                });
                setFollowersHasMore(hasMore);
                setFollowersCursor(nextCursor);
            } else {
                setFollowingList((prev) => {
                    if (reset) return normalized;
                    const merged = [...prev, ...normalized];
                    const dedup = new Map<string, ConnectionRow>();
                    merged.forEach((row) => dedup.set(normalizeHandleKey(row.handleNoAt), row));
                    return Array.from(dedup.values());
                });
                setFollowingHasMore(hasMore);
                setFollowingCursor(nextCursor);
            }
        } catch (error: any) {
            console.error('Failed to load connections:', error);
            const message = String(error?.message || '');
            const isConnectionError =
                message === 'CONNECTION_REFUSED' ||
                error?.name === 'ConnectionRefused' ||
                message.includes('Failed to fetch');
            if (isConnectionError || reset) {
                try {
                    const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
                    const followedUsers = await getFollowedUsers(viewerId);
                    const followedSet = new Set(
                        (Array.isArray(followedUsers) ? followedUsers : []).map((h) => normalizeHandleKey(String(h))),
                    );
                    const normalized = await buildMockConnectionsForTab(tab, decodedHandle, followedSet);
                    if (tab === 'followers') {
                        setFollowersList(normalized);
                        setFollowersHasMore(false);
                        setStats((prev) => ({ ...prev, followers: normalized.length }));
                    } else {
                        setFollowingList(normalized);
                        setFollowingHasMore(false);
                        setStats((prev) => ({ ...prev, following: normalized.length }));
                    }
                } catch {
                    if (reset) {
                        if (tab === 'followers') setFollowersList([]);
                        if (tab === 'following') setFollowingList([]);
                    }
                }
            }
        } finally {
            if (reset) setConnectionsLoading(false);
            else setConnectionsLoadingMore(false);
        }
    };

    const openConnections = (scope: ConnectionsScope) => {
        setConnectionsScope(scope);
        setShowConnectionsModal(true);
        setConnectionsSearch('');
        setFollowersCursor(0);
        setFollowingCursor(0);
        setFollowersHasMore(true);
        setFollowingHasMore(true);
        void Promise.all([loadConnections('followers', true), loadConnections('following', true)]);
    };

    const filteredPosts = posts.filter((p) => {
        if (contentTab === 'videos') return isVideoPost(p);
        if (contentTab === 'photos') return !!p.mediaUrl && !isVideoPost(p);
        if (contentTab === 'text') return isTextOnlyPost(p);
        return true;
    });

    // Instagram-style mutuals: people the profile follows that the viewer also follows.
    const mutualList = React.useMemo(
        () => followingList.filter((entry) => viewerFollowedSet.has(normalizeHandleKey(entry.handleNoAt))),
        [followingList, viewerFollowedSet],
    );

    const suggestedList = React.useMemo(() => {
        const excluded = new Set<string>([
            normalizeHandleKey(String(user?.handle || '')),
            normalizeHandleKey(decodedHandle),
            ...Array.from(viewerFollowedSet),
        ]);
        const profileLabel = decodedHandle ? `@${decodedHandle.replace(/^@/, '')}` : 'this profile';
        const followerMap = new Map(followersList.map((row) => [normalizeHandleKey(row.handleNoAt), row]));
        const followingMap = new Map(followingList.map((row) => [normalizeHandleKey(row.handleNoAt), row]));
        const suggestedMap = new Map<string, ConnectionRow>();

        const addSuggested = (rawHandle: string, rawName?: string, reason?: string) => {
            const key = String(rawHandle || '').replace(/^@/, '').trim();
            if (!key) return;
            const normalized = normalizeHandleKey(key);
            if (excluded.has(normalized) || suggestedMap.has(normalized)) return;
            const inFollowers = followerMap.has(normalized);
            const inFollowing = followingMap.has(normalized);
            const suggestionReason =
                reason ||
                (inFollowing
                    ? `Followed by ${profileLabel}`
                    : inFollowers
                      ? `Follows ${profileLabel}`
                      : 'Suggested for you');
            suggestedMap.set(normalized, {
                handleNoAt: key,
                displayName: rawName || key,
                avatarUrl:
                    followerMap.get(normalized)?.avatarUrl ||
                    followingMap.get(normalized)?.avatarUrl ||
                    getAvatarForHandle(key),
                suggestionReason,
                mutualCount: (inFollowers ? 1 : 0) + (inFollowing ? 1 : 0),
                isPrivate: isProfilePrivate(key),
                isRequested: !!(user?.handle && hasPendingFollowRequest(user.handle, key)),
            });
        };

        [...followersList, ...followingList].forEach((row) => {
            if (viewerFollowedSet.has(normalizeHandleKey(row.handleNoAt))) return;
            addSuggested(row.handleNoAt, row.displayName);
        });
        allPosts.forEach((post) => {
            addSuggested(post.userHandle, post.userHandle);
        });
        Object.keys(MOCK_FOLLOWING_GRAPH).forEach((h) => addSuggested(h, h));

        return Array.from(suggestedMap.values()).sort(
            (a, b) => (b.mutualCount || 0) - (a.mutualCount || 0),
        );
    }, [followersList, followingList, viewerFollowedSet, user?.handle, decodedHandle]);

    const activeConnectionsList =
        connectionsScope === 'followers'
            ? followersList
            : connectionsScope === 'following'
                ? followingList
                : connectionsScope === 'mutual'
                    ? mutualList
                    : suggestedList;

    const searchedConnections = activeConnectionsList.filter((entry) => {
        const q = connectionsSearch.trim().toLowerCase();
        if (!q) return true;
        return entry.handleNoAt.toLowerCase().includes(q) || entry.displayName.toLowerCase().includes(q);
    });

    const toggleConnectionFollow = async (entryHandle: string) => {
        if (!user?.id || !user?.handle) return;
        if (connectionActionLoadingMap[entryHandle]) return;
        const followUserId = user.id != null ? String(user.id) : getStableUserId(user);
        const key = entryHandle;
        const current = connectionFollowMap[key] === true;
        const requested = connectionRequestMap[key] === true;

        setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: true }));
        try {
            if (!current && requested) {
                // Second tap on Requested cancels the local pending request.
                const result = await followOrRequest({
                    userId: followUserId,
                    targetHandle: key,
                    viewerHandle: user.handle,
                    nextFollowing: false,
                });
                setConnectionFollowMap((prev) => ({ ...prev, [key]: result.following }));
                setConnectionRequestMap((prev) => ({ ...prev, [key]: false }));
                return;
            }

            const result = await followOrRequest({
                userId: followUserId,
                targetHandle: key,
                viewerHandle: user.handle,
                nextFollowing: !current,
            });
            setConnectionFollowMap((prev) => ({ ...prev, [key]: result.following }));
            setConnectionRequestMap((prev) => ({ ...prev, [key]: result.requested }));
            const nextSet = new Set(viewerFollowedSet);
            const norm = normalizeHandleKey(key);
            if (result.following) nextSet.add(norm);
            else nextSet.delete(norm);
            setViewerFollowedSet(nextSet);
        } catch (error) {
            console.error('Failed to toggle connection follow:', error);
            setConnectionFollowMap((prev) => ({ ...prev, [key]: current }));
            setConnectionRequestMap((prev) => ({ ...prev, [key]: requested }));
        } finally {
            setConnectionActionLoadingMap((prev) => ({ ...prev, [key]: false }));
        }
    };

    const onSelectPost = (item: Post) => {
        if (suppressGridOpenClickRef.current) {
            suppressGridOpenClickRef.current = false;
            return;
        }
        setSelectedPostId(item.id);
        setShowPostsSheet(true);
    };

    const openGridPeek = (post: Post) => {
        suppressGridOpenClickRef.current = true;
        setGridPeekPost(post);
    };

    const closeGridPeek = () => {
        setGridPeekPost(null);
        setTimeout(() => {
            suppressGridOpenClickRef.current = false;
        }, 50);
    };

    const syncPeekPost = (updated: Post) => {
        applyPostLikeUpdate(updated);
        setGridPeekPost((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    };

    const applyPostLikeUpdate = (updated: Post) => {
        setPosts((prev) => {
            const current = prev.find((p) => String(p.id) === String(updated.id));
            const next = prev.map((p) =>
                String(p.id) === String(updated.id) ? { ...p, ...updated, stats: { ...p.stats, ...updated.stats } } : p,
            );
            const wasLiked = current?.userLiked === true;
            const nowLiked = updated.userLiked === true;
            const delta = wasLiked === nowLiked ? 0 : nowLiked ? 1 : -1;
            if (delta !== 0) {
                setStats((st) => ({ ...st, likes: Math.max(0, st.likes + delta) }));
            } else {
                const sum = next.reduce((acc, p) => acc + (p.stats?.likes ?? 0), 0);
                setStats((st) => ({ ...st, likes: Math.max(st.likes, sum) }));
            }
            return next;
        });
    };

    const handlePeekLike = async () => {
        if (!gridPeekPost || !user?.id) return;
        const updated = await toggleLike(user.id, gridPeekPost.id, gridPeekPost);
        syncPeekPost(updated);
    };

    const handlePeekComment = () => {
        if (!gridPeekPost) return;
        const post = gridPeekPost;
        closeGridPeek();
        setPeekCommentsPost(post);
    };

    const handlePeekReclip = async () => {
        if (!gridPeekPost || !user?.id || !user?.handle || isOwnProfile) return;
        const norm = (h?: string) => String(h || '').trim().toLowerCase();
        if (norm(gridPeekPost.userHandle) === norm(user.handle)) {
            Alert.alert('Cannot reclip', 'You cannot reclip your own post.');
            return;
        }
        try {
            setReclipState(String(user.id), gridPeekPost.id, true);
            const result = await reclipPost(user.id, gridPeekPost.id, user.handle);
            if (result.originalPost) syncPeekPost(result.originalPost);
            closeGridPeek();
            Alert.alert('Reposted', 'Post added to your Following feed and profile.');
        } catch (error: any) {
            console.error('Reclip failed:', error);
            setReclipState(String(user.id), gridPeekPost.id, false);
            Alert.alert('Could not repost', error?.message || 'Please try again.');
        }
    };

    const handlePeekShare = () => {
        if (!gridPeekPost) return;
        const post = gridPeekPost;
        closeGridPeek();
        setPeekSharePost(post);
    };

    const handlePeekReport = () => {
        if (!gridPeekPost) return;
        Alert.alert('Report this post?', 'Our team will review it.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Report',
                style: 'destructive',
                onPress: () => {
                    Alert.alert("Thanks — we'll review it.");
                    closeGridPeek();
                },
            },
        ]);
    };

    const loadMoreProfilePosts = async () => {
        if (!handle || profilePostsLoadingMore) return;
        const decoded = decodeURIComponent(handle);
        if (profilePostsHasMore && profilePostsCursor != null) {
            setProfilePostsLoadingMore(true);
            try {
                const nextProfile = await fetchUserProfile(decoded, user?.id, profilePostsCursor, 20, undefined, 'all');
                const appended = mapLaravelProfilePosts(nextProfile?.posts);
                if (appended.length > 0) {
                    setPosts((prev) => {
                        const seen = new Set(prev.map((p) => String(p.id)));
                        return [...prev, ...appended.filter((p) => !seen.has(String(p.id)))];
                    });
                }
                setProfilePostsCursor((nextProfile as any)?.postsNextCursor ?? null);
                setProfilePostsHasMore(Boolean((nextProfile as any)?.postsHasMore));
            } catch (error) {
                console.error('Error loading more profile posts:', error);
            } finally {
                setProfilePostsLoadingMore(false);
            }
            return;
        }

        setProfilePostsLoadingMore(true);
        try {
            const nextLimit = posts.length + 20;
            const nextPosts = await fetchPostsByUser(decoded, nextLimit);
            setPosts(nextPosts);
            setProfilePostsHasMore(nextPosts.length > posts.length);
        } catch (error) {
            console.error('Error loading more mock profile posts:', error);
        } finally {
            setProfilePostsLoadingMore(false);
        }
    };

    const handlePlacesPress = () => {
        if (effectivePlaces.length === 0) {
            setShowNoPlacesAlert(true);
            return;
        }
        setShowTraveledModal(true);
    };

    if (loading) {
        return (
            <GazetteerScreenShell ambientVariant="passport">
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.headerIconBtn}
                        accessibilityLabel="Go back"
                    >
                        <Icon name="chevron-back" size={ox(22)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerName} numberOfLines={1}>
                            Profile
                        </Text>
                    </View>
                    <View style={styles.headerIconBtnPlaceholder} />
                </View>
                <View style={styles.loadingShell}>
                    <ActivityIndicator size="large" color="#3d9b8f" />
                </View>
            </GazetteerScreenShell>
        );
    }

    if (!canView && profileIsPrivate) {
        return (
            <GazetteerScreenShell ambientVariant="passport">
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.headerIconBtn}
                        accessibilityLabel="Go back"
                    >
                        <Icon name="chevron-back" size={ox(22)} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerName} numberOfLines={1}>
                            {profileDisplayName}
                        </Text>
                        <Text style={styles.headerHandle} numberOfLines={1}>
                            {profileUser?.handle || decodedHandle}
                        </Text>
                    </View>
                    <View style={styles.headerIconBtnPlaceholder} />
                </View>
                <View style={styles.privateContainer}>
                    <Icon name="lock-closed" size={ox(64)} color="#9CA3AF" />
                    <Text style={styles.privateText}>This Account is Private</Text>
                    <Text style={styles.privateSubtext}>
                        To view this user's profile you must be following them.
                    </Text>
                    {!hasPendingRequest ? (
                        <TouchableOpacity
                            onPress={handleFollow}
                            style={[styles.followButton, styles.privateFollowButton]}
                        >
                            <Text style={styles.privateFollowButtonText}>Follow</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.privatePendingText}>Follow request sent</Text>
                    )}
                </View>
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell ambientVariant="passport">
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerIconBtn}
                    accessibilityLabel="Go back"
                >
                    <Icon name="chevron-back" size={ox(22)} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerName} numberOfLines={1}>
                        {profileDisplayName}
                    </Text>
                    <Text style={styles.headerHandle} numberOfLines={1}>
                        {profileUser?.handle || decodedHandle}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowShareProfileSheet(true)}
                    style={styles.headerIconBtn}
                    accessibilityLabel="Share profile"
                >
                    <Icon name="share-outline" size={ox(18)} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                stickyHeaderIndices={[6]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.passportTitleBlock}>
                    <Text style={styles.passportTitle}>Passport</Text>
                    <Text style={styles.passportEyebrow}>
                        {profileAccountType === 'business' ? 'Business profile' : 'Profile'}
                    </Text>
                </View>

                <ProfileCoverHero
                    coverUrl={profileCoverUrl}
                    avatarUrl={profileUser?.avatarUrl || getAvatarForHandle(decodedHandle)}
                    name={profileDisplayName}
                    hasStory={hasStory}
                    onAvatarPress={() => {
                        if (hasStory) handleStoryPress();
                        else setShowProfileMenu(true);
                    }}
                    showChangeCover={isOwnProfile}
                    onPressChangeCover={() => navigation.navigate('ProfileCover')}
                >
                    <View style={styles.coverIdentity}>
                        <Text style={styles.coverDisplayName} numberOfLines={1}>
                            {profileDisplayName}
                        </Text>
                        <View style={styles.coverHandleRow}>
                            <Text style={styles.coverHandle} numberOfLines={1}>
                                {profileUser?.handle || decodedHandle}
                            </Text>
                            <VerifiedBadge accountType={profileAccountType} size={ox(15)} />
                        </View>
                        {profileAccountType === 'business' ? (
                            <View style={styles.coverBadgeWrap}>
                                <AccountTypeBadge accountType="business" compact />
                            </View>
                        ) : null}
                        {(isOwnProfile
                            ? user?.countryFlag
                            : getFlagForHandle(profileUser?.handle || decodedHandle)) ? (
                            <View style={styles.coverFlagRow}>
                                <Flag
                                    value={
                                        isOwnProfile
                                            ? user?.countryFlag || ''
                                            : getFlagForHandle(profileUser?.handle || decodedHandle) || ''
                                    }
                                    size={ox(18)}
                                />
                                <Text style={styles.coverFlagLabel}>Country</Text>
                            </View>
                        ) : null}
                    </View>
                </ProfileCoverHero>

                <View style={styles.profileHeader}>
                    <View style={styles.statsContainer}>
                        <TouchableOpacity style={styles.statItem} onPress={() => openConnections('following')}>
                            <Text style={styles.statNumber}>{formatProfileStatCount(stats.following)}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statItem} onPress={() => openConnections('followers')}>
                            <Text style={styles.statNumber}>{formatProfileStatCount(stats.followers)}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{formatProfileStatCount(stats.views)}</Text>
                            <Text style={styles.statLabel}>Views</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{formatProfileStatCount(stats.likes)}</Text>
                            <Text style={styles.statLabel}>Likes</Text>
                        </View>
                    </View>
                </View>

                {/* Following | Message | Notify */}
                {!isOwnProfile ? (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={handleFollow} style={styles.followButton}>
                            <Text style={styles.followButtonText}>
                                {hasPendingRequest ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={async () => {
                                if (!user?.handle || !handle) return;
                                const decoded = decodeURIComponent(handle);
                                const followedUsers = await getFollowedUsers(user.id);
                                if (!canSendMessage(user.handle, decoded, followedUsers)) {
                                    Alert.alert('Cannot Message', 'You must follow this user to send a message.');
                                    return;
                                }
                                navigation.navigate('Messages', { handle: decoded });
                            }}
                        >
                            <Text style={styles.messageButtonText}>Message</Text>
                        </TouchableOpacity>
                        {isFollowing && !hasPendingRequest ? (
                            <TouchableOpacity
                                style={[
                                    styles.postNotifyButton,
                                    postNotifyLevel === 'all' && styles.postNotifyButtonActive,
                                ]}
                                onPress={() => setPostNotifySheetMode('menu')}
                                accessibilityLabel="Post notifications"
                            >
                                <ProfilePostNotifyBell
                                    active={postNotifyLevel === 'all'}
                                    activeColor={PASSPORT_PALETTE.wavePrimary}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : (
                    <View />
                )}

                <View style={styles.secondaryActions}>
                    <TouchableOpacity onPress={handlePlacesPress} style={styles.secondaryActionBtn}>
                        <Icon name="location" size={ox(18)} color="#FFFFFF" />
                        <Text style={styles.secondaryActionText}>Places</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => setShowShareProfileSheet(true)}
                    >
                        <Icon name="share-social" size={ox(18)} color="#FFFFFF" />
                        <Text style={styles.secondaryActionText}>Share</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.userInfo}>
                    {profileUser?.bio ? (
                        <View style={styles.bioBox}>
                            <Text style={styles.bio}>{profileUser.bio}</Text>
                        </View>
                    ) : (
                        <View style={[styles.bioBox, styles.bioBoxEmpty]}>
                            <Text style={styles.bioPlaceholder}>No bio yet</Text>
                        </View>
                    )}
                    {(socialLinks.website ||
                        socialLinks.x ||
                        socialLinks.instagram ||
                        socialLinks.tiktok ||
                        socialLinks.podcast) && (
                        <View style={styles.socialLinksRow}>
                            {socialLinks.website ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() => void openExternalLink(socialLinks.website)}
                                    accessibilityLabel="Website"
                                >
                                    <Icon name="link-outline" size={ox(20)} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                            {socialLinks.x ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() =>
                                        void openExternalLink(
                                            `https://twitter.com/${String(socialLinks.x).replace('@', '')}`,
                                        )
                                    }
                                    accessibilityLabel="X"
                                >
                                    <Text style={styles.socialXGlyph}>𝕏</Text>
                                </TouchableOpacity>
                            ) : null}
                            {socialLinks.instagram ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() =>
                                        void openExternalLink(
                                            `https://instagram.com/${String(socialLinks.instagram).replace('@', '')}`,
                                        )
                                    }
                                    accessibilityLabel="Instagram"
                                >
                                    <Icon name="logo-instagram" size={ox(20)} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                            {socialLinks.tiktok ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() =>
                                        void openExternalLink(
                                            `https://tiktok.com/@${String(socialLinks.tiktok).replace('@', '')}`,
                                        )
                                    }
                                    accessibilityLabel="TikTok"
                                >
                                    <Icon name="logo-tiktok" size={ox(20)} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                            {socialLinks.podcast ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() => void openExternalLink(socialLinks.podcast)}
                                    accessibilityLabel="Podcast"
                                >
                                    <Icon name="mic-outline" size={ox(20)} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}
                </View>

                <View style={styles.contentTabsWrap}>
                    <View style={styles.contentTabsRow}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'videos', label: 'Videos' },
                            { id: 'photos', label: 'Photos' },
                            { id: 'text', label: 'Text' },
                        ].map((tab) => {
                            const active = contentTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.contentTabButton, active && styles.contentTabButtonActive]}
                                    onPress={() => setContentTab(tab.id as 'all' | 'videos' | 'photos' | 'text')}
                                    activeOpacity={0.9}
                                >
                                    <Text style={[styles.contentTabText, active && styles.contentTabTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.postsContainer}>
                    {filteredPosts.length === 0 ? (
                        <View style={styles.emptyGrid}>
                            <Text style={styles.emptyGridTitle}>
                                {contentTab === 'all' ? 'No posts yet' : `No ${contentTab} yet`}
                            </Text>
                            <Text style={styles.emptyGridSubtext}>
                                {contentTab === 'all'
                                    ? "When this user posts, you'll see them here."
                                    : 'Switch tabs to view other content.'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.postsGrid}>
                            {filteredPosts.map((item) => (
                                <Pressable
                                    key={item.id}
                                    onPress={() => onSelectPost(item)}
                                    onLongPress={() => openGridPeek(item)}
                                    delayLongPress={450}
                                    style={{
                                        width: '33.33%',
                                        height: 120,
                                        overflow: 'hidden',
                                        borderRadius: 8,
                                        position: 'relative',
                                        padding: FEED_UI.spacing.hairlineGap,
                                    }}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            overflow: 'hidden',
                                            borderRadius: 8,
                                            position: 'relative',
                                        }}
                                        pointerEvents="none"
                                    >
                                        <ProfileGridThumb post={item} />
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}
                    {contentTab === 'all' && (profilePostsHasMore || posts.length >= 20) ? (
                        <TouchableOpacity
                            style={styles.loadMoreGridBtn}
                            onPress={() => void loadMoreProfilePosts()}
                            disabled={profilePostsLoadingMore}
                        >
                            {profilePostsLoadingMore ? (
                                <ActivityIndicator size="small" color="#3d9b8f" />
                            ) : (
                                <Text style={styles.loadMoreGridBtnText}>Load more posts</Text>
                            )}
                        </TouchableOpacity>
                    ) : null}
                </View>
            </ScrollView>

            {/* Traveled Modal */}
            <Modal
                visible={showTraveledModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTraveledModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Places Traveled</Text>
                            <TouchableOpacity onPress={() => setShowTraveledModal(false)}>
                                <Icon name="close" size={ox(24)} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.modalBody}
                            refreshControl={
                                <RefreshControl
                                    refreshing={loading}
                                    onRefresh={() => {
                                        void loadProfile();
                                    }}
                                    tintColor="#3d9b8f"
                                />
                            }
                        >
                            {effectivePlaces.length > 0 ? (
                                effectivePlaces.map((place: string, index: number) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.placeItem}
                                        onPress={() => {
                                            setShowTraveledModal(false);
                                            navigation.navigate('Feed', { location: place });
                                        }}
                                    >
                                        <View style={styles.placeIcon}>
                                            <Icon name="location" size={ox(20)} color="#FFFFFF" />
                                        </View>
                                        <Text style={styles.placeName}>{place}</Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowTraveledModal(false);
                                                navigation.navigate('Feed', { location: place });
                                            }}
                                        >
                                            <Icon name="eye" size={ox(20)} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>
                                    {isOwnProfile
                                        ? 'Add places in your profile settings under Travel Info or your bio.'
                                        : 'No places traveled yet.'}
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ProfileCoverActionsModal
                visible={showProfileMenu}
                onClose={() => setShowProfileMenu(false)}
                name={profileDisplayName}
                handle={profileUser?.handle || decodedHandle}
                avatarUrl={profileUser?.avatarUrl || getAvatarForHandle(decodedHandle)}
                actions={[
                    ...(hasStory
                        ? [
                              {
                                  id: 'stories',
                                  label: 'View Stories',
                                  icon: 'play',
                                  onPress: () => handleStoryPress(),
                              },
                          ]
                        : []),
                    ...(!isOwnProfile
                        ? [
                              {
                                  id: 'follow',
                                  label: isFollowing ? 'Unfollow' : 'Follow',
                                  icon: isFollowing ? 'person-remove' : 'person-add',
                                  onPress: () => {
                                      void handleFollow();
                                  },
                              },
                              {
                                  id: 'invite',
                                  label: 'Invite to group',
                                  icon: 'people',
                                  onPress: () => setShowInviteToGroup(true),
                              },
                          ]
                        : []),
                    {
                        id: 'share',
                        label: 'Share profile',
                        icon: 'share-social',
                        onPress: () => setShowShareProfileSheet(true),
                    },
                    {
                        id: 'qr',
                        label: 'QR code',
                        icon: 'qr-code-outline',
                        onPress: () => setShowProfileQR(true),
                    },
                ]}
            />

            <ViewProfileConnectionsModal
                visible={showConnectionsModal}
                onClose={() => setShowConnectionsModal(false)}
                scope={connectionsScope}
                onScopeChange={setConnectionsScope}
                search={connectionsSearch}
                onSearchChange={setConnectionsSearch}
                rows={searchedConnections}
                loading={connectionsLoading}
                loadingMore={connectionsLoadingMore}
                viewerHandle={user?.handle}
                followMap={connectionFollowMap}
                requestMap={connectionRequestMap}
                actionLoadingMap={connectionActionLoadingMap}
                onToggleFollow={(h) => void toggleConnectionFollow(h)}
                onOpenProfile={(h) => {
                    setShowConnectionsModal(false);
                    navigation.navigate('ViewProfile', { handle: h });
                }}
                hasMore={
                    (connectionsScope === 'followers' && followersHasMore) ||
                    (connectionsScope === 'following' && followingHasMore)
                }
                onLoadMore={
                    connectionsScope === 'followers'
                        ? () => void loadConnections('followers', false)
                        : connectionsScope === 'following'
                          ? () => void loadConnections('following', false)
                          : undefined
                }
            />

            <ProfilePostNotifySheet
                visible={postNotifySheetMode !== null}
                mode={postNotifySheetMode === 'confirm' ? 'confirm' : 'menu'}
                activeLevel={postNotifyLevel}
                displayName={profileDisplayName}
                onClose={() => setPostNotifySheetMode(null)}
                onChooseAll={() => applyPostNotifyLevel('all')}
                onChooseNone={() => applyPostNotifyLevel('off')}
            />

            <ShareProfileSheet
                visible={showShareProfileSheet}
                onClose={() => setShowShareProfileSheet(false)}
                handle={decodedHandle}
                name={profileDisplayName}
                avatarUrl={profileUser?.avatarUrl}
                navigation={navigation}
            />

            <ProfileQRCodeModal
                visible={showProfileQR}
                onClose={() => setShowProfileQR(false)}
                handle={decodedHandle}
                name={profileDisplayName}
            />

            <ViewProfilePostsSheet
                visible={showPostsSheet}
                onClose={() => {
                    setShowPostsSheet(false);
                    setSelectedPostId(null);
                }}
                posts={posts}
                initialPostId={selectedPostId}
                profileName={profileDisplayName}
                profileHandle={decodedHandle}
                navigation={navigation}
                onPostUpdated={applyPostLikeUpdate}
            />

            <ProfileGridPeekSheet
                visible={gridPeekPost !== null}
                post={gridPeekPost}
                profileHandle={decodedHandle}
                profileName={profileDisplayName}
                profileAvatarUrl={profileUser?.avatarUrl}
                isOwnProfile={isOwnProfile}
                onClose={closeGridPeek}
                onLike={() => void handlePeekLike()}
                onComment={handlePeekComment}
                onReclip={() => void handlePeekReclip()}
                onShare={handlePeekShare}
                onReport={handlePeekReport}
            />

            <PostCommentsSheet
                postId={peekCommentsPost?.id ?? ''}
                post={peekCommentsPost}
                isOpen={peekCommentsPost !== null}
                onClose={() => setPeekCommentsPost(null)}
                commentAuthorHandle={user?.handle || ''}
                currentUserHandle={user?.handle}
                onCommentCountChange={(n) => {
                    const pid = peekCommentsPost?.id;
                    if (!pid) return;
                    const patch = (p: Post) =>
                        String(p.id) === String(pid)
                            ? { ...p, stats: { ...p.stats, comments: Math.max(0, n) } }
                            : p;
                    setPeekCommentsPost((prev) => (prev ? patch(prev) : prev));
                    setPosts((prev) => prev.map(patch));
                    setGridPeekPost((prev) => (prev ? patch(prev) : prev));
                }}
            />

            <FeedShareModal
                post={peekSharePost}
                isOpen={peekSharePost !== null}
                onClose={() => setPeekSharePost(null)}
            />

            <PickGroupToInviteFeedUserModal
                visible={showInviteToGroup}
                onClose={() => setShowInviteToGroup(false)}
                inviteeHandle={decodedHandle}
            />

            <GazetteerAlertSheet
                visible={showNoPlacesAlert}
                title="No Places Traveled"
                message={`${decodedHandle || 'This user'} hasn't added any places they've traveled to their profile yet.`}
                icon="alert"
                confirmButtonText="Done"
                onConfirm={() => setShowNoPlacesAlert(false)}
                onDismiss={() => setShowNoPlacesAlert(false)}
            />

            <GazetteerAlertSheet
                visible={showFollowRequestAlert}
                title="Follow Request Sent"
                message="Your follow request has been sent."
                icon="success"
                confirmButtonText="Done"
                onConfirm={() => setShowFollowRequestAlert(false)}
                onDismiss={() => setShowFollowRequestAlert(false)}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    loadingShell: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        ...gazetteerHeader,
    },
    headerIconBtn: {
        width: ox(44),
        height: ox(44),
        borderRadius: ox(22),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconBtnPlaceholder: {
        width: ox(44),
        height: ox(44),
    },
    headerCenter: {
        flex: 1,
        minWidth: 0,
        paddingHorizontal: ox(8),
        alignItems: 'center',
    },
    headerName: {
        fontSize: ox(14),
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    headerHandle: {
        fontSize: ox(11),
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 1,
    },
    passportTitleBlock: {
        width: '100%',
        alignItems: 'center',
        paddingTop: ox(16),
        paddingBottom: ox(12),
    },
    passportTitle: {
        fontSize: ox(28),
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: ox(-0.3),
    },
    passportEyebrow: {
        marginTop: ox(4),
        fontSize: ox(12),
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: ox(3.2),
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingTop: ox(20),
        paddingBottom: ox(8),
        gap: ox(24),
    },
    statsContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: ox(8),
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: ox(8),
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        borderRadius: ox(12),
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingVertical: ox(8),
    },
    statNumber: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: ox(11),
        color: '#9CA3AF',
        marginTop: ox(2),
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        marginBottom: ox(2),
    },
    coverIdentity: {
        marginTop: ox(10),
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingHorizontal: ox(20),
    },
    coverDisplayName: {
        fontSize: ox(22),
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: ox(4),
        width: '100%',
    },
    coverHandleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
        width: '100%',
    },
    coverHandle: {
        fontSize: ox(14),
        fontWeight: '500',
        color: 'rgba(229,231,235,0.92)',
        textAlign: 'center',
        flexShrink: 1,
    },
    coverBadgeWrap: {
        marginTop: ox(8),
        alignItems: 'center',
        alignSelf: 'center',
    },
    coverFlagRow: {
        marginTop: ox(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(6),
        alignSelf: 'center',
        paddingHorizontal: ox(10),
        paddingVertical: ox(4),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    coverFlagLabel: {
        fontSize: ox(11),
        fontWeight: '600',
        color: 'rgba(229,231,235,0.85)',
    },
    displayName: {
        fontSize: ox(18),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    userInfo: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingBottom: FEED_UI.spacing.normalV,
        paddingTop: 0,
    },
    userHandle: {
        fontSize: ox(16),
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: ox(4),
    },
    bioBox: {
        borderRadius: ox(16),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: ox(12),
        paddingVertical: ox(10),
        marginBottom: ox(4),
    },
    bioBoxEmpty: {
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    bio: {
        fontSize: ox(14),
        color: '#E5E7EB',
        lineHeight: ox(20),
    },
    bioPlaceholder: {
        fontSize: ox(14),
        color: '#6B7280',
    },
    socialLinksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ox(8),
        marginTop: ox(10),
    },
    socialLinkIconButton: {
        width: ox(44),
        height: ox(44),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: ox(12),
    },
    socialXGlyph: {
        color: '#FFFFFF',
        fontSize: ox(18),
        fontWeight: '700',
        lineHeight: ox(22),
    },
    postNotifyButton: {
        width: ox(44),
        height: ox(42),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    postNotifyButtonActive: {
        borderColor: 'rgba(61,155,143,0.55)',
        backgroundColor: 'rgba(61,155,143,0.16)',
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: FEED_UI.spacing.inset,
        gap: ox(8),
        marginBottom: ox(16),
        alignItems: 'center',
    },
    secondaryActions: {
        flexDirection: 'row',
        paddingHorizontal: FEED_UI.spacing.inset,
        gap: ox(8),
        marginBottom: ox(16),
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ox(8),
        paddingVertical: ox(11),
        borderRadius: ox(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#000000',
    },
    secondaryActionBtnDisabled: {
        opacity: 0.45,
    },
    secondaryActionText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    followButton: {
        flex: 1,
        paddingVertical: ox(10),
        minHeight: ox(42),
        borderRadius: ox(12),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    privateFollowButton: {
        flex: 0,
        paddingHorizontal: ox(24),
        minWidth: 140,
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
    },
    privateFollowButtonText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    followButtonText: {
        color: '#000000',
        fontSize: ox(14),
        fontWeight: '600',
    },
    messageButton: {
        flex: 1,
        paddingVertical: ox(10),
        minHeight: ox(42),
        borderRadius: ox(12),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    messageButtonText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '600',
    },
    contentTabsWrap: {
        marginBottom: ox(8),
        paddingHorizontal: ox(8),
        paddingVertical: ox(6),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.92)',
    },
    contentTabsRow: {
        flexDirection: 'row',
        gap: ox(6),
        paddingHorizontal: ox(4),
    },
    contentTabButton: {
        flex: 1,
        minHeight: ox(44),
        borderRadius: ox(8),
        paddingVertical: ox(10),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    contentTabButtonActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    contentTabText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
    contentTabTextActive: {
        color: '#000000',
    },
    postsContainer: {
        paddingHorizontal: ox(8),
        paddingTop: ox(4),
        paddingBottom: FEED_UI.spacing.inset,
    },
    postsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    emptyGrid: {
        alignItems: 'center',
        paddingVertical: ox(48),
        paddingHorizontal: ox(24),
    },
    emptyGridTitle: {
        color: '#9CA3AF',
        fontSize: ox(18),
        marginBottom: ox(8),
        textAlign: 'center',
    },
    emptyGridSubtext: {
        color: '#6B7280',
        fontSize: ox(14),
        textAlign: 'center',
    },
    loadMoreGridBtn: {
        marginTop: ox(12),
        marginBottom: ox(8),
        alignSelf: 'center',
        paddingHorizontal: ox(16),
        paddingVertical: ox(10),
        borderRadius: ox(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        minWidth: 140,
        alignItems: 'center',
    },
    loadMoreGridBtnText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '600',
    },
    postThumbnail: {
        width: '33.33%',
        padding: FEED_UI.spacing.hairlineGap,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
    },
    privateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(40),
    },
    privateText: {
        fontSize: ox(24),
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: ox(16),
        marginBottom: ox(8),
        textAlign: 'center',
    },
    privateSubtext: {
        fontSize: ox(14),
        color: '#9CA3AF',
        marginBottom: ox(24),
        textAlign: 'center',
        lineHeight: ox(20),
    },
    privatePendingText: {
        fontSize: ox(14),
        color: '#6B7280',
        textAlign: 'center',
    },
    traveledButton: {
        paddingHorizontal: ox(16),
        paddingVertical: ox(10),
        borderRadius: ox(8),
        justifyContent: 'center',
        alignItems: 'center',
        ...glassSurface,
    },
    traveledButtonDisabled: {
        opacity: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(6, 13, 22, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: ox(16),
    },
    modalContent: {
        borderRadius: ox(16),
        maxWidth: 400,
        width: '100%',
        maxHeight: '80%',
        overflow: 'hidden',
        backgroundColor: 'rgba(15, 36, 48, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(159, 212, 203, 0.18)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: ox(16),
        ...gazetteerHeader,
    },
    modalTitle: {
        fontSize: ox(20),
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalBody: {
        padding: ox(16),
    },
    connectionsModalContent: {
        borderRadius: ox(16),
        maxWidth: 500,
        width: '100%',
        maxHeight: '85%',
        overflow: 'hidden',
        backgroundColor: 'rgba(15, 36, 48, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(159, 212, 203, 0.18)',
    },
    connectionsTabs: {
        flexDirection: 'row',
        gap: ox(8),
        paddingHorizontal: ox(16),
        paddingTop: ox(12),
        paddingBottom: ox(8),
    },
    connectionsTabBtn: {
        borderRadius: ox(999),
        paddingHorizontal: ox(10),
        paddingVertical: ox(6),
        ...glassSurface,
    },
    connectionsTabBtnActive: {
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        borderWidth: 1,
        borderColor: 'rgba(159, 212, 203, 0.35)',
    },
    connectionsTabText: {
        color: '#D1D5DB',
        fontSize: ox(12),
        fontWeight: '700',
    },
    connectionsTabTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    connectionsSearchWrap: {
        marginHorizontal: ox(16),
        marginBottom: ox(8),
        borderRadius: ox(999),
        paddingHorizontal: ox(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(8),
        ...glassSearch,
    },
    connectionsSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: ox(14),
        paddingVertical: ox(8),
    },
    connectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: ox(10),
        paddingHorizontal: ox(10),
        paddingVertical: ox(8),
        marginBottom: ox(8),
        justifyContent: 'space-between',
        gap: ox(10),
        ...glassSurface,
    },
    connectionLeftTap: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    connectionTextWrap: {
        marginLeft: 10,
        flex: 1,
    },
    connectionNameText: {
        color: '#FFFFFF',
        fontSize: ox(14),
        fontWeight: '700',
    },
    connectionHandleText: {
        color: '#9CA3AF',
        fontSize: ox(12),
        marginTop: ox(2),
    },
    connectionMetaBadge: {
        marginTop: ox(5),
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(5),
        borderRadius: ox(999),
        paddingHorizontal: ox(8),
        paddingVertical: ox(3),
        ...glassSurface,
    },
    connectionMetaBadgeText: {
        color: '#CBD5E1',
        fontSize: ox(10),
        fontWeight: '700',
    },
    connectionFollowBtn: {
        borderRadius: ox(999),
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        paddingHorizontal: ox(12),
        paddingVertical: ox(7),
        minWidth: ox(84),
        alignItems: 'center',
    },
    connectionFollowingBtn: {
        backgroundColor: 'rgba(24, 24, 28, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    connectionRequestedBtn: {
        backgroundColor: 'rgba(71, 85, 105, 0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    connectionFollowBtnText: {
        color: '#FFFFFF',
        fontSize: ox(12),
        fontWeight: '700',
    },
    loadMoreBtn: {
        marginTop: ox(6),
        borderRadius: ox(10),
        alignItems: 'center',
        paddingVertical: ox(10),
        ...glassSurface,
    },
    loadMoreBtnText: {
        color: '#E5E7EB',
        fontSize: ox(13),
        fontWeight: '700',
    },
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: ox(16),
        borderRadius: ox(12),
        marginBottom: ox(12),
        ...glassSurface,
    },
    placeIcon: {
        width: ox(40),
        height: ox(40),
        borderRadius: ox(20),
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    placeName: {
        flex: 1,
        fontSize: ox(16),
        fontWeight: '500',
        color: '#FFFFFF',
    },
    emptyText: {
        fontSize: ox(15),
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: ox(24),
    },
});









