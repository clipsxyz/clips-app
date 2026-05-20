import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Modal,
    Clipboard,
    TextInput,
    RefreshControl,
    Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GazetteerScreenShell from '../components/GazetteerScreenShell.native';
import {
    chipActiveMagenta,
    chipActiveMagentaText,
    glassPanel,
    glassSearch,
    glassSurface,
    gazetteerHeader,
} from '../theme/gazetteerAmbientNative';
import { useAuth } from '../context/Auth';
import { fetchPostsByUser, toggleFollowForPost, getFollowedUsers } from '../api/posts';
import { fetchUserProfile, toggleFollow, fetchFollowers, fetchFollowing } from '../api/client';
import { userHasStoriesByHandle } from '../api/stories';
import { isProfilePrivate, canViewProfile, hasPendingFollowRequest, canSendMessage } from '../api/privacy';
import { FEED_UI } from '../constants/feedUiTokens';
import type { Post } from '../types';
import Avatar from '../components/Avatar';
import ProfilePostNotifyBell from '../components/ProfilePostNotifyBell.native';
import ProfilePostNotifySheet, {
    type ProfilePostNotifySheetMode,
} from '../components/ProfilePostNotifySheet.native';
import ShareProfileSheet from '../components/ShareProfileSheet.native';
import ProfileCoverHero from '../components/ProfileCoverHero.native';
import ProfileGridThumb from '../components/ProfileGridThumb.native';
import { isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { getStableUserId } from '../utils/userId';
import type { ProfilePostNotifyLevel } from '../utils/profilePostNotifyPrefs';
import {
    clearProfilePostNotifyForCreatorMobile,
    getProfilePostNotifyLevelMobile,
    setProfilePostNotifyLevelMobile,
} from '../utils/profilePostNotifyPrefsMobile';

export default function ViewProfileScreen({ route, navigation }: any) {
    const { handle } = route.params;
    const { user } = useAuth();

    const [profileUser, setProfileUser] = useState<any>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [hasStory, setHasStory] = useState(false);
    const [canView, setCanView] = useState(true);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [profileIsPrivate, setProfileIsPrivate] = useState(false);
    const [stats, setStats] = useState({ following: 0, followers: 0, posts: 0 });
    const [showTraveledModal, setShowTraveledModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showConnectionsModal, setShowConnectionsModal] = useState(false);
    const [connectionsScope, setConnectionsScope] = useState<'followers' | 'following' | 'mutual' | 'suggested'>('followers');
    const [followersList, setFollowersList] = useState<Array<{ handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>>([]);
    const [followingList, setFollowingList] = useState<Array<{ handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>>([]);
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

    useEffect(() => {
        if (!user?.id || !decodedHandle || isOwnProfile) {
            setPostNotifyLevel('off');
            return;
        }
        const viewerId = user.id != null ? String(user.id) : getStableUserId(user);
        void getProfilePostNotifyLevelMobile(viewerId, decodedHandle).then(setPostNotifyLevel);
    }, [user?.id, decodedHandle, isOwnProfile]);

    const profileNotifyDisplayName = React.useMemo(() => {
        const name = typeof profileUser?.name === 'string' ? profileUser.name.trim() : '';
        if (name) return name;
        const h = String(profileUser?.handle || decodedHandle || '')
            .replace(/^@/, '')
            .trim();
        const short = h.split('@')[0];
        return short || h || 'this user';
    }, [profileUser?.name, profileUser?.handle, decodedHandle]);

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
        loadProfile();
    }, [handle]);

    const loadProfile = async () => {
        if (!handle) return;
        setLoading(true);
        try {
            const decodedHandle = decodeURIComponent(handle);
            const profilePrivate = isProfilePrivate(decodedHandle);
            setProfileIsPrivate(profilePrivate);

            if (user?.id && user?.handle) {
                const followedUsers = await getFollowedUsers(user.id);
                const canViewProfileState = canViewProfile(user.handle, decodedHandle, followedUsers);
                const isFollowingUser = followedUsers.includes(decodedHandle);
                const hasPending = hasPendingFollowRequest(user.handle, decodedHandle);

                setCanView(canViewProfileState);
                setIsFollowing(isFollowingUser);
                setHasPendingRequest(hasPending);

                if (!canViewProfileState && profilePrivate && decodedHandle !== user.handle) {
                    Alert.alert(
                        'Private Profile',
                        'To view this user\'s profile you must be following them.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Follow', onPress: handleFollow },
                        ]
                    );
                    setLoading(false);
                    return;
                }
            }

            // Fetch profile data
            let profileData: any = null;
            try {
                profileData = await fetchUserProfile(decodedHandle, user?.id, null, 50);
                const pt =
                    (profileData as any).placesTraveled ?? (profileData as any).places_traveled;
                const placesTraveled =
                    Array.isArray(pt) ? pt.filter((s: unknown) => typeof s === 'string') : undefined;
                setProfileUser({
                    ...profileData,
                    profileBackgroundUrl:
                        profileData.profileBackgroundUrl ||
                        profileData.profile_background_url ||
                        undefined,
                    placesTraveled:
                        placesTraveled && placesTraveled.length > 0 ? placesTraveled : undefined,
                });
                setStats({
                    following: profileData.following_count || 0,
                    followers: profileData.followers_count || 0,
                    posts: profileData.posts_count || (Array.isArray(profileData.posts) ? profileData.posts.length : 0),
                });
            } catch (err) {
                console.error('Error fetching profile:', err);
            }

            // Prefer backend profile posts when available; fallback to local mock lookup.
            const userPosts = Array.isArray(profileData?.posts)
                ? profileData.posts
                : await fetchPostsByUser(decodedHandle, 50);
            setPosts(userPosts);

            // Check for stories
            const hasStories = await userHasStoriesByHandle(decodedHandle);
            setHasStory(hasStories);
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!user?.id || !handle || !user?.handle) {
            Alert.alert('Error', 'Unable to follow user. Please try again.');
            return;
        }

        const decodedHandle = decodeURIComponent(handle);
        try {
            const followedUsers = await getFollowedUsers(user.id);
            const isCurrentlyFollowing = followedUsers.includes(decodedHandle);
            const profilePrivate = isProfilePrivate(decodedHandle);

            let result;
            try {
                const encodedHandle = encodeURIComponent(decodedHandle);
                result = await toggleFollow(encodedHandle);
            } catch (apiError: any) {
                // Fallback to mock
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                const nextFollowing = !isCurrentlyFollowing;
                setIsFollowing(nextFollowing);
                setHasPendingRequest(false);
                if (!nextFollowing && user?.handle) {
                    const viewerId = String(user.id);
                    void clearProfilePostNotifyForCreatorMobile(viewerId, user.handle, decodedHandle);
                    setPostNotifyLevel('off');
                    setPostNotifySheetMode(null);
                }
                if (nextFollowing && profilePrivate) {
                    setCanView(true);
                } else if (!nextFollowing && profilePrivate) {
                    setCanView(false);
                }
                return;
            }

            if (result.status === 'unfollowed') {
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                setIsFollowing(false);
                setHasPendingRequest(false);
                if (user?.handle) {
                    void clearProfilePostNotifyForCreatorMobile(String(user.id), user.handle, decodedHandle);
                    setPostNotifyLevel('off');
                    setPostNotifySheetMode(null);
                }
                if (profilePrivate) {
                    setCanView(false);
                }
            } else if (result.status === 'pending') {
                setHasPendingRequest(true);
                setIsFollowing(false);
                Alert.alert('Follow Request Sent', 'Your follow request has been sent.');
            } else if (result.status === 'accepted' || result.following === true) {
                if (posts[0]?.id) {
                    await toggleFollowForPost(user.id, posts[0].id);
                }
                setIsFollowing(true);
                setHasPendingRequest(false);
                setCanView(true);
            }

            // Refresh profile
            const profileData = await fetchUserProfile(decodedHandle, user.id);
            setStats({
                following: profileData.following_count || 0,
                followers: profileData.followers_count || 0,
                posts: profileData.posts_count || 0,
            });
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

    const normalizeConnectionItems = (items: any[]): Array<{ handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }> => {
        return (Array.isArray(items) ? items : [])
            .map((item: any) => {
                const handleRaw = String(item?.handle || item?.userHandle || item?.username || item?.name || '').replace(/^@/, '').trim();
                if (!handleRaw) return null;
                return {
                    handleNoAt: handleRaw,
                    displayName: String(item?.display_name || item?.displayName || handleRaw),
                    avatarUrl: typeof item?.avatar_url === 'string' ? item.avatar_url : item?.avatarUrl,
                    isRequested: !!(item?.is_requested || item?.has_pending_request),
                };
            })
            .filter(Boolean) as Array<{ handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>;
    };

    const normalizeHandleKey = (value: string) => value.replace(/^@/, '').trim().toLowerCase();

    const loadConnections = async (tab: 'followers' | 'following', reset = true) => {
        if (!handle || !user?.id) return;
        const decodedHandle = decodeURIComponent(handle);
        if (reset) setConnectionsLoading(true);
        else setConnectionsLoadingMore(true);
        try {
            const followedUsers = await getFollowedUsers(user.id);
            const followedSet = new Set((Array.isArray(followedUsers) ? followedUsers : []).map((h) => normalizeHandleKey(String(h))));
            setViewerFollowedSet(followedSet);
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
                    const dedup = new Map<string, { handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>();
                    merged.forEach((row) => dedup.set(normalizeHandleKey(row.handleNoAt), row));
                    return Array.from(dedup.values());
                });
                setFollowersHasMore(hasMore);
                setFollowersCursor(nextCursor);
            } else {
                setFollowingList((prev) => {
                    if (reset) return normalized;
                    const merged = [...prev, ...normalized];
                    const dedup = new Map<string, { handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>();
                    merged.forEach((row) => dedup.set(normalizeHandleKey(row.handleNoAt), row));
                    return Array.from(dedup.values());
                });
                setFollowingHasMore(hasMore);
                setFollowingCursor(nextCursor);
            }
        } catch (error) {
            console.error('Failed to load connections:', error);
            if (reset) {
                if (tab === 'followers') setFollowersList([]);
                if (tab === 'following') setFollowingList([]);
            }
        } finally {
            if (reset) setConnectionsLoading(false);
            else setConnectionsLoadingMore(false);
        }
    };

    const openConnections = (scope: 'followers' | 'following' | 'mutual' | 'suggested') => {
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

    const mutualList = followingList.filter((entry) =>
        followersList.some((f) => f.handleNoAt.toLowerCase() === entry.handleNoAt.toLowerCase())
    );
    const suggestedList = React.useMemo(() => {
        const mutualKey = new Set(mutualList.map((row) => normalizeHandleKey(row.handleNoAt)));
        const source = [...followersList, ...followingList];
        const dedup = new Map<string, { handleNoAt: string; displayName: string; avatarUrl?: string; isRequested?: boolean }>();
        source.forEach((row) => {
            const key = normalizeHandleKey(row.handleNoAt);
            if (mutualKey.has(key)) return;
            if (viewerFollowedSet.has(key)) return;
            if (normalizeHandleKey(row.handleNoAt) === normalizeHandleKey(String(user?.handle || ''))) return;
            if (!dedup.has(key)) dedup.set(key, row);
        });
        return Array.from(dedup.values());
    }, [followersList, followingList, mutualList, viewerFollowedSet, user?.handle]);
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
        if (!user?.id) return;
        setConnectionActionLoadingMap((prev) => ({ ...prev, [entryHandle]: true }));
        try {
            const result = await toggleFollow(entryHandle);
            const nextFollowing = result?.status === 'accepted' || result?.following === true;
            const isRequested = result?.status === 'pending';
            setConnectionFollowMap((prev) => ({ ...prev, [entryHandle]: nextFollowing }));
            setConnectionRequestMap((prev) => ({ ...prev, [entryHandle]: isRequested }));
            const nextSet = new Set(viewerFollowedSet);
            const key = normalizeHandleKey(entryHandle);
            if (nextFollowing) nextSet.add(key);
            else nextSet.delete(key);
            setViewerFollowedSet(nextSet);
        } catch (error) {
            console.error('Failed to toggle connection follow:', error);
            Alert.alert('Error', 'Could not update follow status.');
        } finally {
            setConnectionActionLoadingMap((prev) => ({ ...prev, [entryHandle]: false }));
        }
    };

    const refreshConnections = async () => {
        setFollowersCursor(0);
        setFollowingCursor(0);
        setFollowersHasMore(true);
        setFollowingHasMore(true);
        await Promise.all([loadConnections('followers', true), loadConnections('following', true)]);
    };

    const handlePostPress = (postId: string) => {
        navigation.navigate('PostDetail', { postId });
    };

    if (loading) {
        return (
            <GazetteerScreenShell contentStyle={styles.loadingShell}>
                <ActivityIndicator size="large" color="#f472b6" />
            </GazetteerScreenShell>
        );
    }

    if (!canView && profileIsPrivate) {
        return (
            <GazetteerScreenShell>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.privateContainer}>
                    <Icon name="lock-closed" size={48} color="#6B7280" />
                    <Text style={styles.privateText}>This profile is private</Text>
                    <Text style={styles.privateSubtext}>Follow to see their posts</Text>
                    <TouchableOpacity onPress={handleFollow} style={styles.followButton}>
                        <Text style={styles.followButtonText}>
                            {hasPendingRequest ? 'Request Sent' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </GazetteerScreenShell>
        );
    }

    return (
        <GazetteerScreenShell>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={() => setShowProfileMenu(true)}>
                    <Icon name="ellipsis-horizontal" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <ProfileCoverHero
                    coverUrl={profileCoverUrl}
                    avatarUrl={profileUser?.avatarUrl}
                    name={profileUser?.name || handle?.split('@')[0] || 'User'}
                    hasStory={hasStory}
                    onAvatarPress={() => setShowProfileMenu(true)}
                    showChangeCover={isOwnProfile}
                    onPressChangeCover={() => navigation.navigate('ProfileCover')}
                />

                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.statsContainer}>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => setContentTab('all')}
                        >
                            <Text style={styles.statNumber}>{stats.posts}</Text>
                            <Text style={styles.statLabel}>Posts</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statItem} onPress={() => openConnections('followers')}>
                            <Text style={styles.statNumber}>{stats.followers}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statItem} onPress={() => openConnections('following')}>
                            <Text style={styles.statNumber}>{stats.following}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <Text style={styles.userHandle}>{handle}</Text>
                    {profileUser?.bio && (
                        <Text style={styles.bio}>{profileUser.bio}</Text>
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
                                    <Icon name="link-outline" size={20} color="#FFFFFF" />
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
                                    <Icon name="logo-twitter" size={20} color="#FFFFFF" />
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
                                    <Icon name="logo-instagram" size={20} color="#FFFFFF" />
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
                                    <Icon name="logo-tiktok" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                            {socialLinks.podcast ? (
                                <TouchableOpacity
                                    style={styles.socialLinkIconButton}
                                    onPress={() => void openExternalLink(socialLinks.podcast)}
                                    accessibilityLabel="Podcast"
                                >
                                    <Icon name="mic-outline" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )}
                </View>

                {/* Action Buttons */}
                {handle !== user?.handle && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            onPress={handleFollow}
                            style={[
                                styles.followButton,
                                isFollowing && styles.followingButton,
                            ]}
                        >
                            <Text style={[
                                styles.followButtonText,
                                isFollowing && styles.followingButtonText,
                            ]}>
                                {hasPendingRequest ? 'Request Sent' : isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={async () => {
                                if (!user?.handle || !handle) return;
                                const decodedHandle = decodeURIComponent(handle);
                                const followedUsers = await getFollowedUsers(user.id);
                                if (!canSendMessage(user.handle, decodedHandle, followedUsers)) {
                                    Alert.alert('Cannot Message', 'You must follow this user to send a message.');
                                    return;
                                }
                                navigation.navigate('Messages', { handle: decodedHandle });
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
                                <ProfilePostNotifyBell active={postNotifyLevel === 'all'} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}

                <View style={styles.secondaryActions}>
                    <TouchableOpacity
                        onPress={() => setShowTraveledModal(true)}
                        style={[
                            styles.secondaryActionBtn,
                            (!profileUser?.placesTraveled ||
                                !Array.isArray(profileUser.placesTraveled) ||
                                profileUser.placesTraveled.length === 0) &&
                                styles.secondaryActionBtnDisabled,
                        ]}
                        disabled={
                            !profileUser?.placesTraveled ||
                            !Array.isArray(profileUser.placesTraveled) ||
                            profileUser.placesTraveled.length === 0
                        }
                    >
                        <Icon name="location" size={18} color="#FFFFFF" />
                        <Text style={styles.secondaryActionText}>Places</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => setShowShareProfileSheet(true)}
                    >
                        <Icon name="share-social" size={18} color="#FFFFFF" />
                        <Text style={styles.secondaryActionText}>Share</Text>
                    </TouchableOpacity>
                </View>

                {/* Posts Grid */}
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
                            >
                                <Text style={[styles.contentTabText, active && styles.contentTabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={styles.postsContainer}>
                    <FlatList
                        data={filteredPosts}
                        numColumns={3}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handlePostPress(item.id)}
                                style={styles.postThumbnail}
                            >
                                <ProfileGridThumb post={item} />
                            </TouchableOpacity>
                        )}
                        scrollEnabled={false}
                    />
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
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.modalBody}
                            refreshControl={
                                <RefreshControl
                                    refreshing={connectionsLoading}
                                    onRefresh={() => {
                                        void refreshConnections();
                                    }}
                                    tintColor="#f472b6"
                                />
                            }
                        >
                            {profileUser?.placesTraveled && Array.isArray(profileUser.placesTraveled) && profileUser.placesTraveled.length > 0 ? (
                                profileUser.placesTraveled.map((place: string, index: number) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.placeItem}
                                        onPress={() => {
                                            setShowTraveledModal(false);
                                            navigation.navigate('Feed', { location: place });
                                        }}
                                    >
                                        <View style={styles.placeIcon}>
                                            <Icon name="location" size={20} color="#FFFFFF" />
                                        </View>
                                        <Text style={styles.placeName}>{place}</Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowTraveledModal(false);
                                                navigation.navigate('Feed', { location: place });
                                            }}
                                        >
                                            <Icon name="eye" size={20} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No places traveled yet.</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Profile Menu Modal */}
            <Modal
                visible={showProfileMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProfileMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <View style={styles.menuContent}>
                            {/* View Stories - only show if user has stories */}
                            {hasStory && (
                                <TouchableOpacity
                                    style={styles.menuButton}
                                    onPress={() => {
                                        setShowProfileMenu(false);
                                        handleStoryPress();
                                    }}
                                >
                                    <View style={styles.menuIconContainer}>
                                        <Icon name="play" size={32} color="#FFFFFF" />
                                    </View>
                                    <Text style={styles.menuButtonText}>View Stories</Text>
                                </TouchableOpacity>
                            )}

                            {/* Follow */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={async () => {
                                    setShowProfileMenu(false);
                                    await handleFollow();
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name={isFollowing ? "person-remove" : "person-add"} size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
                            </TouchableOpacity>

                            {/* Share Profile */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={() => {
                                    setShowProfileMenu(false);
                                    setShowShareProfileSheet(true);
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name="share-social" size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>Share profile</Text>
                            </TouchableOpacity>

                            {/* QR Code */}
                            <TouchableOpacity
                                style={styles.menuButton}
                                onPress={() => {
                                    setShowProfileMenu(false);
                                    Alert.alert('QR Code', 'QR code feature coming soon!');
                                }}
                            >
                                <View style={styles.menuIconContainer}>
                                    <Icon name="qr-code" size={32} color="#FFFFFF" />
                                </View>
                                <Text style={styles.menuButtonText}>QR code</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Connections Modal */}
            <Modal
                visible={showConnectionsModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowConnectionsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.connectionsModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Connections</Text>
                            <TouchableOpacity onPress={() => setShowConnectionsModal(false)}>
                                <Icon name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.connectionsTabs}>
                            {[
                                { id: 'mutual', label: `Mutual (${mutualList.length})` },
                                { id: 'followers', label: `Followers (${followersList.length})` },
                                { id: 'following', label: `Following (${followingList.length})` },
                                { id: 'suggested', label: `Suggested (${suggestedList.length})` },
                            ].map((tab) => {
                                const active = connectionsScope === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.connectionsTabBtn, active && styles.connectionsTabBtnActive]}
                                        onPress={() => setConnectionsScope(tab.id as 'followers' | 'following' | 'mutual' | 'suggested')}
                                    >
                                        <Text style={[styles.connectionsTabText, active && styles.connectionsTabTextActive]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.connectionsSearchWrap}>
                            <Icon name="search" size={16} color="#9CA3AF" />
                            <TextInput
                                value={connectionsSearch}
                                onChangeText={setConnectionsSearch}
                                placeholder="Search people"
                                placeholderTextColor="#6B7280"
                                style={styles.connectionsSearchInput}
                            />
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {connectionsLoading ? (
                                <ActivityIndicator size="small" color="#f472b6" />
                            ) : searchedConnections.length > 0 ? (
                                searchedConnections.map((entry) => (
                                    <View
                                        key={entry.handleNoAt}
                                        style={styles.connectionRow}
                                    >
                                        <TouchableOpacity
                                            style={styles.connectionLeftTap}
                                            onPress={() => {
                                                setShowConnectionsModal(false);
                                                navigation.navigate('ViewProfile', { handle: entry.handleNoAt });
                                            }}
                                        >
                                            <Avatar
                                                src={entry.avatarUrl}
                                                name={entry.displayName || entry.handleNoAt}
                                                size="sm"
                                            />
                                            <View style={styles.connectionTextWrap}>
                                                <Text style={styles.connectionNameText}>{entry.displayName}</Text>
                                                <Text style={styles.connectionHandleText}>@{entry.handleNoAt}</Text>
                                                {connectionRequestMap[entry.handleNoAt] && (
                                                    <View style={styles.connectionMetaBadge}>
                                                        <Icon name="lock-closed" size={11} color="#CBD5E1" />
                                                        <Text style={styles.connectionMetaBadgeText}>Private account</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                        {normalizeHandleKey(entry.handleNoAt) !== normalizeHandleKey(String(user?.handle || '')) && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.connectionFollowBtn,
                                                    connectionRequestMap[entry.handleNoAt] && styles.connectionRequestedBtn,
                                                    connectionFollowMap[entry.handleNoAt] && styles.connectionFollowingBtn,
                                                ]}
                                                disabled={!!connectionActionLoadingMap[entry.handleNoAt] || !!connectionRequestMap[entry.handleNoAt]}
                                                onPress={() => void toggleConnectionFollow(entry.handleNoAt)}
                                            >
                                                {connectionActionLoadingMap[entry.handleNoAt] ? (
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                ) : (
                                                    <Text style={styles.connectionFollowBtnText}>
                                                        {connectionRequestMap[entry.handleNoAt]
                                                            ? 'Requested'
                                                            : connectionFollowMap[entry.handleNoAt]
                                                                ? 'Following'
                                                                : 'Follow'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No connections found.</Text>
                            )}
                            {connectionsScope === 'followers' && followersHasMore && !connectionsSearch.trim() && (
                                <TouchableOpacity
                                    style={styles.loadMoreBtn}
                                    disabled={connectionsLoadingMore}
                                    onPress={() => void loadConnections('followers', false)}
                                >
                                    {connectionsLoadingMore ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.loadMoreBtnText}>Load more followers</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            {connectionsScope === 'following' && followingHasMore && !connectionsSearch.trim() && (
                                <TouchableOpacity
                                    style={styles.loadMoreBtn}
                                    disabled={connectionsLoadingMore}
                                    onPress={() => void loadConnections('following', false)}
                                >
                                    {connectionsLoadingMore ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.loadMoreBtnText}>Load more following</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ProfilePostNotifySheet
                visible={postNotifySheetMode !== null}
                mode={postNotifySheetMode === 'confirm' ? 'confirm' : 'menu'}
                activeLevel={postNotifyLevel}
                displayName={profileNotifyDisplayName}
                onClose={() => setPostNotifySheetMode(null)}
                onChooseAll={() => applyPostNotifyLevel('all')}
                onChooseNone={() => applyPostNotifyLevel('off')}
            />
        </GazetteerScreenShell>
    );
}

const styles = StyleSheet.create({
    loadingShell: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        ...gazetteerHeader,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.inset,
        gap: 24,
    },
    statsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
    },
    userInfo: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingVertical: FEED_UI.spacing.normalV,
        paddingTop: 0,
    },
    userHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    bio: {
        fontSize: 14,
        color: '#D1D5DB',
        marginTop: 4,
    },
    socialLinksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    socialLinkIconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    postNotifyButton: {
        width: 44,
        paddingVertical: FEED_UI.spacing.compactV,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    postNotifyButtonActive: {
        borderColor: 'rgba(217,27,92,0.5)',
        backgroundColor: 'rgba(217,27,92,0.15)',
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: FEED_UI.spacing.inset,
        gap: FEED_UI.spacing.groupGapTight,
        marginBottom: FEED_UI.spacing.groupGapTight,
    },
    secondaryActions: {
        flexDirection: 'row',
        paddingHorizontal: FEED_UI.spacing.inset,
        gap: FEED_UI.spacing.groupGapTight,
        marginBottom: FEED_UI.spacing.normalV,
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#000000',
    },
    secondaryActionBtnDisabled: {
        opacity: 0.45,
    },
    secondaryActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    followButton: {
        flex: 1,
        paddingVertical: FEED_UI.spacing.compactV,
        borderRadius: 8,
        backgroundColor: '#d91b5c',
        alignItems: 'center',
    },
    followingButton: {
        ...glassSurface,
    },
    followButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    followingButtonText: {
        color: '#FFFFFF',
    },
    messageButton: {
        flex: 1,
        paddingVertical: FEED_UI.spacing.compactV,
        borderRadius: 8,
        alignItems: 'center',
        ...glassSurface,
    },
    messageButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    contentTabsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: FEED_UI.spacing.inset,
        marginBottom: 8,
    },
    contentTabButton: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        ...glassSurface,
    },
    contentTabButtonActive: {
        borderColor: 'rgba(244, 114, 182, 0.55)',
        backgroundColor: 'rgba(217, 27, 92, 0.25)',
    },
    contentTabText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    contentTabTextActive: {
        color: '#FBCFE8',
    },
    postsContainer: {
        paddingHorizontal: FEED_UI.spacing.inset,
        paddingTop: 4,
        paddingBottom: FEED_UI.spacing.inset,
    },
    postThumbnail: {
        width: '33.33%',
        aspectRatio: 1,
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
        padding: 40,
    },
    privateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 16,
        marginBottom: 8,
    },
    privateSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginBottom: 24,
    },
    traveledButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        ...glassSurface,
    },
    traveledButtonDisabled: {
        opacity: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        borderRadius: 16,
        maxWidth: 400,
        width: '100%',
        maxHeight: '80%',
        overflow: 'hidden',
        ...glassPanel,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        ...gazetteerHeader,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalBody: {
        padding: 16,
    },
    connectionsModalContent: {
        borderRadius: 16,
        maxWidth: 500,
        width: '100%',
        maxHeight: '85%',
        overflow: 'hidden',
        ...glassPanel,
    },
    connectionsTabs: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    connectionsTabBtn: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        ...glassSurface,
    },
    connectionsTabBtnActive: {
        ...chipActiveMagenta,
    },
    connectionsTabText: {
        color: '#D1D5DB',
        fontSize: 12,
        fontWeight: '700',
    },
    connectionsTabTextActive: {
        ...chipActiveMagentaText,
    },
    connectionsSearchWrap: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 999,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...glassSearch,
    },
    connectionsSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
        paddingVertical: 8,
    },
    connectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 8,
        justifyContent: 'space-between',
        gap: 10,
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
        fontSize: 14,
        fontWeight: '700',
    },
    connectionHandleText: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 2,
    },
    connectionMetaBadge: {
        marginTop: 5,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        ...glassSurface,
    },
    connectionMetaBadgeText: {
        color: '#CBD5E1',
        fontSize: 10,
        fontWeight: '700',
    },
    connectionFollowBtn: {
        borderRadius: 999,
        backgroundColor: '#d91b5c',
        paddingHorizontal: 12,
        paddingVertical: 7,
        minWidth: 84,
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
        fontSize: 12,
        fontWeight: '700',
    },
    loadMoreBtn: {
        marginTop: 6,
        borderRadius: 10,
        alignItems: 'center',
        paddingVertical: 10,
        ...glassSurface,
    },
    loadMoreBtnText: {
        color: '#E5E7EB',
        fontSize: 13,
        fontWeight: '700',
    },
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        ...glassSurface,
    },
    placeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#d91b5c',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    placeName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    emptyText: {
        fontSize: 15,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: 24,
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.78)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        borderRadius: 24,
        padding: 24,
        ...glassPanel,
    },
    menuContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    menuButton: {
        alignItems: 'center',
        gap: 8,
    },
    menuIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(217, 27, 92, 0.22)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.35)',
    },
    menuButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#FFFFFF',
        textAlign: 'center',
    },
});









