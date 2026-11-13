import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  FiBell,
  FiBellOff,
  FiCheck,
  FiChevronLeft,
  FiEye,
  FiFlag,
  FiHeart,
  FiLink,
  FiLock,
  FiMapPin,
  FiMic,
  FiPlay,
  FiShare2,
  FiUserMinus,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar';
import Flag from '../components/Flag';
import VerifiedBadge from '../components/VerifiedBadge';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet';
import ProfileConnectionsSheet, {
  type ProfileConnectionRow,
  type ProfileConnectionScope,
} from '../components/ProfileConnectionsSheet';
import ShareProfileModal from '../components/ShareProfileModal';
import PickGroupToInviteFeedUserModal from '../components/PickGroupToInviteFeedUserModal';
import { fetchFollowers, fetchFollowing, fetchUserProfile } from '../api/client';
import { getFollowedUsers, mapLaravelProfilePosts, posts as allPosts, upsertLocalPost } from '../api/posts';
import { resolvePostThumbnail } from '../api/collections';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import {
  clearActiveStoryProbes,
  markStoryAsViewedLocal,
  userHasStoriesByHandle,
  userHasUnviewedStoriesByHandle,
} from '../api/stories';
import { storyRingColor, storyRingVisible, type StoryRingState } from '../utils/storyRingNative';
import { followOrRequest } from '../utils/followOrRequest';
import {
  canSendMessage,
  canViewProfile,
  hasPendingFollowRequest,
  isProfilePrivate,
  setProfilePrivacy,
} from '../api/privacy';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { buildSuggestedConnections } from '../utils/suggestedConnections';
import { formatProfileStatCount, getEffectivePlacesTraveled } from '../utils/effectivePlacesTraveled';
import { formatViewCount } from '../utils/feedPostNewsTicker';
import {
  getPostBodyText,
  getTextOnlyBackgroundColor,
  getTextOnlyTextColor,
  isTextOnlyPost,
  isVideoPost,
} from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';
import { getStableUserId } from '../utils/userId';
import {
  clearProfilePostNotifyForCreator,
  getProfilePostNotifyLevel,
  setProfilePostNotifyLevel,
  type ProfilePostNotifyLevel,
} from '../utils/profilePostNotifyPrefs';
import { buildProfileShareUrl } from '../utils/profileShareUrl';
import { SiInstagram } from 'react-icons/si';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import type { Post } from '../types';

type ProfileShape = {
  id?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks?: Record<string, string | undefined>;
  profileBackgroundUrl?: string;
  placesTraveled?: string[];
  favouritePlaces?: string[];
  accountType?: string;
  countryFlag?: string;
};

function isStockCover(url?: string | null): boolean {
  const lower = String(url || '').trim().toLowerCase();
  if (!lower) return true;
  return (
    lower.includes('world-map.jpg') ||
    lower.includes('equirectangular_projection') ||
    lower.startsWith('/placeholders/')
  );
}

function normalizeHandleKey(value: string): string {
  return value.replace(/^@/, '').trim().toLowerCase();
}

function ProfileGridTile({ post }: { post: Post }) {
  const bodyText = getPostBodyText(post);
  const textOnly = isTextOnlyPost(post);
  const video = isVideoPost(post);
  const rawThumb = textOnly ? '' : resolvePostThumbnail(post) || '';
  const thumb = rawThumb ? rewriteMediaUrlForClient(rawThumb) : '';
  const styleId = (post as Post & { cardStyle?: string; card_style?: string }).cardStyle
    || (post as Post & { card_style?: string }).card_style;
  const card = isTextCardStyleId(styleId) ? TEXT_CARD_STYLES[styleId] : null;
  const textColor = card?.textColor || getTextOnlyTextColor(post);
  const views = formatViewCount(post.stats?.views ?? (post as Post & { views_count?: number }).views_count ?? 0);
  const showTextCard = !thumb && !video && (textOnly || bodyText.length > 0);

  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-lg border bg-[#111827] ${card?.bordered ? 'border-white/[0.18]' : 'border-white/10'}`}>
      {thumb ? (
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      ) : video ? (
        <div className="flex h-full w-full items-center justify-center text-white">
          <FiPlay className="h-5 w-5" />
        </div>
      ) : showTextCard ? (
        <div
          className="flex h-full w-full items-start p-1.5 text-left"
          style={{
            color: textColor,
            background: card && card.colors.length >= 2
              ? `linear-gradient(180deg, ${card.colors.join(', ')})`
              : card?.colors[0] || getTextOnlyBackgroundColor(post),
          }}
        >
          <p className="line-clamp-4 text-[10px] font-semibold leading-[13px]">
            {bodyText || 'Post'}
          </p>
        </div>
      ) : null}
      <div className="absolute bottom-2 left-2 z-[2] inline-flex items-center gap-1 rounded-lg bg-black/45 px-1.5 py-0.5 text-[11px] font-bold text-white">
        <FiEye className="h-3 w-3" />
        <span>{views}</span>
      </div>
    </div>
  );
}

export default function ViewProfilePage() {
  const { handle: handleParam = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const routeState = (location.state || {}) as { sourcePostId?: string; isFollowing?: boolean };
  const decodedHandle = decodeURIComponent(handleParam || '');
  const hasRouteFollowState = typeof routeState.isFollowing === 'boolean';

  const [profileUser, setProfileUser] = React.useState<ProfileShape | null>(null);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isFollowing, setIsFollowing] = React.useState(hasRouteFollowState ? routeState.isFollowing === true : false);
  const [hasPendingRequest, setHasPendingRequest] = React.useState(false);
  const [canView, setCanView] = React.useState(true);
  const [profileIsPrivate, setProfileIsPrivate] = React.useState(false);
  const [stats, setStats] = React.useState({ following: 0, followers: 0, likes: 0, views: 0 });
  const [storyRingState, setStoryRingState] = React.useState<StoryRingState>('none');
  const [hasStory, setHasStory] = React.useState(false);
  const [contentTab, setContentTab] = React.useState<'all' | 'videos' | 'photos' | 'text'>('all');
  const [postsCursor, setPostsCursor] = React.useState<string | number | null>(null);
  const [postsHasMore, setPostsHasMore] = React.useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = React.useState(false);
  const [placesOpen, setPlacesOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrUrl, setQrUrl] = React.useState('');
  const [notifyLevel, setNotifyLevel] = React.useState<ProfilePostNotifyLevel>('off');
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [connectionsOpen, setConnectionsOpen] = React.useState(false);
  const [connectionsScope, setConnectionsScope] = React.useState<ProfileConnectionScope>('followers');
  const [connectionsSearch, setConnectionsSearch] = React.useState('');
  const [connectionsLoading, setConnectionsLoading] = React.useState(false);
  const [followersList, setFollowersList] = React.useState<ProfileConnectionRow[]>([]);
  const [followingList, setFollowingList] = React.useState<ProfileConnectionRow[]>([]);
  const [followMap, setFollowMap] = React.useState<Record<string, boolean>>({});
  const [requestMap, setRequestMap] = React.useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({});
  const [viewerFollowedSet, setViewerFollowedSet] = React.useState<Set<string>>(new Set());
  const [dismissedSuggested, setDismissedSuggested] = React.useState<Record<string, boolean>>({});
  const [alert, setAlert] = React.useState<{ title: string; message?: string; icon?: 'success' | 'alert' | 'info' } | null>(null);

  const isOwnProfile = Boolean(user?.handle && normalizeHandleKey(decodedHandle) === normalizeHandleKey(user.handle));
  const profileDisplayName = (profileUser?.name || '').trim() || decodedHandle.replace(/^@/, '').split('@')[0] || 'User';
  const socialLinks = (profileUser?.socialLinks || {}) as Record<string, string | undefined>;
  const effectivePlaces = React.useMemo(
    () => getEffectivePlacesTraveled(profileUser, isOwnProfile ? user : undefined),
    [profileUser, user, isOwnProfile],
  );
  const favouritePlaces = React.useMemo(() => {
    const fromProfile = Array.isArray(profileUser?.favouritePlaces) ? profileUser.favouritePlaces : [];
    const fromAuth = isOwnProfile && Array.isArray(user?.favouritePlaces) ? user.favouritePlaces : [];
    const source = fromProfile.length > 0 ? fromProfile : fromAuth;
    return source.filter((place) => typeof place === 'string' && place.trim().length > 0);
  }, [profileUser, isOwnProfile, user]);
  const coverRaw = profileUser?.profileBackgroundUrl || (isOwnProfile ? user?.profileBackgroundUrl : undefined);
  const coverUrl = !isStockCover(coverRaw) && coverRaw ? rewriteMediaUrlForClient(coverRaw) : '';
  const avatarUrl = rewriteMediaUrlForClient(profileUser?.avatarUrl || getAvatarForHandle(decodedHandle) || '');
  const flagValue = isOwnProfile ? user?.countryFlag || '' : profileUser?.countryFlag || getFlagForHandle(profileUser?.handle || decodedHandle) || '';
  const accountType = String(profileUser?.accountType || (isOwnProfile ? user?.accountType : '') || '').toLowerCase();
  const ringVisible = storyRingVisible(storyRingState);
  const ringColor = storyRingColor(storyRingState);

  const loadProfile = React.useCallback(async () => {
    if (!decodedHandle) return;
    setLoading(true);
    try {
      let followedUsers: string[] = [];
      if (user?.id && user.handle) {
        try {
          followedUsers = await getFollowedUsers(String(user.id));
        } catch {
          followedUsers = [];
        }
        const privateProfile = isProfilePrivate(decodedHandle);
        setProfileIsPrivate(privateProfile);
        setCanView(canViewProfile(user.handle, decodedHandle, followedUsers));
        const pending = hasPendingFollowRequest(user.handle, decodedHandle);
        const follows = followedUsers.some((entry) => normalizeHandleKey(entry) === normalizeHandleKey(decodedHandle));
        if (!hasRouteFollowState) {
          setIsFollowing(follows);
          setHasPendingRequest(pending);
        } else {
          setHasPendingRequest(routeState.isFollowing ? false : pending);
        }
      }

      let profileData: any;
      let userPosts: Post[] = [];
      if (isLaravelApiEnabled()) {
        try {
          profileData = await fetchUserProfile(
            decodedHandle,
            user?.id,
            null,
            20,
            typeof routeState.sourcePostId === 'string' ? routeState.sourcePostId : undefined,
            'all',
          );
          if (typeof profileData?.is_following === 'boolean') setIsFollowing(profileData.is_following);
          if (typeof profileData?.has_pending_request === 'boolean') setHasPendingRequest(profileData.has_pending_request);
          if (typeof profileData?.is_private === 'boolean') {
            setProfileIsPrivate(profileData.is_private);
            setProfilePrivacy(decodedHandle, profileData.is_private);
            setCanView(profileData.can_view !== false);
          }
          userPosts = mapLaravelProfilePosts(profileData?.posts);
        } catch (error: any) {
          if (error?.status === 403) {
            setCanView(false);
            setProfileIsPrivate(true);
            setProfilePrivacy(decodedHandle, true);
            const body = error?.response;
            if (typeof body?.has_pending_request === 'boolean') setHasPendingRequest(body.has_pending_request);
            setProfileUser({
              handle: body?.handle || decodedHandle,
              name: body?.display_name || decodedHandle.split('@')[0],
              avatarUrl: body?.avatar_url,
            });
            setLoading(false);
            return;
          }
        }
      }

      const places = Array.isArray(profileData?.placesTraveled || profileData?.places_traveled)
        ? (profileData?.placesTraveled || profileData?.places_traveled).filter((item: unknown) => typeof item === 'string')
        : undefined;
      const favourites = Array.isArray(profileData?.favouritePlaces || profileData?.favourite_places)
        ? (profileData?.favouritePlaces || profileData?.favourite_places).filter((item: unknown) => typeof item === 'string')
        : undefined;
      const resolvedType =
        profileData?.accountType === 'business' || profileData?.account_type === 'business' || profileData?.is_business === true
          ? 'business'
          : profileData?.accountType === 'personal' || profileData?.account_type === 'personal'
            ? 'personal'
            : isOwnProfile
              ? user?.accountType
              : undefined;
      setProfileUser({
        id: profileData?.id != null ? String(profileData.id) : undefined,
        handle: profileData?.handle || decodedHandle,
        name: profileData?.name || profileData?.display_name || (isOwnProfile ? user?.name : undefined) || decodedHandle.split('@')[0],
        avatarUrl: profileData?.avatarUrl || profileData?.avatar_url || (isOwnProfile ? user?.avatarUrl : undefined) || getAvatarForHandle(decodedHandle),
        bio: profileData?.bio || (isOwnProfile ? user?.bio : undefined),
        socialLinks: profileData?.socialLinks || profileData?.social_links || (isOwnProfile ? user?.socialLinks : undefined),
        profileBackgroundUrl: profileData?.profileBackgroundUrl || profileData?.profile_background_url || (isOwnProfile ? user?.profileBackgroundUrl : undefined),
        placesTraveled: places?.length ? places : undefined,
        favouritePlaces: favourites?.length ? favourites : undefined,
        accountType: resolvedType,
        countryFlag: profileData?.country_flag || profileData?.countryFlag || (isOwnProfile ? user?.countryFlag : undefined),
      });
      setPosts(userPosts);
      const aggregateViews = userPosts.reduce((sum, post) => sum + (post.stats?.views ?? 0), 0);
      const aggregateLikes = userPosts.reduce((sum, post) => sum + (post.stats?.likes ?? 0), 0);
      setStats({
        following: Number(profileData?.following_count) || 0,
        followers: Number(profileData?.followers_count) || 0,
        likes: Math.max(Number(profileData?.likes_count || profileData?.stats?.likes) || 0, aggregateLikes),
        views: Math.max(Number(profileData?.views_count || profileData?.stats?.views) || 0, aggregateViews),
      });
      setPostsCursor(profileData?.postsNextCursor ?? null);
      setPostsHasMore(Boolean(profileData?.postsHasMore) || userPosts.length >= 20);
      const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
      void userHasStoriesByHandle(decodedHandle, viewerId)
        .then(async (has) => {
          const unviewed = has ? await userHasUnviewedStoriesByHandle(decodedHandle, viewerId) : false;
          setHasStory(has);
          setStoryRingState(has ? (unviewed ? 'unseen' : 'seen') : 'none');
        })
        .catch(() => {
          setHasStory(false);
          setStoryRingState('none');
        });
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfileUser((prev) => prev || { handle: decodedHandle, name: decodedHandle.split('@')[0] });
    } finally {
      setLoading(false);
    }
  }, [decodedHandle, hasRouteFollowState, isOwnProfile, routeState.isFollowing, routeState.sourcePostId, user]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  React.useEffect(() => {
    if (!user?.id || isOwnProfile) {
      setNotifyLevel('off');
      return;
    }
    setNotifyLevel(getProfilePostNotifyLevel(String(user.id), decodedHandle));
  }, [decodedHandle, isOwnProfile, user?.id]);

  const filteredPosts = posts.filter((post) => {
    if (contentTab === 'videos') return isVideoPost(post);
    if (contentTab === 'photos') return !!post.mediaUrl && !isVideoPost(post);
    if (contentTab === 'text') return isTextOnlyPost(post);
    return true;
  });

  const handleFollow = async () => {
    if (!user?.id || !user.handle) {
      setAlert({ title: 'Error', message: 'Unable to follow user. Please sign in with a full profile.', icon: 'alert' });
      return;
    }
    const handleToUse = profileUser?.handle || decodedHandle;
    const wasFollowing = isFollowing;
    const wasRequested = hasPendingRequest;
    const nextFollowing = hasPendingRequest ? false : !wasFollowing;
    try {
      const result = await followOrRequest({
        userId: String(user.id),
        targetHandle: handleToUse,
        viewerHandle: user.handle,
        targetUserId: profileUser?.id,
        nextFollowing,
        surfaceErrors: isLaravelApiEnabled(),
      });
      setIsFollowing(result.following);
      setHasPendingRequest(result.requested);
      if (result.requested && !wasRequested) {
        setAlert({ title: 'Follow Request Sent', message: 'Your follow request has been sent.', icon: 'success' });
      }
      if (!result.following && !result.requested && wasFollowing) {
        clearProfilePostNotifyForCreator(String(user.id), user.handle, handleToUse);
        setNotifyLevel('off');
        setNotifyOpen(false);
        setStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        const followed = await getFollowedUsers(String(user.id));
        setCanView(canViewProfile(user.handle, handleToUse, followed));
      } else if (result.following && !wasFollowing) {
        setStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
        setCanView(true);
      } else if (result.requested) {
        setCanView(false);
      }
    } catch (error: any) {
      setAlert({ title: 'Error', message: error?.message || 'Failed to follow user.', icon: 'alert' });
    }
  };

  const openMessage = async () => {
    if (!user?.handle) return;
    const followed = user.id ? await getFollowedUsers(String(user.id)).catch(() => [] as string[]) : [];
    const follows = isFollowing ? [...followed, decodedHandle] : followed;
    if (!canSendMessage(user.handle, decodedHandle, follows)) {
      setAlert({ title: 'Cannot Message', message: 'You must follow this user to send a message.', icon: 'alert' });
      return;
    }
    navigate(`/messages/${encodeURIComponent(decodedHandle)}`);
  };

  const openStory = () => {
    clearActiveStoryProbes();
    markStoryAsViewedLocal('', decodedHandle);
    navigate('/stories', {
      state: {
        openUserHandle: decodedHandle,
        targetHandle: decodedHandle,
        soloMode: true,
        forceRefreshAt: Date.now(),
        skipStories24RailReturn: true,
        fromStories24Rail: false,
      },
    });
  };

  const openExternal = (raw?: string) => {
    const value = String(raw || '').trim();
    if (!value) return;
    const url = value.startsWith('http') ? value : `https://${value}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openPlace = (place: string) => {
    const label = place.trim();
    if (!label) return;
    setPlacesOpen(false);
    try {
      sessionStorage.setItem('pendingLocation', label);
      sessionStorage.setItem('pendingLocationLabel', label);
      sessionStorage.setItem('pendingLocationScope', 'regional');
      sessionStorage.setItem('pendingFilterType', 'location');
      sessionStorage.removeItem('pendingLocationPlaceId');
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams({
      location: label,
      label,
      scope: 'regional',
    });
    navigate(`/feed?${params.toString()}`);
  };

  const loadConnections = async () => {
    setConnectionsLoading(true);
    try {
      const viewerId = user?.id != null ? String(user.id) : getStableUserId(user);
      const followed = await getFollowedUsers(viewerId).catch(() => [] as string[]);
      const followedSet = new Set(followed.map((entry) => normalizeHandleKey(entry)));
      setViewerFollowedSet(followedSet);
      const [followersRes, followingRes] = await Promise.all([
        fetchFollowers(decodedHandle, 0, 40),
        fetchFollowing(decodedHandle, 0, 40),
      ]);
      const mapRows = (items: any[]): ProfileConnectionRow[] =>
        (Array.isArray(items) ? items : [])
          .map((item) => {
            const handleNoAt = String(item?.handle || item?.userHandle || '').replace(/^@/, '').trim();
            if (!handleNoAt) return null;
            return {
              handleNoAt,
              displayName: String(item?.display_name || item?.displayName || item?.name || handleNoAt),
              avatarUrl: typeof item?.avatar_url === 'string' ? item.avatar_url : item?.avatarUrl,
              isRequested: !!(item?.is_requested || item?.has_pending_request),
              isPrivate: !!(item?.is_private || item?.isPrivate),
              isFollowing: typeof item?.is_following_by_me === 'boolean' ? item.is_following_by_me : followedSet.has(normalizeHandleKey(handleNoAt)),
            };
          })
          .filter(Boolean) as ProfileConnectionRow[];
      const followers = mapRows(followersRes?.items);
      const following = mapRows(followingRes?.items);
      setFollowersList(followers);
      setFollowingList(following);
      const nextFollow: Record<string, boolean> = {};
      const nextRequest: Record<string, boolean> = {};
      [...followers, ...following].forEach((row) => {
        nextFollow[row.handleNoAt] = !!row.isFollowing;
        nextRequest[row.handleNoAt] = !!row.isRequested;
      });
      setFollowMap(nextFollow);
      setRequestMap(nextRequest);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const mutualList = followingList.filter((row) => viewerFollowedSet.has(normalizeHandleKey(row.handleNoAt)));
  const suggestedList = React.useMemo(
    () =>
      buildSuggestedConnections({
        followers: followersList,
        following: followingList,
        posts: allPosts,
        viewerHandle: user?.handle,
        profileHandle: decodedHandle,
        alreadyFollowing: viewerFollowedSet,
        dismissed: dismissedSuggested,
        includeMockAuthors: !isLaravelApiEnabled(),
      }),
    [decodedHandle, dismissedSuggested, followersList, followingList, user?.handle, viewerFollowedSet],
  );
  const connectionRows =
    connectionsScope === 'followers'
      ? followersList
      : connectionsScope === 'following'
        ? followingList
        : connectionsScope === 'mutual'
          ? mutualList
          : suggestedList;
  const visibleRows = connectionRows.filter((row) => {
    const query = connectionsSearch.trim().toLowerCase();
    if (!query) return true;
    return row.handleNoAt.toLowerCase().includes(query) || row.displayName.toLowerCase().includes(query);
  });

  const openConnections = (scope: ProfileConnectionScope) => {
    setConnectionsScope(scope);
    setConnectionsSearch('');
    setConnectionsOpen(true);
    void loadConnections();
  };

  const toggleConnectionFollow = async (handleNoAt: string, nextFollowing: boolean) => {
    if (!user?.id || !user.handle) return;
    setActionLoading((prev) => ({ ...prev, [handleNoAt]: true }));
    try {
      const result = await followOrRequest({
        userId: String(user.id),
        targetHandle: handleNoAt,
        viewerHandle: user.handle,
        nextFollowing,
        surfaceErrors: isLaravelApiEnabled(),
      });
      setFollowMap((prev) => ({ ...prev, [handleNoAt]: result.following }));
      setRequestMap((prev) => ({ ...prev, [handleNoAt]: result.requested }));
      setViewerFollowedSet((prev) => {
        const next = new Set(prev);
        const key = normalizeHandleKey(handleNoAt);
        if (result.following) next.add(key);
        else next.delete(key);
        return next;
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [handleNoAt]: false }));
    }
  };

  const loadMorePosts = async () => {
    if (postsLoadingMore || !postsHasMore) return;
    setPostsLoadingMore(true);
    try {
      const nextProfile = await fetchUserProfile(decodedHandle, user?.id, postsCursor, 20, undefined, 'all');
      const appended = mapLaravelProfilePosts(nextProfile?.posts);
      setPosts((prev) => {
        const seen = new Set(prev.map((post) => String(post.id)));
        return [...prev, ...appended.filter((post) => !seen.has(String(post.id)))];
      });
      setPostsCursor(nextProfile?.postsNextCursor ?? null);
      setPostsHasMore(Boolean(nextProfile?.postsHasMore));
    } catch (error) {
      console.error('Error loading more profile posts:', error);
    } finally {
      setPostsLoadingMore(false);
    }
  };

  const openQr = async () => {
    const url = await QRCode.toDataURL(buildProfileShareUrl(decodedHandle), { width: 256, margin: 2 });
    setQrUrl(url);
    setQrOpen(true);
  };

  const applyNotify = (level: ProfilePostNotifyLevel) => {
    if (!user?.id || !user.handle) return;
    setProfilePostNotifyLevel(String(user.id), user.handle, decodedHandle, level);
    setNotifyLevel(level);
    setNotifyOpen(level === 'all');
    if (level === 'off') setNotifyOpen(false);
  };

  const header = (title: string, subtitle?: string, share = false) => (
    <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-2.5">
      <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white" aria-label="Go back">
        <FiChevronLeft className="h-[22px] w-[22px]" />
      </button>
      <div className="min-w-0 flex-1 px-2 text-center">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        {subtitle ? <p className="truncate text-[11px] text-[#9CA3AF]">{subtitle}</p> : null}
      </div>
      {share ? (
        <button type="button" onClick={() => setShareOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white" aria-label="Share profile">
          <FiShare2 className="h-[18px] w-[18px]" />
        </button>
      ) : (
        <div className="h-11 w-11" />
      )}
    </div>
  );

  const pageStyle = { background: 'linear-gradient(180deg, #000000 0%, #23104F 100%)' };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col text-white" style={pageStyle}>
        {header('Profile')}
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!canView && profileIsPrivate) {
    return (
      <div className="flex min-h-screen flex-col text-white" style={pageStyle}>
        {header(profileDisplayName, profileUser?.handle || decodedHandle)}
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <FiLock className="mb-4 h-16 w-16 text-[#9CA3AF]" />
          <h1 className="text-xl font-bold">This Account is Private</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">To view this user's profile you must be following them.</p>
          {!hasPendingRequest ? (
            <button type="button" onClick={() => void handleFollow()} className="mt-6 min-w-[140px] rounded-[14px] bg-[#3d9b8f] px-6 py-2.5 text-sm font-semibold text-white">
              Follow
            </button>
          ) : (
            <p className="mt-6 text-sm text-[#9CA3AF]">Follow request sent</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 text-white" style={pageStyle}>
      {header(profileDisplayName, profileUser?.handle || decodedHandle, true)}
      <div className="relative mt-1">
        <div className="relative h-[156px] overflow-hidden bg-[#020B26]">
          {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,25,78,0.18), rgba(0,56,209,0.22), rgba(2,11,38,0.72))' }} />
          {isOwnProfile ? (
            <button type="button" onClick={() => navigate('/profile/cover')} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white">
              Change cover
            </button>
          ) : null}
        </div>
        <div className="-mt-11 flex flex-col items-center px-5">
          <button
            type="button"
            onClick={() => {
              if (hasStory) openStory();
              else setMenuOpen(true);
            }}
            className="rounded-full"
            style={ringVisible ? { boxShadow: `0 0 0 3px #020B26, 0 0 0 6px ${ringColor}` } : undefined}
            aria-label="Profile photo"
          >
            <Avatar src={avatarUrl} name={profileDisplayName} size={88} hideBorder={!ringVisible} />
          </button>
          <h1 className="mt-2 w-full truncate text-center text-[22px] font-bold">{profileDisplayName}</h1>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <p className="truncate text-sm font-medium text-white/90">{profileUser?.handle || decodedHandle}</p>
            <VerifiedBadge accountType={accountType} size={15} />
          </div>
          {accountType === 'business' ? (
            <span className="mt-2 inline-flex items-center rounded-full border border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.12)] px-2 py-1 text-xs font-semibold text-[#FBBF24]">
              Business account
            </span>
          ) : null}
          {flagValue ? (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-1">
              <Flag value={flagValue} size={18} />
              <span className="text-[11px] font-semibold text-white/85">Country</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-3.5 pb-2 pt-5">
        <div className="grid grid-cols-4 gap-2 rounded-[20px] border border-white/15 bg-[rgba(18,24,38,0.65)] p-2.5">
          <button type="button" onClick={() => openConnections('following')} className="rounded-[14px] border border-white/10 bg-white/[0.08] py-2.5 text-center">
            <div className="text-base font-semibold">{formatProfileStatCount(stats.following)}</div>
            <div className="text-[11px] text-[#9CA3AF]">Following</div>
          </button>
          <button type="button" onClick={() => openConnections('followers')} className="rounded-[14px] border border-white/10 bg-white/[0.08] py-2.5 text-center">
            <div className="text-base font-semibold">{formatProfileStatCount(stats.followers)}</div>
            <div className="text-[11px] text-[#9CA3AF]">Followers</div>
          </button>
          <div className="rounded-[14px] border border-white/10 bg-white/[0.08] py-2.5 text-center">
            <div className="text-base font-semibold">{formatProfileStatCount(stats.views)}</div>
            <div className="text-[11px] text-[#9CA3AF]">Views</div>
          </div>
          <div className="rounded-[14px] border border-white/10 bg-white/[0.08] py-2.5 text-center">
            <div className="text-base font-semibold">{formatProfileStatCount(stats.likes)}</div>
            <div className="text-[11px] text-[#9CA3AF]">Likes</div>
          </div>
        </div>
      </div>

      {!isOwnProfile ? (
        <div className="mb-4 flex items-center gap-2 px-3.5">
          <button
            type="button"
            onClick={() => void handleFollow()}
            className={`min-h-[42px] flex-1 rounded-[14px] text-sm font-semibold ${
              hasPendingRequest || isFollowing ? 'border border-white/[0.12] bg-white/[0.08] text-white/90' : 'bg-[#3d9b8f] text-white shadow-[0_6px_14px_rgba(45,212,191,0.35)]'
            }`}
          >
            {hasPendingRequest ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
          </button>
          <button type="button" onClick={() => void openMessage()} className="min-h-[42px] flex-1 rounded-[14px] border border-white/15 bg-white/[0.08] text-sm font-semibold">
            Message
          </button>
          {isFollowing && !hasPendingRequest ? (
            <button
              type="button"
              onClick={() => setNotifyOpen(true)}
              className={`flex h-[42px] w-11 items-center justify-center rounded-[14px] border ${
                notifyLevel === 'all' ? 'border-[rgba(61,155,143,0.55)] bg-[rgba(61,155,143,0.16)]' : 'border-white/15 bg-[rgba(18,24,38,0.65)]'
              }`}
              aria-label="Post notifications"
            >
              <FiBell className="h-5 w-5" style={{ color: notifyLevel === 'all' ? PASSPORT_PALETTE.wavePrimary : '#FFFFFF' }} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex gap-2 px-3.5">
        <button
          type="button"
          onClick={() => {
            if (effectivePlaces.length === 0 && favouritePlaces.length === 0) {
              setAlert({
                title: 'No places yet',
                message: `${decodedHandle || 'This user'} hasn't added places traveled or favourite places yet.`,
                icon: 'alert',
              });
              return;
            }
            setPlacesOpen(true);
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-[rgba(18,24,38,0.65)] py-2.5 text-sm font-semibold"
        >
          <FiMapPin className="h-[18px] w-[18px]" />
          Places
        </button>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-[rgba(18,24,38,0.65)] py-2.5 text-sm font-semibold">
          <FiShare2 className="h-[18px] w-[18px]" />
          Share
        </button>
      </div>

      <div className="px-3.5 pb-3">
        <div className={`rounded-2xl border border-white/15 px-3 py-2.5 ${profileUser?.bio ? 'bg-[rgba(18,24,38,0.65)]' : 'bg-[rgba(18,24,38,0.5)]'}`}>
          <p className={`text-sm leading-5 ${profileUser?.bio ? 'text-[#E5E7EB]' : 'text-[#6B7280]'}`}>
            {profileUser?.bio || 'No bio yet'}
          </p>
        </div>
        {(socialLinks.website || socialLinks.x || socialLinks.instagram || socialLinks.tiktok || socialLinks.podcast) ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {socialLinks.website ? <SocialIcon label="Website" onClick={() => openExternal(socialLinks.website)}><FiLink className="h-5 w-5" /></SocialIcon> : null}
            {socialLinks.x ? <SocialIcon label="X" onClick={() => openExternal(`https://twitter.com/${String(socialLinks.x).replace('@', '')}`)}><span className="text-lg font-bold">𝕏</span></SocialIcon> : null}
            {socialLinks.instagram ? <SocialIcon label="Instagram" onClick={() => openExternal(`https://instagram.com/${String(socialLinks.instagram).replace('@', '')}`)}><SiInstagram className="h-5 w-5" /></SocialIcon> : null}
            {socialLinks.tiktok ? <SocialIcon label="TikTok" onClick={() => openExternal(`https://tiktok.com/@${String(socialLinks.tiktok).replace('@', '')}`)}><FiPlay className="h-5 w-5" /></SocialIcon> : null}
            {socialLinks.podcast ? <SocialIcon label="Podcast" onClick={() => openExternal(socialLinks.podcast)}><FiMic className="h-5 w-5" /></SocialIcon> : null}
          </div>
        ) : null}
      </div>

      <div className="mb-2 border-y border-white/10 bg-black/90 px-3 py-1.5">
        <div className="grid grid-cols-4 gap-1.5 px-1">
          {(['all', 'videos', 'photos', 'text'] as const).map((tab) => {
            const active = contentTab === tab;
            const label = tab === 'all' ? 'All' : tab[0].toUpperCase() + tab.slice(1);
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setContentTab(tab)}
                className={`min-h-11 rounded-lg border text-xs font-bold ${active ? 'border-white bg-white text-black' : 'border-white/20 bg-black text-white'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-lg text-[#9CA3AF]">{contentTab === 'all' ? 'No posts yet' : `No ${contentTab} yet`}</p>
          <p className="mt-2 text-sm text-[#6B7280]">
            {contentTab === 'all' ? "When this user posts, you'll see them here." : 'Switch tabs to view other content.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {filteredPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              className="p-[1.5px]"
              onClick={() => {
                upsertLocalPost(post);
                navigate(`/post/${post.id}`, { state: { post } });
              }}
            >
              <ProfileGridTile post={post} />
            </button>
          ))}
        </div>
      )}
      {contentTab === 'all' && postsHasMore ? (
        <button type="button" onClick={() => void loadMorePosts()} disabled={postsLoadingMore} className="mx-auto my-3 block min-w-[140px] rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-[#E5E7EB]">
          {postsLoadingMore ? 'Loading...' : 'Load more posts'}
        </button>
      ) : null}

      {placesOpen ? (
        <div className="fixed inset-0 z-[220] flex items-end bg-[rgba(3,9,27,0.55)]" onClick={() => setPlacesOpen(false)}>
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-[22px] border border-white/20 bg-[#03091B] px-4 pb-8" onClick={(event) => event.stopPropagation()} style={{ background: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)' }}>
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/30" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Gazetteer says</p>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Places</h2>
              <button type="button" onClick={() => setPlacesOpen(false)} aria-label="Close"><FiX className="h-[22px] w-[22px]" /></button>
            </div>
            <p className="mb-2 text-sm font-semibold text-[#D1D5DB]">Places traveled</p>
            {effectivePlaces.length ? effectivePlaces.map((place) => (
              <button key={`traveled-${place}`} type="button" onClick={() => openPlace(place)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left">
                <FiMapPin className="h-5 w-5" />
                <span className="font-semibold">{place}</span>
              </button>
            )) : <p className="mb-3 text-sm text-[#6B7280]">No places traveled yet.</p>}
            <p className="mb-2 mt-3 text-sm font-semibold text-[#D1D5DB]">Favourite places</p>
            {favouritePlaces.length ? favouritePlaces.map((place) => (
              <button key={`favourite-${place}`} type="button" onClick={() => openPlace(place)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left">
                <FiHeart className="h-5 w-5" />
                <span className="font-semibold">{place}</span>
              </button>
            )) : <p className="text-sm text-[#6B7280]">No favourite places yet.</p>}
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4" onClick={() => setMenuOpen(false)}>
          <div className="w-full max-w-[360px] rounded-3xl bg-black px-4 py-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex flex-col items-center">
              <Avatar src={avatarUrl} name={profileDisplayName} size={72} />
              <p className="mt-2 truncate text-base font-bold">{profileDisplayName}</p>
              <p className="truncate text-sm text-[#9CA3AF]">{(profileUser?.handle || decodedHandle).replace(/^@/, '')}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {hasStory ? <MenuAction icon={<FiPlay />} label="View Stories" onClick={() => { setMenuOpen(false); openStory(); }} /> : null}
              {!isOwnProfile ? <MenuAction icon={isFollowing ? <FiUserMinus /> : <FiUserPlus />} label={isFollowing ? 'Unfollow' : 'Follow'} onClick={() => { setMenuOpen(false); void handleFollow(); }} /> : null}
              {!isOwnProfile ? <MenuAction icon={<FiUsers />} label="Invite to group" onClick={() => { setMenuOpen(false); setInviteOpen(true); }} /> : null}
              <MenuAction icon={<FiShare2 />} label="Share profile" onClick={() => { setMenuOpen(false); setShareOpen(true); }} />
              <MenuAction icon={<FiFlag />} label="QR code" onClick={() => { setMenuOpen(false); void openQr(); }} />
            </div>
          </div>
        </div>
      ) : null}

      {notifyOpen ? (
        <div className="fixed inset-0 z-[230] flex items-end bg-black/55" onClick={() => setNotifyOpen(false)}>
          <div className="w-full rounded-t-[22px] border border-white/15 bg-[#03091B] px-4 pb-8 pt-3" onClick={(event) => event.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Gazetteer says</p>
            <h2 className="mt-2 text-lg font-bold">Post notifications</h2>
            <p className="mb-3 text-sm text-[#94A3B8]">Get notified when this account posts.</p>
            <button type="button" onClick={() => applyNotify('all')} className={`mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-3 ${notifyLevel === 'all' ? 'border-[#3d9b8f] bg-[rgba(61,155,143,0.16)]' : 'border-white/10 bg-white/5'}`}>
              <FiBell className="h-5 w-5" style={{ color: notifyLevel === 'all' ? PASSPORT_PALETTE.wavePrimary : '#FFFFFF' }} />
              <span className="flex-1 text-left font-semibold">All posts</span>
              {notifyLevel === 'all' ? <FiCheck style={{ color: PASSPORT_PALETTE.wavePrimary }} /> : null}
            </button>
            <button type="button" onClick={() => applyNotify('off')} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 ${notifyLevel === 'off' ? 'border-[#3d9b8f] bg-[rgba(61,155,143,0.16)]' : 'border-white/10 bg-white/5'}`}>
              <FiBellOff className="h-5 w-5" />
              <span className="flex-1 text-left font-semibold">None</span>
              {notifyLevel === 'off' ? <FiCheck style={{ color: PASSPORT_PALETTE.wavePrimary }} /> : null}
            </button>
          </div>
        </div>
      ) : null}

      {qrOpen ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-6" onClick={() => setQrOpen(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10"
            style={{ background: 'linear-gradient(160deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col items-center px-6 py-6">
              <button type="button" onClick={() => setQrOpen(false)} className="self-end p-1 text-white" aria-label="Close">
                <FiX className="h-[22px] w-[22px]" />
              </button>
              <h2 className="text-lg font-semibold text-white">
                {String(profileDisplayName || decodedHandle || 'Profile').replace(/^@/, '').split('@')[0].toUpperCase()}
              </h2>
              <p className="mb-5 mt-1 text-[13px] text-[#E2E8F0]">Scan to view profile</p>
              <div className="flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl bg-white">
                {qrUrl ? <img src={qrUrl} alt="Profile QR" className="h-64 w-64" /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ShareProfileModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        handle={profileUser?.handle || decodedHandle}
        name={profileDisplayName}
        avatarUrl={avatarUrl}
      />
      <PickGroupToInviteFeedUserModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} inviteeHandle={decodedHandle} />
      <ProfileConnectionsSheet
        visible={connectionsOpen}
        onClose={() => setConnectionsOpen(false)}
        scope={connectionsScope}
        onScopeChange={setConnectionsScope}
        search={connectionsSearch}
        onSearchChange={setConnectionsSearch}
        rows={visibleRows}
        loading={connectionsLoading}
        viewerHandle={user?.handle}
        followMap={followMap}
        requestMap={requestMap}
        actionLoadingMap={actionLoading}
        onToggleFollow={toggleConnectionFollow}
        onDismissSuggested={(handleNoAt) => setDismissedSuggested((prev) => ({ ...prev, [handleNoAt]: true }))}
        onUndoDismissSuggested={(handleNoAt) => setDismissedSuggested((prev) => ({ ...prev, [handleNoAt]: false }))}
        onOpenProfile={(handleNoAt) => {
          setConnectionsOpen(false);
          navigate(`/user/${encodeURIComponent(handleNoAt)}`);
        }}
      />
      <GazetteerAlertSheet
        visible={alert !== null}
        title={alert?.title ?? ''}
        message={alert?.message}
        icon={alert?.icon ?? 'alert'}
        confirmButtonText="Done"
        onConfirm={() => setAlert(null)}
        onDismiss={() => setAlert(null)}
      />
    </div>
  );
}

function SocialIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-black text-white">
      {children}
    </button>
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">{icon}</span>
      {label}
    </button>
  );
}
