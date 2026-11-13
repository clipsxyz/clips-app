import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar';
import CreateGroupModal from '../components/CreateGroupModal';
import { FiCamera, FiBookmark, FiMessageCircle, FiLock, FiUnlock, FiX, FiUser, FiMapPin, FiMap, FiHeart, FiFlag, FiThumbsUp, FiEdit3, FiLink2, FiUsers, FiSettings, FiFileText, FiLayers, FiType, FiTrash2, FiImage, FiGrid, FiEye, FiPlay, FiShield, FiBell } from 'react-icons/fi';
import PlaceAutocompleteField from '../components/PlaceAutocompleteField';
import type { LocationSuggestion } from '../api/locations';
import { parsedPlaceFeedFromSuggestion } from '../utils/placeFeedLevels';
import { FaFacebook } from 'react-icons/fa';
import QRCode from 'qrcode';
import Flag from '../components/Flag';
import { getUserCollections } from '../api/collections';
import type { Collection } from '../types';
import CollectionCoverThumb from '../components/CollectionCoverThumb';
import { addComment, addReply, approveHiddenComment, deleteHiddenComment, deletePost, fetchComments, fetchHiddenCommentsForOwner, fetchPostsByUser, posts, renameUserHandleEverywhere, toggleCommentLike, toggleLike, toggleReplyLike, type HiddenCommentReviewItem } from '../api/posts';
import { resolvePostThumbnail } from '../api/collections';
import { rewriteMediaUrlForClient } from '../api/apiBaseUrl';
import { formatProfileStatCount } from '../utils/effectivePlacesTraveled';
import { formatViewCount } from '../utils/feedPostNewsTicker';
import { getPostBodyText, getTextOnlyBackgroundColor, getTextOnlyTextColor, isTextOnlyPost, isVideoPost } from '../utils/effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES } from '../utils/textCardStyles';
import { nextHandleAfterNameChange, normalizeHandle as handleKey } from '../utils/gazetteerHandle';
import { siblingJpegFromVideoUrl } from '../utils/postMedia';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { showToast } from '../utils/toast';
import { setProfilePrivacy, getEffectiveProfilePrivate } from '../api/privacy';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import { fetchFollowers, fetchFollowing, getCurrentUser, removeFollower, updateAuthProfile, updateUserCommentSettings, uploadFile, mapLaravelUserToAppFields, sendPhoneVerificationCode, verifyPhoneVerificationCode, linkFacebookAccount, fetchFacebookFriendsMatches, toggleFollow, type FacebookMatchedFriend, matchContactPhones } from '../api/client';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { followOrRequest } from '../utils/followOrRequest';
import { buildSuggestedConnections } from '../utils/suggestedConnections';
import ProfileConnectionsSheet, { type ProfileConnectionRow, type ProfileConnectionScope } from '../components/ProfileConnectionsSheet';
import GazetteerAlertSheet from '../components/GazetteerAlertSheet';
import type { Comment, Post, User } from '../types';
import { getAvatarForHandle } from '../api/users';
import { loginWithFacebookWeb } from '../services/facebookAuthWeb';
import { 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  type NotificationPreferences,
  resetNotificationPreferences
} from '../services/notifications';
import { getRuntimeEnv } from '../config/runtimeEnv';
import {
  getCommentModerationPreferences,
  setCommentModerationPreferences,
  type CommentAudience,
  type CommentModerationPreferences,
} from '../utils/commentModeration';
import splashLogo from '../assets/gazetteer-splash-logo.png';

// Card image: show illustration from /profile-cards/ when present (.svg or .png), else fall back to icon
function ProfileCardImage({ imagePath, icon }: { imagePath: string; icon: React.ReactNode }) {
  const [useFallback, setUseFallback] = React.useState(false);
  const [src, setSrc] = React.useState(imagePath);
  React.useEffect(() => {
    setSrc(imagePath);
    setUseFallback(false);
  }, [imagePath]);
  const tryAlternate = () => {
    if (src.endsWith('.svg')) setSrc(src.replace(/\.svg$/, '.png'));
    else setUseFallback(true);
  };
  const showImage = imagePath && !useFallback;
  return (
    <div className="p-3 rounded-xl bg-gray-50 flex items-center justify-center min-h-[48px] min-w-[48px]">
      {showImage ? (
        <img
          src={src}
          alt=""
          className="w-12 h-12 object-contain"
          onError={tryAlternate}
        />
      ) : (
        icon
      )}
    </div>
  );
}

function profilePostViews(post: Post): number {
  const extra = post as Post & { views_count?: number; views?: number };
  return Math.max(0, Number(extra.views_count ?? post.stats?.views ?? extra.views ?? 0) || 0);
}

function formatDraftDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function draftPlace(draft: Draft): string {
  const parts = [draft.location, draft.venue, draft.landmark]
    .map((value) => (value || '').trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
  return parts.join(' · ');
}

function draftPreview(draft: Draft): string {
  const text = (draft.caption || draft.textBody || '').trim();
  return text || 'No caption yet';
}

function draftVisual(draft: Draft): { uri: string; type: 'image' | 'video'; poster?: string } | null {
  if (draft.isTextOnly) return null;
  const poster = (draft.videoPosterUrl || '').trim();
  const videoUrl = (draft.videoUrl || '').trim();
  const first = draft.mediaItems?.find((item) => (item.url || '').trim());
  const itemUrl = (first?.url || '').trim();
  const type = draft.mediaType || first?.type;
  const mediaUri = videoUrl || itemUrl;
  if (!mediaUri && !poster) return null;
  const resolved = (value: string) => (value ? rewriteMediaUrlForClient(value) : '');
  if (type === 'video' || (!poster && mediaUri && type !== 'image')) {
    return { uri: resolved(mediaUri || poster), type: 'video', poster: poster ? resolved(poster) : undefined };
  }
  return { uri: resolved(poster || mediaUri), type: 'image', poster: poster ? resolved(poster) : undefined };
}

function profileGridImage(post: Post): string | undefined {
  const still = resolvePostThumbnail(post);
  if (still) return rewriteMediaUrlForClient(still);
  const item = (post.mediaItems || []).find((entry) => entry?.type === 'image' || entry?.type === 'video');
  const jpeg = siblingJpegFromVideoUrl(item?.url || post.mediaUrl);
  return jpeg ? rewriteMediaUrlForClient(jpeg) : undefined;
}

const PROFILE_CARD_IMAGES = {
  followers: '/profile-cards/followers.svg',
  following: '/profile-cards/following.svg',
  bio: '/profile-cards/bio.svg',
  social: '/profile-cards/social-links.svg',
  personal: '/profile-cards/travel-info.svg',
  location: '/profile-cards/location.svg',
  interests: '/profile-cards/interests.svg',
  flag: '/profile-cards/country-flag.svg',
};

function SettingsSwitch({
  checked,
  onClick,
  disabled,
  accent = 'pink',
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  accent?: 'pink' | 'cyan';
}) {
  const onClass = accent === 'cyan' ? 'justify-end bg-[#00F2FF]' : 'justify-end bg-[#d91b5c]';
  const offClass = accent === 'cyan' ? 'justify-start bg-white/20' : 'justify-start bg-[#30363D]';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[26px] w-[46px] shrink-0 items-center rounded-full px-[3px] disabled:opacity-60 ${checked ? onClass : offClass}`}
    >
      <span className="h-5 w-5 rounded-full bg-white" />
    </button>
  );
}

const SETTINGS_ALERT_TYPES = [
  ['directMessages', 'Direct Messages'],
  ['groupChats', 'Group Chat'],
  ['likes', 'Likes'],
  ['comments', 'Comments'],
  ['replies', 'Replies'],
  ['follows', 'Follows'],
  ['followRequests', 'Follow Requests'],
  ['storyInsights', 'Story Insights'],
  ['shares', 'Shares'],
  ['reclips', 'Reclips'],
] as const;

export default function ProfilePage() {
  const { user, logout, login } = useAuth();
  const nav = useNavigate();
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [bio, setBio] = React.useState(user?.bio || '');
  const [socialLinks, setSocialLinks] = React.useState({
    website: user?.socialLinks?.website || '',
    x: user?.socialLinks?.x || '',
    instagram: user?.socialLinks?.instagram || '',
    tiktok: user?.socialLinks?.tiktok || '',
    podcast: user?.socialLinks?.podcast || '',
  });
  const [countryFlag, setCountryFlag] = React.useState(user?.countryFlag || '');
  const [interestsDraft, setInterestsDraft] = React.useState((user?.interests ?? []).join(', '));
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = React.useState(false);
  const [editHubOpen, setEditHubOpen] = React.useState(false);
  const [passportTab, setPassportTab] = React.useState<'posts' | 'collections'>('posts');
  /** Collection modal thumbs that failed to load — show bookmark/text fallback */
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [commentSafetyOpen, setCommentSafetyOpen] = React.useState(false);
  const [securityOpen, setSecurityOpen] = React.useState(false);
  const [securityStep, setSecurityStep] = React.useState<'phone' | 'code'>('phone');
  const [securityBusy, setSecurityBusy] = React.useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = React.useState('+353');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [otpInput, setOtpInput] = React.useState('');
  const [pendingPhoneNumber, setPendingPhoneNumber] = React.useState('');
  const [safetyAlert, setSafetyAlert] = React.useState<{
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    onConfirm?: () => void;
  } | null>(null);
  const [inviteFriendsOpen, setInviteFriendsOpen] = React.useState(false);
  const [inviteSyncing, setInviteSyncing] = React.useState(false);
  const [inviteMatchedFriends, setInviteMatchedFriends] = React.useState<FacebookMatchedFriend[]>([]);
  const [contactsSyncing, setContactsSyncing] = React.useState(false);
  const [draftsOpen, setDraftsOpen] = React.useState(false);
  const [draftPendingDeleteId, setDraftPendingDeleteId] = React.useState<string | null>(null);
  const [myFeedOpen, setMyFeedOpen] = React.useState(false);
  const [myFeedSelectedPost, setMyFeedSelectedPost] = React.useState<Post | null>(null);
  const [myFeedCommentsOpen, setMyFeedCommentsOpen] = React.useState(false);
  const [myFeedCommentsPost, setMyFeedCommentsPost] = React.useState<Post | null>(null);
  const [myFeedComments, setMyFeedComments] = React.useState<Comment[]>([]);
  const [myFeedCommentsLoading, setMyFeedCommentsLoading] = React.useState(false);
  const [myFeedCommentDraft, setMyFeedCommentDraft] = React.useState('');
  const [myFeedReplyingTo, setMyFeedReplyingTo] = React.useState<string | null>(null);
  const [myFeedReplyDraft, setMyFeedReplyDraft] = React.useState('');
  const [myFeedRefreshTick, setMyFeedRefreshTick] = React.useState(0);
  const [myFeedEditedPostIds, setMyFeedEditedPostIds] = React.useState<Record<string, true>>({});
  const [myFeedOpeningPostId, setMyFeedOpeningPostId] = React.useState<string | null>(null);
  const myFeedListRef = React.useRef<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [isPrivate, setIsPrivate] = React.useState(() =>
    getEffectiveProfilePrivate(user?.handle, user?.is_private)
  );
  const [isTogglingPrivacy, setIsTogglingPrivacy] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<'name' | 'bio' | 'social' | 'personal' | 'places' | 'location' | 'interests' | 'flag' | 'followers' | 'following' | null>(null);
  const [displayName, setDisplayName] = React.useState(user?.name || '');
  const [savingDisplayName, setSavingDisplayName] = React.useState(false);
  const [followersCount, setFollowersCount] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState(0);
  const [audienceSheetOpen, setAudienceSheetOpen] = React.useState(false);
  const [audienceScope, setAudienceScope] = React.useState<ProfileConnectionScope>('followers');
  const [audienceSearch, setAudienceSearch] = React.useState('');
  const [audienceFollowers, setAudienceFollowers] = React.useState<ProfileConnectionRow[]>([]);
  const [audienceFollowing, setAudienceFollowing] = React.useState<ProfileConnectionRow[]>([]);
  const [audienceFollowMap, setAudienceFollowMap] = React.useState<Record<string, boolean>>({});
  const [audienceRequestMap, setAudienceRequestMap] = React.useState<Record<string, boolean>>({});
  const [audienceLoading, setAudienceLoading] = React.useState(false);
  const [audienceActionLoading, setAudienceActionLoading] = React.useState<Record<string, boolean>>({});
  const [dismissedSuggested, setDismissedSuggested] = React.useState<Record<string, boolean>>({});
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [preferredLocations, setPreferredLocations] = React.useState<string[]>(user?.placesTraveled ?? []);
  const [preferredLocationQuery, setPreferredLocationQuery] = React.useState('');
  const [favouritePlaces, setFavouritePlaces] = React.useState<string[]>(user?.favouritePlaces ?? []);
  const [favouritePlaceQuery, setFavouritePlaceQuery] = React.useState('');
  const [savingCard, setSavingCard] = React.useState(false);
  const [accountType, setAccountType] = React.useState<'personal' | 'business'>(user?.accountType === 'business' ? 'business' : 'personal');
  const [showProfilePictureModal, setShowProfilePictureModal] = React.useState(false);
  const [headerAvatarFailed, setHeaderAvatarFailed] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>(getNotificationPreferences());
  const [osPushOn, setOsPushOn] = React.useState(false);
  const [osPushBusy, setOsPushBusy] = React.useState(false);
  const [commentModerationPrefs, setCommentModerationPrefs] = React.useState<CommentModerationPreferences>(getCommentModerationPreferences());
  const [commentWordDraft, setCommentWordDraft] = React.useState('');
  const [hiddenCommentQueue, setHiddenCommentQueue] = React.useState<HiddenCommentReviewItem[]>([]);
  const [loadingHiddenCommentQueue, setLoadingHiddenCommentQueue] = React.useState(false);
  const [hiddenQueueFilter, setHiddenQueueFilter] = React.useState<'all' | 'comments' | 'replies'>('all');
  const quickRailRef = React.useRef<HTMLDivElement | null>(null);
  const quickRailAutoNudgingRef = React.useRef(false);
  const [showQuickRailHint, setShowQuickRailHint] = React.useState(true);
  const ownProfileHandle = React.useMemo(() => (user?.handle || '').replace(/^@/, ''), [user?.handle]);
  const normalizedOwnHandle = React.useMemo(
    () => ownProfileHandle.trim().toLowerCase(),
    [ownProfileHandle]
  );
  const myFeedPosts = React.useMemo<Post[]>(() => {
    if (!normalizedOwnHandle) return [];
    return [...posts]
      .filter((post) => (post.userHandle || '').replace(/^@/, '').trim().toLowerCase() === normalizedOwnHandle)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [normalizedOwnHandle, myFeedRefreshTick]);
  const filteredHiddenQueue = React.useMemo(() => {
    if (hiddenQueueFilter === 'comments') return hiddenCommentQueue.filter((item) => !item.isReply);
    if (hiddenQueueFilter === 'replies') return hiddenCommentQueue.filter((item) => !!item.isReply);
    return hiddenCommentQueue;
  }, [hiddenCommentQueue, hiddenQueueFilter]);

  React.useEffect(() => {
    if (!commentSafetyOpen) return;
    setCommentModerationPrefs(getCommentModerationPreferences());
    let cancelled = false;
    void (async () => {
      try {
        await getCurrentUser();
        if (!cancelled) setCommentModerationPrefs(getCommentModerationPreferences());
      } catch {
        // Keep the settings already stored in this browser.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentSafetyOpen]);

  React.useEffect(() => {
    if (!commentSafetyOpen || !user?.handle) return;
    let cancelled = false;
    (async () => {
      setLoadingHiddenCommentQueue(true);
      try {
        const items = await fetchHiddenCommentsForOwner(user.handle);
        if (!cancelled) setHiddenCommentQueue(items);
      } catch (error) {
        console.error('Error loading hidden comments queue:', error);
        if (!cancelled) setHiddenCommentQueue([]);
      } finally {
        if (!cancelled) setLoadingHiddenCommentQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commentSafetyOpen, user?.handle]);

  const saveCommentControls = async (allowComments: boolean, commentAudience: CommentAudience) => {
    const audience: CommentAudience = allowComments && commentAudience !== 'nobody' ? commentAudience : 'nobody';
    const next: CommentModerationPreferences = {
      ...commentModerationPrefs,
      allowComments: audience !== 'nobody',
      commentAudience: audience,
    };
    setCommentModerationPrefs(next);
    setCommentModerationPreferences(next);
    try {
      await updateUserCommentSettings({
        allow_comments: next.allowComments,
        comment_audience: next.commentAudience,
      });
    } catch (error) {
      console.warn('Comment settings were not saved on the server', error);
      setSafetyAlert({
        title: 'Saved on this phone',
        message: 'Comment controls are on for your posts here. The server did not update.',
        icon: 'alert',
      });
    }
  };

  React.useEffect(() => {
    const el = quickRailRef.current;
    if (!el) return;
    const onScroll = () => {
      if (quickRailAutoNudgingRef.current) return;
      if (el.scrollLeft > 8) setShowQuickRailHint(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const t = window.setTimeout(() => {
      // Gentle nudge so users notice horizontal scrolling.
      if (el.scrollWidth > el.clientWidth && el.scrollLeft < 1) {
        quickRailAutoNudgingRef.current = true;
        el.scrollTo({ left: 28, behavior: 'smooth' });
        window.setTimeout(() => {
          el.scrollTo({ left: 0, behavior: 'smooth' });
          window.setTimeout(() => {
            quickRailAutoNudgingRef.current = false;
          }, 200);
        }, 320);
      }
    }, 500);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
      quickRailAutoNudgingRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const onLocalPostCreated = () => {
      setMyFeedRefreshTick((v) => v + 1);
    };
    window.addEventListener('localPostCreated', onLocalPostCreated);
    return () => window.removeEventListener('localPostCreated', onLocalPostCreated);
  }, []);

  const closeMyFeed = React.useCallback(() => {
    setMyFeedSelectedPost(null);
    setMyFeedOpen(false);
  }, []);

  const handleDeleteMyFeedPost = React.useCallback(async () => {
    if (!myFeedSelectedPost?.id || !user?.id) return;
    const result = await Swal.fire(
      bottomSheet({
        title: 'Delete post?',
        message: "This can't be undone.",
        icon: 'alert',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
      })
    );
    if (!result.isConfirmed) return;
    try {
      await deletePost(String(user.id), myFeedSelectedPost.id, user?.handle);
      setMyFeedRefreshTick((v) => v + 1);
      setMyFeedSelectedPost(null);
    } catch (err) {
      Swal.fire(
        bottomSheet({
          title: 'Could not delete post',
          message: err instanceof Error ? err.message : 'Please try again.',
          icon: 'alert',
        })
      );
    }
  }, [myFeedSelectedPost, user?.id, user?.handle]);

  const handleDeleteMyFeedPostFromCard = React.useCallback(
    async (post: Post) => {
      if (!post?.id || !user?.id) return;
      const result = await Swal.fire(
        bottomSheet({
          title: 'Delete post?',
          message: "This can't be undone.",
          icon: 'alert',
          showCancelButton: true,
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
        })
      );
      if (!result.isConfirmed) return;
      try {
        await deletePost(String(user.id), post.id, user?.handle);
        setMyFeedRefreshTick((v) => v + 1);
        if (myFeedSelectedPost?.id === post.id) {
          setMyFeedSelectedPost(null);
        }
      } catch (err) {
        Swal.fire(
          bottomSheet({
            title: 'Could not delete post',
            message: err instanceof Error ? err.message : 'Please try again.',
            icon: 'alert',
          })
        );
      }
    },
    [myFeedSelectedPost?.id, user?.handle, user?.id]
  );

  const openMyFeedPost = React.useCallback((post: Post) => {
    setMyFeedOpeningPostId(post.id);
    const list = myFeedListRef.current;
    if (list) {
      list.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.setTimeout(() => {
      setMyFeedSelectedPost(post);
      setMyFeedOpeningPostId(null);
    }, 140);
  }, []);

  const openMyFeedComments = React.useCallback(async (post: Post) => {
    setMyFeedCommentsPost(post);
    setMyFeedCommentsOpen(true);
    setMyFeedCommentDraft('');
    setMyFeedReplyingTo(null);
    setMyFeedReplyDraft('');
    setMyFeedCommentsLoading(true);
    try {
      const rows = await fetchComments(post.id);
      setMyFeedComments(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error loading My feed comments:', error);
      setMyFeedComments([]);
    } finally {
      setMyFeedCommentsLoading(false);
    }
  }, []);

  const handleAddMyFeedComment = React.useCallback(async () => {
    if (!user?.handle || !myFeedCommentsPost?.id) return;
    const text = myFeedCommentDraft.trim();
    if (!text) return;
    try {
      const created = await addComment(myFeedCommentsPost.id, user.handle, text);
      setMyFeedComments((prev) => [...prev, created]);
      setMyFeedCommentDraft('');
      setMyFeedRefreshTick((v) => v + 1);
    } catch (error) {
      console.error('Error adding My feed comment:', error);
      showToast('Could not add comment right now.');
    }
  }, [myFeedCommentDraft, myFeedCommentsPost?.id, user?.handle]);

  const handleToggleMyFeedCommentLike = React.useCallback(async (commentId: string) => {
    const original = myFeedComments.find((c) => c.id === commentId);
    try {
      const updated = await toggleCommentLike(commentId, original);
      setMyFeedComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
    } catch (error) {
      console.error('Error toggling my feed comment like:', error);
    }
  }, [myFeedComments]);

  const handleAddMyFeedReply = React.useCallback(async () => {
    if (!myFeedCommentsPost?.id || !myFeedReplyingTo || !user?.handle) return;
    const text = myFeedReplyDraft.trim();
    if (!text) return;
    try {
      const reply = await addReply(myFeedCommentsPost.id, myFeedReplyingTo, user.handle, text);
      setMyFeedComments((prev) =>
        prev.map((c) =>
          c.id === myFeedReplyingTo
            ? {
                ...c,
                replies: [...(c.replies || []), reply],
                replyCount: (c.replyCount || 0) + 1,
              }
            : c
        )
      );
      setMyFeedReplyDraft('');
      setMyFeedReplyingTo(null);
    } catch (error) {
      console.error('Error adding my feed reply:', error);
      showToast('Could not add reply right now.');
    }
  }, [myFeedCommentsPost?.id, myFeedReplyDraft, myFeedReplyingTo, user?.handle]);

  const handleToggleMyFeedReplyLike = React.useCallback(async (parentId: string, replyId: string) => {
    const originalParent = myFeedComments.find((c) => c.id === parentId);
    try {
      const updatedParent = await toggleReplyLike(parentId, replyId, originalParent);
      setMyFeedComments((prev) => prev.map((c) => (c.id === parentId ? updatedParent : c)));
    } catch (error) {
      console.error('Error toggling my feed reply like:', error);
    }
  }, [myFeedComments]);
  
  // Location state for cascading dropdowns
  const [national, setNational] = React.useState(user?.national || '');
  const [regional, setRegional] = React.useState(user?.regional || '');
  const [local, setLocal] = React.useState(user?.local || '');
  const [regionalOptions, setRegionalOptions] = React.useState<string[]>([]);
  const [localOptions, setLocalOptions] = React.useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = React.useState(false);
  const [loadingCities, setLoadingCities] = React.useState(false);
  
  const nationalOptions = [
    // Europe
    'Ireland', 'United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Portugal', 'Greece',
    'Poland', 'Sweden', 'Austria', 'Switzerland', 'Denmark', 'Finland', 'Norway', 'Czech Republic', 'Romania', 'Hungary',
    'Croatia', 'Slovakia', 'Bulgaria', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Luxembourg', 'Malta', 'Cyprus',
    'Iceland', 'Liechtenstein', 'Monaco', 'Andorra', 'San Marino', 'Vatican City',
    
    // Americas
    'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador',
    'Guatemala', 'Cuba', 'Haiti', 'Dominican Republic', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama',
    'Uruguay', 'Paraguay', 'Bolivia', 'Jamaica', 'Trinidad and Tobago', 'Guyana', 'Suriname', 'Belize', 'Bahamas',
    'Barbados', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines', 'Antigua and Barbuda', 'Dominica',
    'Saint Kitts and Nevis',
    
    // Asia
    'China', 'India', 'Japan', 'South Korea', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Malaysia', 'Singapore',
    'Myanmar', 'Cambodia', 'Laos', 'Bangladesh', 'Pakistan', 'Afghanistan', 'Sri Lanka', 'Nepal', 'Kazakhstan', 'Uzbekistan',
    'Iraq', 'Saudi Arabia', 'United Arab Emirates', 'Israel', 'Jordan', 'Lebanon', 'Yemen', 'Oman', 'Palestine', 'Kuwait',
    'Georgia', 'Mongolia', 'Armenia', 'Qatar', 'Bahrain', 'Timor-Leste', 'Bhutan', 'Maldives', 'Brunei', 'Iran', 'Syria',
    
    // Africa
    'Nigeria', 'Ethiopia', 'Egypt', 'South Africa', 'Kenya', 'Uganda', 'Tanzania', 'Algeria', 'Sudan', 'Morocco',
    'Angola', 'Mozambique', 'Ghana', 'Madagascar', 'Cameroon', 'Ivory Coast', 'Niger', 'Burkina Faso', 'Mali', 'Malawi',
    'Zambia', 'Senegal', 'Chad', 'Somalia', 'Zimbabwe', 'Guinea', 'Rwanda', 'Benin', 'Tunisia', 'Burundi', 'South Sudan',
    'Togo', 'Sierra Leone', 'Libya', 'Eritrea', 'Central African Republic', 'Liberia', 'Mauritania', 'Namibia', 'Botswana',
    'Gambia', 'Gabon', 'Lesotho', 'Guinea-Bissau', 'Equatorial Guinea', 'Mauritius', 'Eswatini', 'Djibouti', 'Comoros',
    'Cape Verde', 'São Tomé and Príncipe', 'Seychelles',
    
    // Oceania
    'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'New Caledonia', 'French Polynesia',
    'Samoa', 'Guam', 'Kiribati', 'Micronesia', 'Tonga', 'Marshall Islands', 'Palau', 'American Samoa', 'Northern Mariana Islands',
    'Cook Islands', 'Tuvalu', 'Wallis and Futuna', 'Nauru', 'Niue', 'Tokelau', 'Pitcairn Islands'
  ];

  React.useEffect(() => {
    if (user?.bio) {
      setBio(user.bio);
    }
  }, [user?.bio]);

  React.useEffect(() => {
    setPreferredLocations(user?.placesTraveled ?? []);
  }, [user?.placesTraveled]);

  React.useEffect(() => {
    setFavouritePlaces(user?.favouritePlaces ?? []);
  }, [user?.favouritePlaces]);

  function addPreferredLocation(suggestion: LocationSuggestion) {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    const label = parsed.displayName || parsed.local || suggestion.name.split(',')[0].trim();
    if (!label) return;
    setPreferredLocations((prev) => {
      if (prev.some((p) => p.toLowerCase() === label.toLowerCase())) return prev;
      if (prev.length >= 12) return prev;
      return [...prev, label];
    });
    setPreferredLocationQuery('');
  }

  function removePreferredLocation(label: string) {
    setPreferredLocations((prev) => prev.filter((p) => p !== label));
  }

  function addFavouritePlace(suggestion: LocationSuggestion) {
    const parsed = parsedPlaceFeedFromSuggestion(suggestion);
    const label = parsed.displayName || parsed.local || suggestion.name.split(',')[0].trim();
    if (!label) return;
    setFavouritePlaces((prev) => {
      if (prev.some((p) => p.toLowerCase() === label.toLowerCase())) return prev;
      if (prev.length >= 12) return prev;
      return [...prev, label];
    });
    setFavouritePlaceQuery('');
  }

  function removeFavouritePlace(label: string) {
    setFavouritePlaces((prev) => prev.filter((p) => p !== label));
  }

  React.useEffect(() => {
    setAccountType(user?.accountType === 'business' ? 'business' : 'personal');
  }, [user?.accountType]);

  React.useEffect(() => {
    setDisplayName(user?.name || '');
  }, [user?.name]);

  React.useEffect(() => {
    if (selectedCard === 'interests') {
      setInterestsDraft((user?.interests ?? []).join(', '));
    }
    if (selectedCard === 'flag') {
      setCountryFlag(user?.countryFlag || '');
    }
  }, [selectedCard, user?.interests, user?.countryFlag]);

  const [profilePosts, setProfilePosts] = React.useState<Post[]>([]);

  React.useEffect(() => {
    if (!user?.handle && !user?.id) return;
    let cancelled = false;
    const identifier = String(user.handle || user.id);
    fetchPostsByUser(identifier, 50, user.id, 'all')
      .then((userPosts) => {
        if (!cancelled) setProfilePosts(userPosts);
      })
      .catch((error) => {
        console.error('Error loading profile posts:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.handle, user?.id]);

  const profileStats = React.useMemo(() => {
    return profilePosts.reduce(
      (totals, post) => ({
        views: totals.views + (post.stats?.views ?? 0),
        likes: totals.likes + (post.stats?.likes ?? 0),
      }),
      { views: 0, likes: 0 },
    );
  }, [profilePosts]);

  const saveDisplayName = async () => {
    if (!user) return;
    const nextName = displayName.trim();
    if (!nextName || nextName.length > 100) return;
    const oldHandle = String(user.handle || '');
    const nextHandle = nextHandleAfterNameChange({
      displayName: nextName,
      currentHandle: oldHandle,
      regional: user.regional,
      local: user.local,
    });
    const handleChanging = Boolean(oldHandle) && handleKey(oldHandle) !== handleKey(nextHandle);
    setSavingDisplayName(true);
    try {
      const ok = await persistLaravelProfile({
        display_name: nextName,
        ...(handleChanging ? { handle: nextHandle } : {}),
      });
      if (handleChanging) await renameUserHandleEverywhere(oldHandle, nextHandle);
      if (!ok) {
        login({ ...user, name: nextName, ...(handleChanging ? { handle: nextHandle } : {}) });
      }
    } catch {
      if (handleChanging) await renameUserHandleEverywhere(oldHandle, nextHandle);
      login({ ...user, name: nextName, ...(handleChanging ? { handle: nextHandle } : {}) });
    } finally {
      setSavingDisplayName(false);
      setSelectedCard(null);
    }
  };

  const saveBio = async () => {
    if (!user) return;
    setSavingCard(true);
    const bioTrim = bio.trim();
    try {
      const ok = await persistLaravelProfile({ bio: bioTrim || null });
      if (!ok) login({ ...user, bio: bioTrim || undefined });
    } catch {
      login({ ...user, bio: bioTrim || undefined });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
    }
  };

  const saveSocial = async () => {
    if (!user) return;
    setSavingCard(true);
    const nextSocial = {
      website: socialLinks.website.trim() || undefined,
      x: socialLinks.x.trim() || undefined,
      instagram: socialLinks.instagram.trim() || undefined,
      tiktok: socialLinks.tiktok.trim() || undefined,
      podcast: socialLinks.podcast.trim() || undefined,
    };
    const hasAny = Object.values(nextSocial).some(Boolean);
    try {
      const ok = await persistLaravelProfile({ social_links: nextSocial });
      if (!ok) login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
    } catch {
      login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
    }
  };

  const savePlaces = async () => {
    if (!user) return;
    setSavingCard(true);
    const traveled = preferredLocations.slice(0, 12);
    const favourites = favouritePlaces.slice(0, 12);
    try {
      await persistLaravelProfile({
        places_traveled: traveled,
        favourite_places: favourites,
      });
      login({
        ...user,
        placesTraveled: traveled.length ? traveled : undefined,
        favouritePlaces: favourites.length ? favourites : undefined,
      });
    } catch {
      login({
        ...user,
        placesTraveled: traveled.length ? traveled : undefined,
        favouritePlaces: favourites.length ? favourites : undefined,
      });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
    }
  };

  const saveLocationCard = async () => {
    if (!user || !national || !regional || !local) return;
    setSavingCard(true);
    try {
      const ok = await persistLaravelProfile({
        location_local: local,
        location_regional: regional,
        location_national: national,
      });
      if (!ok) login({ ...user, national, regional, local });
    } catch {
      login({ ...user, national, regional, local });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
      window.dispatchEvent(new CustomEvent('locationUpdated', { detail: { national, regional, local } }));
    }
  };

  const saveInterestsCard = async () => {
    if (!user) return;
    const interests = interestsDraft.split(',').map((item) => item.trim()).filter(Boolean);
    setSavingCard(true);
    try {
      const ok = await persistLaravelProfile({ interests });
      if (!ok) login({ ...user, interests: interests.length ? interests : undefined });
    } catch {
      login({ ...user, interests: interests.length ? interests : undefined });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
    }
  };

  const saveFlagCard = async () => {
    if (!user) return;
    const nextFlag = countryFlag.trim();
    setSavingCard(true);
    try {
      const ok = await persistLaravelProfile({ country_flag: nextFlag || null });
      if (!ok) login({ ...user, countryFlag: nextFlag || undefined });
    } catch {
      login({ ...user, countryFlag: nextFlag || undefined });
    } finally {
      setSavingCard(false);
      setSelectedCard(null);
    }
  };

  React.useEffect(() => {
    if (user?.socialLinks) {
      setSocialLinks({
        website: user.socialLinks.website ?? '',
        x: user.socialLinks.x ?? '',
        instagram: user.socialLinks.instagram ?? '',
        tiktok: user.socialLinks.tiktok ?? '',
        podcast: user.socialLinks.podcast ?? '',
      });
    }
  }, [user?.socialLinks]);

  React.useEffect(() => {
    setIsPrivate(getEffectiveProfilePrivate(user?.handle, user?.is_private));
  }, [user?.handle, user?.is_private]);

  // Initialize location state from user
  React.useEffect(() => {
    if (user) {
      setNational(user.national || '');
      setRegional(user.regional || '');
      setLocal(user.local || '');
    }
  }, [user?.national, user?.regional, user?.local]);

  const persistLaravelProfile = React.useCallback(
    async (patch: Parameters<typeof updateAuthProfile>[0]): Promise<boolean> => {
      const useLaravel = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!useLaravel || !token || !user) return false;
      const apiUser = await updateAuthProfile(patch);
      const fromApi = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
      const next: User = { ...user };
      for (const [key, val] of Object.entries(fromApi)) {
        if (key === 'interests' && Array.isArray(val)) {
          next.interests = val.length > 0 ? val.filter((item) => typeof item === 'string') : undefined;
          continue;
        }
        if (key === 'countryFlag') {
          next.countryFlag = typeof val === 'string' && val.trim() ? val.trim() : undefined;
          continue;
        }
        if (val === undefined || val === null) continue;
        if (key === 'placesTraveled' && Array.isArray(val)) {
          next.placesTraveled = val.length > 0 ? val : undefined;
          continue;
        }
        (next as Record<string, unknown>)[key] = val;
      }
      login(next);
      return true;
    },
    [user, login]
  );

  // Fetch regions when national selection changes or when location card opens
  React.useEffect(() => {
    if (selectedCard === 'location') {
      if (national) {
        setLoadingRegions(true);
        setRegionalOptions([]);
        // Only reset regional/local if national actually changed
        if (user?.national !== national) {
          setRegional('');
          setLocal('');
          setLocalOptions([]);
        }
        
        fetchRegionsForCountry(national)
          .then(regions => {
            setRegionalOptions(regions.map(r => r.name));
            setLoadingRegions(false);
          })
          .catch(error => {
            console.error('Error loading regions:', error);
            setLoadingRegions(false);
          });
      } else {
        setRegionalOptions([]);
        setLocalOptions([]);
      }
    }
  }, [national, selectedCard, user?.national]);

  // Fetch cities when regional selection changes or when location card opens
  React.useEffect(() => {
    if (selectedCard === 'location') {
      if (regional && national) {
        setLoadingCities(true);
        setLocalOptions([]);
        // Only reset local if regional actually changed
        if (user?.regional !== regional) {
          setLocal('');
        }
        
        fetchCitiesForRegion(regional, national)
          .then(localAreas => {
            setLocalOptions(localAreas.map(c => c.name));
            setLoadingCities(false);
          })
          .catch(error => {
            console.error('Error loading local areas:', error);
            setLoadingCities(false);
          });
      } else if (!regional) {
        setLocalOptions([]);
      }
    }
  }, [regional, national, selectedCard, user?.regional]);

  // Load collections
  React.useEffect(() => {
    if (user?.id) {
      loadCollections();
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.id) return;
    const normalizedUserId = String(user.id);
    const handleCollectionsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === normalizedUserId) {
        loadCollections();
      }
    };
    window.addEventListener('collectionsUpdated', handleCollectionsUpdated as EventListener);
    return () => window.removeEventListener('collectionsUpdated', handleCollectionsUpdated as EventListener);
  }, [user?.id]);

  React.useEffect(() => {
    loadDrafts();
  }, []);

  // Listen for unread messages count
  React.useEffect(() => {
    if (!user?.handle) return;

    const updateUnreadCount = async () => {
      try {
        const count = await getUnreadTotal(user.handle!);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    // Initialize unread count
    updateUnreadCount();

    // Poll for updates every 10 seconds
    const interval = setInterval(updateUnreadCount, 10000);

    // Listen for unread changes
    const handleUnreadChanged = (event: CustomEvent) => {
      const handle = event.detail?.handle;
      const unread = event.detail?.unread ?? 0;
      if (handle === user.handle) {
        setUnreadCount(unread);
      }
    };

    window.addEventListener('inboxUnreadChanged', handleUnreadChanged as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('inboxUnreadChanged', handleUnreadChanged as EventListener);
    };
  }, [user?.handle]);

  const refreshAudienceCounts = React.useCallback(async () => {
    if (!user?.handle && !user?.id) return;
    let followers = typeof user?.followers_count === 'number' ? user.followers_count : 0;
    let following = typeof user?.following_count === 'number' ? user.following_count : 0;
    if (isLaravelApiEnabled() && user?.handle) {
      try {
        const me = await getCurrentUser();
        const counts = mapLaravelUserToAppFields(me as Record<string, unknown>);
        if (typeof counts.followers_count === 'number') followers = counts.followers_count;
        if (typeof counts.following_count === 'number') following = counts.following_count;
        const apiAvatar = typeof counts.avatarUrl === 'string' ? counts.avatarUrl.trim() : '';
        if (apiAvatar && apiAvatar !== user.avatarUrl) {
          login({ ...user, avatarUrl: apiAvatar });
        }
      } catch (err) {
        console.error('Error loading audience counts:', err);
      }
    }
    setFollowersCount(followers);
    setFollowingCount(following);
  }, [user?.handle, user?.id, user?.followers_count, user?.following_count]);

  React.useEffect(() => {
    setHeaderAvatarFailed(false);
  }, [user?.avatarUrl]);

  React.useEffect(() => {
    void refreshAudienceCounts();
  }, [refreshAudienceCounts]);

  React.useEffect(() => {
    if (!user?.id) return;
    const handler = () => {
      void refreshAudienceCounts();
    };
    window.addEventListener('followToggled', handler);
    return () => window.removeEventListener('followToggled', handler);
  }, [user?.id, refreshAudienceCounts]);

  const suggestionViewerId = user?.id != null ? String(user.id) : String(user?.handle || '');

  React.useEffect(() => {
    if (!suggestionViewerId) return;
    try {
      const raw = localStorage.getItem(`clips_suggested_dismissed_${suggestionViewerId}`);
      const parsed = raw ? JSON.parse(raw) : {};
      setDismissedSuggested(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setDismissedSuggested({});
    }
  }, [suggestionViewerId]);

  const normalizeAudienceRows = (items: any[]): ProfileConnectionRow[] =>
    (Array.isArray(items) ? items : [])
      .map((item: any) => {
        const handleRaw = String(item?.handle || item?.userHandle || item?.username || '')
          .replace(/^@/, '')
          .trim();
        if (!handleRaw) return null;
        const avatar = typeof item?.avatar_url === 'string' ? item.avatar_url : item?.avatarUrl;
        return {
          handleNoAt: handleRaw,
          displayName: String(item?.display_name || item?.displayName || item?.name || handleRaw),
          avatarUrl: typeof avatar === 'string' ? avatar : undefined,
          isRequested: !!(item?.is_requested || item?.has_pending_request || item?.isRequested),
          isPrivate: !!(item?.is_private || item?.isPrivate),
          isFollowing:
            typeof item?.is_following_by_me === 'boolean'
              ? item.is_following_by_me
              : typeof item?.is_following === 'boolean'
                ? item.is_following
                : undefined,
        };
      })
      .filter(Boolean) as ProfileConnectionRow[];

  const loadOwnAudience = React.useCallback(async () => {
    if (!user?.handle && !user?.id) return;
    setAudienceLoading(true);
    try {
      if (!isLaravelApiEnabled() || !user?.handle) {
        setAudienceFollowers([]);
        setAudienceFollowing([]);
        setAudienceFollowMap({});
        setAudienceRequestMap({});
        return;
      }
      const [followersRes, followingRes] = await Promise.all([
        fetchFollowers(user.handle, 0, 40),
        fetchFollowing(user.handle, 0, 40),
      ]);
      const followers = normalizeAudienceRows(followersRes?.items);
      const following = normalizeAudienceRows(followingRes?.items);
      setAudienceFollowers(followers);
      setAudienceFollowing(following);
      const followPatch: Record<string, boolean> = {};
      const requestPatch: Record<string, boolean> = {};
      [...followers, ...following].forEach((row) => {
        followPatch[row.handleNoAt] = row.isFollowing === true;
        requestPatch[row.handleNoAt] = !!row.isRequested;
      });
      setAudienceFollowMap(followPatch);
      setAudienceRequestMap(requestPatch);
    } catch (err) {
      console.error('Failed to load audience lists:', err);
    } finally {
      setAudienceLoading(false);
    }
  }, [user?.handle, user?.id]);

  const openAudience = (scope: ProfileConnectionScope) => {
    setAudienceScope(scope);
    setAudienceSearch('');
    setAudienceSheetOpen(true);
    void loadOwnAudience();
    void refreshAudienceCounts();
  };

  const toggleAudienceFollow = async (entryHandle: string, nextFollowing: boolean) => {
    if (!user?.id || !user?.handle) return;
    if (audienceActionLoading[entryHandle]) return;
    const wasFollowing = audienceFollowMap[entryHandle] === true;
    setAudienceActionLoading((prev) => ({ ...prev, [entryHandle]: true }));
    try {
      const result = await followOrRequest({
        userId: String(user.id),
        targetHandle: entryHandle,
        viewerHandle: user.handle,
        nextFollowing,
        surfaceErrors: isLaravelApiEnabled(),
      });
      setAudienceFollowMap((prev) => ({ ...prev, [entryHandle]: result.following }));
      setAudienceRequestMap((prev) => ({ ...prev, [entryHandle]: result.requested }));
      if (wasFollowing !== result.following) {
        setFollowingCount((count) => Math.max(0, count + (result.following ? 1 : -1)));
      }
      void refreshAudienceCounts();
    } finally {
      setAudienceActionLoading((prev) => ({ ...prev, [entryHandle]: false }));
    }
  };

  const removeAudienceFollower = async (entryHandle: string) => {
    await removeFollower(entryHandle);
    const key = entryHandle.replace(/^@/, '').trim().toLowerCase();
    setAudienceFollowers((prev) =>
      prev.filter((row) => row.handleNoAt.replace(/^@/, '').trim().toLowerCase() !== key),
    );
    setFollowersCount((count) => Math.max(0, count - 1));
    void refreshAudienceCounts();
  };

  const dismissSuggested = (entryHandle: string) => {
    const key = entryHandle.replace(/^@/, '').trim().toLowerCase();
    if (!key) return;
    setDismissedSuggested((prev) => {
      const next = { ...prev, [key]: true };
      try {
        localStorage.setItem(`clips_suggested_dismissed_${suggestionViewerId}`, JSON.stringify(next));
      } catch {
        // The row stays hidden for this visit.
      }
      return next;
    });
  };

  const undoDismissSuggested = (entryHandle: string) => {
    const key = entryHandle.replace(/^@/, '').trim().toLowerCase();
    if (!key) return;
    setDismissedSuggested((prev) => {
      const next = { ...prev };
      delete next[key];
      try {
        localStorage.setItem(`clips_suggested_dismissed_${suggestionViewerId}`, JSON.stringify(next));
      } catch {
        // Ignore a failed write.
      }
      return next;
    });
  };

  const audienceRows = React.useMemo(() => {
    const followed = new Set<string>();
    Object.entries(audienceFollowMap).forEach(([handle, isFollowing]) => {
      if (isFollowing) followed.add(handle.replace(/^@/, '').trim().toLowerCase());
    });
    audienceFollowing.forEach((row) => followed.add(row.handleNoAt.replace(/^@/, '').trim().toLowerCase()));
    const base =
      audienceScope === 'following'
        ? audienceFollowing
        : audienceScope === 'mutual'
          ? audienceFollowers.filter((row) => audienceFollowMap[row.handleNoAt])
          : audienceScope === 'suggested'
            ? buildSuggestedConnections({
                followers: audienceFollowers,
                following: audienceFollowing,
                posts,
                viewerHandle: user?.handle,
                profileHandle: user?.handle,
                alreadyFollowing: followed,
                dismissed: dismissedSuggested,
                includeMockAuthors: !isLaravelApiEnabled(),
              })
            : audienceFollowers;
    const q = audienceSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (row) => row.handleNoAt.toLowerCase().includes(q) || row.displayName.toLowerCase().includes(q),
    );
  }, [
    audienceScope,
    audienceFollowers,
    audienceFollowing,
    audienceFollowMap,
    audienceSearch,
    dismissedSuggested,
    user?.handle,
  ]);

  async function loadCollections() {
    if (!user?.id) return;
    try {
      const userCollections = await getUserCollections(user.id);
      setCollections(userCollections);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  async function loadDrafts() {
    try {
      const userDrafts = await getDrafts();
      setDrafts(userDrafts);
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  }

  const isVideoUrl = React.useCallback((url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url), []);

  async function handleDeleteDraft(draftId: string) {
    try {
      await deleteDraft(draftId);
      await loadDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }

  function handleOpenDraft(draft: Draft) {
    setDraftsOpen(false);

    if (draft.isTextOnly) {
      nav('/create/text-only', {
        state: {
          fromDraft: true,
          draftId: draft.id,
          text: draft.textBody ?? '',
          location: draft.location ?? '',
          venue: draft.venue ?? '',
          landmark: draft.landmark ?? '',
          taggedUsers: draft.taggedUsers ?? [],
          templateId: draft.textTemplateId ?? null,
        },
      });
      return;
    }

    const firstItem = draft.mediaItems && draft.mediaItems.length > 0 ? draft.mediaItems[0] : null;
    const mediaUrl = (draft.videoUrl || firstItem?.url || '').trim();
    if (!mediaUrl) return;
    const mediaType: 'image' | 'video' =
      firstItem?.type ?? draft.mediaType ?? (mediaUrl.startsWith('data:image/') ? 'image' : 'video');

    nav('/create/gallery-preview', {
      state: {
        fromDraft: true,
        draftId: draft.id,
        draftMediaUrl: mediaUrl,
        draftMediaType: mediaType,
        draftCaption: draft.caption ?? '',
        draftLocation: draft.location ?? '',
        draftVenue: draft.venue ?? '',
        draftLandmark: draft.landmark ?? '',
        draftVideoDuration: draft.videoDuration ?? 0,
        draftMediaItems: draft.mediaItems ?? undefined,
      },
    });
  }

  const applyPrivacyState = async (newPrivacyState: boolean) => {
    if (!user) return;
    const previous = isPrivate;
    const updatedUser = { ...user, is_private: newPrivacyState };
    setIsPrivate(newPrivacyState);
    login(updatedUser);
    try {
      if (user.handle) setProfilePrivacy(user.handle, newPrivacyState);
    } catch (error) {
      console.warn('Failed to save privacy locally:', error);
    }
    if (isLaravelApiEnabled()) {
      try {
        await updateAuthProfile({ is_private: newPrivacyState });
      } catch (syncError) {
        console.warn('Failed to sync privacy setting to backend:', syncError);
        setIsPrivate(previous);
        login({ ...user, is_private: previous });
        if (user.handle) setProfilePrivacy(user.handle, previous);
        setSafetyAlert({
          title: 'Could not update privacy',
          message: 'Your account stayed the way it was. Try again.',
          icon: 'alert',
          confirmButtonText: 'OK',
        });
        return;
      }
    }
    setSafetyAlert({
      title: newPrivacyState ? 'Profile set to private' : 'Profile set to public',
      message: newPrivacyState
        ? 'Only approved followers can view your profile and send you messages.'
        : 'Anyone can view your profile and send you messages.',
      icon: 'success',
      confirmButtonText: 'Done',
    });
  };

  const handleTogglePrivacy = () => {
    if (isTogglingPrivacy || !user) return;
    const newPrivacyState = !isPrivate;
    if (!newPrivacyState) {
      setSafetyAlert({
        title: 'Set profile to public?',
        message: 'Your posts and stories will still be public on the locations news feed.',
        icon: 'alert',
        showCancelButton: true,
        confirmButtonText: 'Set to public',
        cancelButtonText: 'Cancel',
        onConfirm: () => {
          setIsTogglingPrivacy(true);
          void applyPrivacyState(false).finally(() => setIsTogglingPrivacy(false));
        },
      });
      return;
    }
    setIsTogglingPrivacy(true);
    void applyPrivacyState(true).finally(() => setIsTogglingPrivacy(false));
  };

  const handleOsPush = async (next: boolean) => {
    if (osPushBusy) return;
    if (!next) {
      setOsPushOn(false);
      setSafetyAlert({
        title: 'Notifications turned off',
        message: 'To fully block alerts, update your device settings.',
        icon: 'info',
      });
      return;
    }
    if (typeof Notification === 'undefined') {
      setOsPushOn(false);
      return;
    }
    setOsPushBusy(true);
    setOsPushOn(true);
    try {
      if (Notification.permission === 'granted') {
        setSafetyAlert({
          title: 'Notifications turned on',
          message: "You'll get updates on post boosts and activity.",
          icon: 'success',
        });
        return;
      }
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      setOsPushOn(granted);
      if (granted) {
        setSafetyAlert({
          title: 'Notifications turned on',
          message: "You'll get updates on post boosts and activity.",
          icon: 'success',
        });
      }
    } catch {
      setOsPushOn(false);
    } finally {
      setOsPushBusy(false);
    }
  };

  React.useEffect(() => {
    if (!settingsOpen || typeof Notification === 'undefined') return;
    setOsPushOn(Notification.permission === 'granted');
  }, [settingsOpen]);

  const closeSecurityModal = () => {
    setSecurityOpen(false);
    setSecurityStep('phone');
    setSecurityBusy(false);
    setPhoneCountryCode('+353');
    setPhoneInput('');
    setOtpInput('');
    setPendingPhoneNumber('');
  };

  const handleSendSecurityCode = async () => {
    if (securityBusy) return;
    const digits = phoneInput.replace(/\D+/g, '');
    if (digits.length < 7 || digits.length > 15) {
      setSafetyAlert({ title: 'Invalid number', message: 'Enter a valid phone number.', icon: 'alert' });
      return;
    }
    const fullPhone = `${phoneCountryCode}${digits}`;
    setSecurityBusy(true);
    try {
      const res = await sendPhoneVerificationCode(fullPhone);
      setPendingPhoneNumber(fullPhone);
      setSecurityStep('code');
      setOtpInput('');
      if (res.delivery === 'mock' && res.debug_code) {
        setSafetyAlert({ title: 'Demo code', message: `Use PIN ${res.debug_code}`, icon: 'info' });
      } else {
        setSafetyAlert({
          title: 'Code sent',
          message: `A verification code was sent to ${fullPhone}.`,
          icon: 'success',
        });
      }
    } catch (error: any) {
      setSafetyAlert({
        title: 'Send failed',
        message: error?.message || 'Could not verify that phone number.',
        icon: 'alert',
      });
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleVerifySecurityCode = async () => {
    if (securityBusy) return;
    const code = otpInput.replace(/\D+/g, '');
    if (code.length !== 6) {
      setSafetyAlert({ title: 'Invalid code', message: 'Enter the 6-digit code.', icon: 'alert' });
      return;
    }
    setSecurityBusy(true);
    try {
      await verifyPhoneVerificationCode(pendingPhoneNumber, code);
      closeSecurityModal();
      setSafetyAlert({ title: 'Verified', message: 'Phone verification complete.', icon: 'success' });
    } catch (error: any) {
      setSafetyAlert({
        title: 'Verification failed',
        message: error?.message || 'Could not verify that phone number.',
        icon: 'alert',
      });
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleSyncFacebookFriends = async () => {
    if (inviteSyncing) return;
    setInviteSyncing(true);
    try {
      const { accessToken } = await loginWithFacebookWeb();
      await linkFacebookAccount(accessToken);
      const result = await fetchFacebookFriendsMatches(accessToken);
      setInviteMatchedFriends(result.matched || []);
      if (!result.matched_count) {
        showToast(result.message || 'No matched Facebook friends yet.');
      } else {
        showToast(`Found ${result.matched_count} friend${result.matched_count === 1 ? '' : 's'}.`);
      }
    } catch (err: any) {
      Swal.fire(bottomSheet({
        title: 'Facebook sync failed',
        message: err?.message || 'Could not sync Facebook friends right now.',
        icon: 'alert',
      }));
    } finally {
      setInviteSyncing(false);
    }
  };

  const handleMatchContacts = async () => {
    let phones: string[] = [];
    const contactsApi = (navigator as any)?.contacts;
    if (contactsApi?.select) {
      try {
        const selected = await contactsApi.select(['tel'], { multiple: true });
        phones = (selected || [])
          .flatMap((entry: any) => Array.isArray(entry?.tel) ? entry.tel : [])
          .map((tel: any) => String(tel || '').trim())
          .filter(Boolean);
      } catch {
        // User cancelled or unsupported behavior; fallback below.
      }
    }

    if (!phones.length) {
      const input = await Swal.fire({
        title: 'Find contacts',
        input: 'textarea',
        inputLabel: 'Browser contact sync is limited. Paste phone numbers to match contacts.',
        inputPlaceholder: '+353871234567\n+447700900123',
        showCancelButton: true,
        confirmButtonText: 'Match contacts',
        cancelButtonText: 'Cancel',
        background: '#111111',
        color: '#ffffff',
        customClass: {
          popup: 'swal-bottom-sheet-popup',
          confirmButton: 'swal-bottom-sheet-confirm',
          cancelButton: 'swal-bottom-sheet-cancel',
        },
        preConfirm: (value) => {
          const parsed = String(value || '')
            .split(/[\n,]+/)
            .map((v) => v.trim())
            .filter(Boolean);
          if (!parsed.length) {
            Swal.showValidationMessage('Enter at least one phone number.');
            return null;
          }
          return parsed;
        },
      });
      if (!input.isConfirmed || !input.value) return;
      phones = input.value as string[];
    }

    setContactsSyncing(true);
    try {
      const result = await matchContactPhones(phones);
      const asFriends: FacebookMatchedFriend[] = (result.matched || []).map((m) => ({
        id: m.id,
        handle: m.handle,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        facebook_id: null,
      }));
      setInviteMatchedFriends(asFriends);
      showToast(result.matched_count
        ? `Matched ${result.matched_count} contact${result.matched_count === 1 ? '' : 's'}.`
        : 'No matched contacts yet.');
    } catch (err: any) {
      Swal.fire(bottomSheet({
        title: 'Contact match failed',
        message: err?.message || 'Could not match contacts right now.',
        icon: 'alert',
      }));
    } finally {
      setContactsSyncing(false);
    }
  };

  const handleInviteByQrOrLink = async () => {
    const apiUrl = getRuntimeEnv('VITE_API_URL') || `${window.location.origin}/api`;
    const apiOrigin = apiUrl.replace(/\/api\/?$/, '');
    const inviteUrl = `${apiOrigin}/invite/${encodeURIComponent((user?.handle || '').replace(/^@/, ''))}`;
    try {
      const qr = await QRCode.toDataURL(inviteUrl, {
        width: 220,
        margin: 1,
      });
      await Swal.fire({
        title: 'Invite by link or QR',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
            <img src="${qr}" alt="Profile QR" style="width:220px; height:220px; border-radius:12px; background:#fff; padding:6px;" />
            <div style="font-size:12px; color:#9ca3af; word-break:break-all; text-align:center;">${inviteUrl}</div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Copy link',
        cancelButtonText: 'Close',
        background: '#111111',
        color: '#ffffff',
        customClass: {
          popup: 'swal-bottom-sheet-popup',
          confirmButton: 'swal-bottom-sheet-confirm',
          cancelButton: 'swal-bottom-sheet-cancel',
        },
      }).then(async (res) => {
        if (res.isConfirmed) {
          await navigator.clipboard.writeText(inviteUrl);
          showToast('Invite link copied');
        }
      });
    } catch {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('QR unavailable, link copied instead');
    }
  };

  const handleShareInviteToWhatsApp = async () => {
    const apiUrl = getRuntimeEnv('VITE_API_URL') || `${window.location.origin}/api`;
    const apiOrigin = apiUrl.replace(/\/api\/?$/, '');
    const inviteUrl = `${apiOrigin}/invite/${encodeURIComponent((user?.handle || '').replace(/^@/, ''))}`;
    const text = `${user?.handle || 'A friend'} invited you to join Gazetteer\n\n${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareInviteToMessenger = async () => {
    const apiUrl = getRuntimeEnv('VITE_API_URL') || `${window.location.origin}/api`;
    const apiOrigin = apiUrl.replace(/\/api\/?$/, '');
    const inviteUrl = `${apiOrigin}/invite/${encodeURIComponent((user?.handle || '').replace(/^@/, ''))}`;
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(inviteUrl)}&app_id=${encodeURIComponent(getRuntimeEnv('VITE_FACEBOOK_APP_ID') || '')}&redirect_uri=${encodeURIComponent(inviteUrl)}`, '_blank', 'noopener,noreferrer');
  };

  const saveAvatarUrl = async (nextUrl: string | undefined) => {
    if (!user) return;
    const persistable = !!nextUrl && /^https?:\/\//i.test(nextUrl.trim());
    if (isLaravelApiEnabled() && (nextUrl === undefined || persistable)) {
      const apiUser = await updateAuthProfile({
        avatar_url: persistable ? nextUrl : null,
      });
      const fields = mapLaravelUserToAppFields(apiUser as Record<string, unknown>);
      login({
        ...user,
        ...fields,
        avatarUrl: (typeof fields.avatarUrl === 'string' && fields.avatarUrl) || (persistable ? nextUrl : undefined),
      });
      return;
    }
    login({ ...user, avatarUrl: nextUrl });
  };

  const handleProfilePictureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setSafetyAlert({ title: 'Invalid file', message: 'Please choose an image file.', icon: 'alert' });
      return;
    }
    setIsUpdatingProfile(true);
    try {
      let nextAvatarUrl = '';
      if (isLaravelApiEnabled()) {
        try {
          const upload = await uploadFile(file);
          nextAvatarUrl = String(upload?.fileUrl || upload?.url || '').trim();
        } catch {
          // Keep a local preview when the upload does not reach the server.
        }
      }
      if (!nextAvatarUrl) {
        nextAvatarUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Could not read that image.'));
          reader.readAsDataURL(file);
        });
      }
      await saveAvatarUrl(nextAvatarUrl);
      setShowProfilePictureModal(false);
    } catch (error) {
      setSafetyAlert({
        title: 'Update failed',
        message: error instanceof Error ? error.message : 'Could not update profile picture.',
        icon: 'alert',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const removeProfilePicture = () => {
    if (!user?.avatarUrl) return;
    setSafetyAlert({
      title: 'Remove photo?',
      message: 'Your profile will show your initials instead.',
      icon: 'alert',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        setIsUpdatingProfile(true);
        void saveAvatarUrl(undefined)
          .then(() => setShowProfilePictureModal(false))
          .catch((error: unknown) => {
            setSafetyAlert({
              title: 'Update failed',
              message: error instanceof Error ? error.message : 'Could not remove profile picture.',
              icon: 'alert',
            });
          })
          .finally(() => setIsUpdatingProfile(false));
      },
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Not Signed In</h2>
          <p className="text-gray-400 mb-4">Please sign in to view your profile</p>
          <button
            onClick={() => nav('/login')}
            className="px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const headerAvatarRaw = profilePosts.find((post) => typeof post.avatarUrl === 'string' && post.avatarUrl.trim())?.avatarUrl;
  const headerAvatar = rewriteMediaUrlForClient(String(user?.avatarUrl || headerAvatarRaw || '').trim());

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(180deg, #000000 0%, #23104F 100%)' }}
    >
      <div className="sticky top-0 z-[100]" style={{ background: 'linear-gradient(180deg, #000000 0%, #120828 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 border-b border-white/20 pb-3">
            <button
              type="button"
              onClick={() => setShowProfilePictureModal(true)}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[rgba(2,11,38,0.75)]"
              aria-label="Profile photo"
            >
              {headerAvatar && !headerAvatarFailed ? (
                <img
                  src={headerAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setHeaderAvatarFailed(true)}
                />
              ) : (
                <FiUser className="h-5 w-5 text-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setDisplayName(user?.name || '');
                setEditHubOpen(true);
                setSelectedCard('name');
              }}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1"
              aria-label="Edit display name"
            >
              <h1 className="truncate text-xl font-bold text-white" title={user?.name}>
                {user?.name || 'Passport'}
              </h1>
              <FiEdit3 className="h-4 w-4 shrink-0 text-white" />
            </button>

            <button
              type="button"
              onClick={handleTogglePrivacy}
              disabled={isTogglingPrivacy}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-[rgba(2,11,38,0.75)] disabled:opacity-45"
              title={isPrivate ? 'Profile is private - Click to make public' : 'Profile is public - Click to make private'}
              aria-label={isPrivate ? 'Make profile public' : 'Make profile private'}
            >
              {isPrivate ? (
                <FiLock className="h-[22px] w-[22px] text-white" />
              ) : (
                <FiUnlock className="h-[22px] w-[22px] text-white" />
              )}
            </button>
          </div>

          <div className="relative border-t border-[#1F2937]">
            <div
              ref={quickRailRef}
              className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-1 py-3"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCreateGroupOpen(true);
                }}
                className="shrink-0 flex min-h-[44px] items-center gap-2 rounded-xl border border-white/30 bg-white/[0.08] px-3.5 py-2 text-white"
                style={{ scrollSnapAlign: 'start' }}
                title="Create a group chat"
              >
                <FiUsers className="w-4 h-4" />
                <span className="text-xs font-semibold">New group</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  nav('/inbox');
                }}
                className="relative shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiMessageCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Messages</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSettingsOpen(false);
                  setCommentSafetyOpen(false);
                  setCollectionsOpen(false);
                  loadDrafts();
                  setDraftsOpen(true);
                }}
                className="relative shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiFileText className="w-4 h-4" />
                <span className="text-xs font-semibold">Drafts</span>
                {drafts.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                    {drafts.length > 9 ? '9+' : drafts.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCollectionsOpen(false);
                  setDraftsOpen(false);
                  setSettingsOpen(false);
                  setCommentSafetyOpen(true);
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-amber-300/40 bg-amber-900/30 text-amber-100 hover:bg-amber-900/45 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiShield className="h-5 w-5 text-[#FBBF24]" />
                <span className="text-xs font-semibold">Comment Safety</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSettingsOpen(false);
                  setCommentSafetyOpen(false);
                  setSecurityStep('phone');
                  setSecurityOpen(true);
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-300/40 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-900/45 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiShield className="h-5 w-5 text-[#6EE7B7]" />
                <span className="text-xs font-semibold text-[#D1FAE5]">Security</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCollectionsOpen(false);
                  setDraftsOpen(false);
                  setCommentSafetyOpen(false);
                  setSettingsOpen(true);
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiSettings className="w-4 h-4" />
                <span className="text-xs font-semibold">Settings</span>
              </button>
            </div>
            {showQuickRailHint && (
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-12 items-center justify-center bg-gradient-to-l from-black to-transparent">
                <span className="flex flex-col items-center rounded-[14px] border border-white/25 bg-[rgba(15,23,42,0.96)] px-2 py-2 text-[11px] font-semibold text-white">
                  Swipe
                  <span aria-hidden>›</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="max-w-2xl mx-auto px-6 py-4">
        {/* Profile Picture Modal */}
        {showProfilePictureModal && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-6">
            <button
              type="button"
              className="absolute inset-0 bg-black/80"
              aria-label="Close profile photo"
              onClick={() => setShowProfilePictureModal(false)}
            />
            <div className="relative flex w-full max-w-[320px] flex-col items-center gap-5">
              <button
                type="button"
                onClick={() => setShowProfilePictureModal(false)}
                className="absolute -top-2 right-0 rounded-full bg-white/[0.12] p-2 text-white"
                aria-label="Close"
              >
                <FiX className="h-6 w-6" />
              </button>
              <div className="h-48 w-48 overflow-hidden rounded-full border-4 border-[#374151] bg-[#1F2937]">
                {headerAvatar && !headerAvatarFailed ? (
                  <img src={headerAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1F2937] text-6xl font-bold text-[#F3F4F6]">
                    {(user.name || user.handle || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <label className={`flex min-w-[140px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 bg-[#111827] px-6 py-3 text-[#F3F4F6] ${isUpdatingProfile ? 'pointer-events-none opacity-70' : ''}`}>
                <FiCamera className="h-[22px] w-[22px]" />
                <span className="text-sm font-semibold">{isUpdatingProfile ? 'Saving...' : 'Change'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleProfilePictureSelect(event)}
                  className="hidden"
                  disabled={isUpdatingProfile}
                />
              </label>
              {user.avatarUrl ? (
                <button
                  type="button"
                  onClick={removeProfilePicture}
                  disabled={isUpdatingProfile}
                  className="py-2 text-sm font-semibold text-[#F87171] disabled:opacity-70"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="mb-4 px-2 text-center">
          <p className="text-xl font-bold text-white">{user?.name || user?.handle}</p>
          <p className="mt-0.5 text-[15px] text-[#E2E8F0]">{user?.handle}</p>
          {user?.accountType === 'business' ? (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.12)] px-2 py-1 text-xs font-semibold text-[#FBBF24]">
              Business account
            </span>
          ) : null}
          {bio.trim() ? (
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-white/90">{bio}</p>
          ) : null}
        </div>

        <div className="mb-4 flex gap-1.5">
          {[
            { key: 'posts', label: 'Posts', value: formatProfileStatCount(profilePosts.length) },
            { key: 'views', label: 'Views', value: formatProfileStatCount(profileStats.views) },
            { key: 'likes', label: 'Likes', value: formatProfileStatCount(profileStats.likes) },
          ].map((stat) => (
            <div
              key={stat.key}
              className="flex flex-1 flex-col items-center rounded-[14px] border border-white/20 bg-[rgba(2,11,38,0.75)] px-0.5 py-2.5"
            >
              <div className="text-base font-bold text-white">{stat.value}</div>
              <div className="mt-0.5 text-[11px] text-[#E2E8F0]">{stat.label}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => openAudience('followers')}
            className="flex flex-1 flex-col items-center rounded-[14px] border border-white/20 bg-[rgba(2,11,38,0.75)] px-0.5 py-2.5"
          >
            <div className="text-base font-bold text-white">{followersCount}</div>
            <div className="mt-0.5 text-[11px] text-[#E2E8F0]">Followers</div>
          </button>
          <button
            type="button"
            onClick={() => openAudience('following')}
            className="flex flex-1 flex-col items-center rounded-[14px] border border-white/20 bg-[rgba(2,11,38,0.75)] px-0.5 py-2.5"
          >
            <div className="text-base font-bold text-white">{followingCount}</div>
            <div className="mt-0.5 text-[11px] text-[#E2E8F0]">Following</div>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setEditHubOpen(true)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-bold text-[#0A194E]"
        >
          <FiEdit3 className="h-4 w-4" />
          Edit Profile
        </button>

        <div className="mb-1 flex items-center justify-center gap-8 border-t border-white/20 py-3">
          <button
            type="button"
            onClick={() => setPassportTab('posts')}
            className={passportTab === 'posts' ? 'border-b-2 border-white px-5 py-2 text-white' : 'px-5 py-2 text-[#94A3B8]'}
            aria-label="Posts grid"
          >
            <FiGrid className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPassportTab('collections')}
            className={passportTab === 'collections' ? 'border-b-2 border-white px-5 py-2 text-white' : 'px-5 py-2 text-[#94A3B8]'}
            aria-label="Collections"
          >
            <FiBookmark className="h-5 w-5" />
          </button>
        </div>

        {passportTab === 'posts' ? (
          profilePosts.length === 0 ? (
            <p className="py-12 text-center text-[#6B7280]">No posts yet</p>
          ) : (
            <div className="grid grid-cols-3">
              {profilePosts.map((post) => {
                const imageUri = profileGridImage(post);
                const bodyText = getPostBodyText(post);
                const videoPost = isVideoPost(post);
                const card = isTextCardStyleId(post.cardStyle) ? TEXT_CARD_STYLES[post.cardStyle] : null;
                const textColor = card?.textColor || getTextOnlyTextColor(post);
                const views = formatViewCount(profilePostViews(post));
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => nav(`/post/${encodeURIComponent(post.id)}`, { state: { post } })}
                    className="aspect-[3/4] p-[1.5px]"
                  >
                    <span className="relative flex h-full w-full overflow-hidden rounded-lg border border-white/10 bg-[#111827]">
                      {imageUri ? (
                        <img src={imageUri} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : videoPost ? (
                        <span className="flex h-full w-full items-center justify-center">
                          <FiPlay className="h-5 w-5 text-white" />
                        </span>
                      ) : isTextOnlyPost(post) || bodyText ? (
                        <span
                          className="flex h-full w-full items-start p-1.5 text-left text-[10px] font-semibold leading-[13px]"
                          style={{
                            color: textColor,
                            background: card && card.colors.length >= 2
                              ? `linear-gradient(180deg, ${card.colors.join(', ')})`
                              : card?.colors[0] || getTextOnlyBackgroundColor(post),
                          }}
                        >
                          <span className="line-clamp-4">{bodyText || 'Post'}</span>
                        </span>
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[#6B7280]">
                          <FiImage className="h-5 w-5" />
                        </span>
                      )}
                      <span className="absolute bottom-2 left-2 z-[2] inline-flex items-center gap-1 rounded-lg bg-black/45 px-1.5 py-0.5 text-[11px] font-bold text-white">
                        <FiEye className="h-3 w-3" />
                        {views}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : collections.length === 0 ? (
          <p className="py-12 text-center text-[#6B7280]">No collections yet</p>
        ) : (
          <div className="flex flex-wrap px-2.5 pb-4 pt-2">
            {collections.map((collection) => {
              const postCount = collection.postIds?.length || 0;
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => nav(`/collection/${encodeURIComponent(String(collection.id))}`, {
                    state: { collectionName: collection.name, initialCollection: collection },
                  })}
                  className="w-1/2 p-1.5 text-left"
                >
                  <span className="block overflow-hidden rounded-2xl border border-white/15 bg-[rgba(2,11,38,0.75)]">
                    <span className="block aspect-square overflow-hidden bg-[#111827]">
                      <CollectionCoverThumb
                        collection={collection}
                        posts={profilePosts}
                        className="h-full w-full"
                        iconClassName="h-7 w-7 text-[#94A3B8]"
                      />
                    </span>
                    <span className="block px-2.5 pb-2.5 pt-2">
                      <span className="block truncate text-sm font-bold text-white">{collection.name}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-[#94A3B8]">
                        {postCount} {postCount === 1 ? 'post' : 'posts'}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <ProfileConnectionsSheet
          visible={audienceSheetOpen}
          onClose={() => setAudienceSheetOpen(false)}
          scope={audienceScope}
          onScopeChange={setAudienceScope}
          search={audienceSearch}
          onSearchChange={setAudienceSearch}
          rows={audienceRows}
          loading={audienceLoading}
          viewerHandle={user?.handle}
          followMap={audienceFollowMap}
          requestMap={audienceRequestMap}
          actionLoadingMap={audienceActionLoading}
          onToggleFollow={toggleAudienceFollow}
          onRemoveFollower={removeAudienceFollower}
          onDismissSuggested={dismissSuggested}
          onUndoDismissSuggested={undoDismissSuggested}
          onOpenProfile={(handle) => {
            setAudienceSheetOpen(false);
            nav(`/user/${encodeURIComponent(handle)}`);
          }}
        />

        {editHubOpen ? (
          <div
            className="fixed inset-0 z-[80] flex items-end"
            style={{ background: 'rgba(3, 9, 27, 0.55)' }}
            onClick={() => setEditHubOpen(false)}
          >
            <div
              className="max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border border-white/20 bg-[#03091B]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/[0.28]" />
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <h2 className="text-lg font-bold text-white">Edit Profile</h2>
                <button
                  type="button"
                  onClick={() => setEditHubOpen(false)}
                  className="text-white"
                  aria-label="Close edit profile"
                >
                  <FiX className="h-[22px] w-[22px]" />
                </button>
              </div>
              <div className="px-4 pb-7">
                {[
                  { label: 'Change Profile Picture', icon: <FiUser className="h-[18px] w-[18px]" />, onClick: () => { setEditHubOpen(false); setShowProfilePictureModal(true); } },
                  { label: 'Change Cover', icon: <FiImage className="h-[18px] w-[18px]" />, onClick: () => { setEditHubOpen(false); nav('/profile/cover'); } },
                  { label: 'Name', icon: <FiUser className="h-[18px] w-[18px]" />, onClick: () => { setDisplayName(user?.name || ''); setSelectedCard('name'); } },
                  { label: 'Bio', icon: <FiEdit3 className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('bio') },
                  { label: 'Social Links', icon: <FiLink2 className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('social') },
                  { label: 'Location', icon: <FiMapPin className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('location') },
                  { label: 'Places', icon: <FiMap className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('places') },
                  { label: 'Interests', icon: <FiHeart className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('interests') },
                  { label: 'Country Flag', icon: <FiFlag className="h-[18px] w-[18px]" />, onClick: () => setSelectedCard('flag') },
                ].map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={row.onClick}
                    className="mb-1 flex w-full items-center gap-2.5 rounded-[14px] border border-white/20 bg-[rgba(2,11,38,0.75)] px-3.5 py-3 text-left text-[15px] font-bold text-white"
                  >
                    {row.icon}
                    {row.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Sheet Modal */}
      {selectedCard && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[90] bg-black/55"
              onClick={() => setSelectedCard(null)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[90] flex max-h-[85vh] flex-col rounded-t-[20px] border border-white/[0.08] bg-[#0b1220]">
              <div className="flex shrink-0 justify-center pt-2 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/25" />
              </div>
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="min-w-0 flex-1 pr-2 text-lg font-bold text-white">
                  {selectedCard === 'name' && 'Edit name'}
                  {selectedCard === 'bio' && 'Edit Bio'}
                  {selectedCard === 'social' && 'Social Links'}
                  {selectedCard === 'personal' && 'Account & preferred locations'}
                  {selectedCard === 'places' && 'Places'}
                  {selectedCard === 'location' && 'Location Settings'}
                  {selectedCard === 'interests' && 'Interests'}
                  {selectedCard === 'flag' && 'Country Flag'}
                  {selectedCard === 'followers' && 'Followers'}
                  {selectedCard === 'following' && 'Following'}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedCard(null)}
                  className="shrink-0 text-white"
                  aria-label="Close"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-7">
                {selectedCard === 'name' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">Display name</label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        maxLength={100}
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        Shown on your passport and across Gazetteer. Your @handle updates with this name. {displayName.trim().length}/100
                      </p>
                    </div>
                    {user?.handle ? (
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">Handle preview</label>
                        <input
                          readOnly
                          value={`@${nextHandleAfterNameChange({
                            displayName: displayName.trim() || displayName,
                            currentHandle: user.handle,
                            regional: user.regional,
                            local: user.local,
                          })}`}
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white opacity-55"
                        />
                        <p className="mt-1.5 text-xs text-[#6B7280]">Saving renames your handle everywhere (feed, posts, profile)</p>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveDisplayName()}
                      disabled={savingDisplayName || !displayName.trim() || displayName.trim().length > 100}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingDisplayName ? 'Saving...' : 'Save name'}
                    </button>
                  </div>
                )}

                {/* Bio Form */}
                {selectedCard === 'bio' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        maxLength={220}
                        className="min-h-[120px] w-full resize-none rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                        rows={6}
                      />
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        This will be visible on your profile
                      </p>
                    </div>
                    {user?.email ? (
                      <div>
                        <label className="mb-1.5 mt-2 block text-[13px] font-semibold text-[#D1D5DB]">
                          Email
                        </label>
                        <input
                          type="email"
                          value={user.email}
                          disabled
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white opacity-55"
                        />
                        <p className="mt-1.5 text-xs text-[#6B7280]">
                          Email cannot be changed
                        </p>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void saveBio()}
                      disabled={savingCard}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save Bio'}
                    </button>
                  </div>
                )}

                {/* Social Links Form */}
                {selectedCard === 'social' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Website
                      </label>
                      <input
                        type="text"
                        value={socialLinks.website}
                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        X (Twitter)
                      </label>
                      <input
                        type="text"
                        value={socialLinks.x}
                        onChange={(e) => setSocialLinks({ ...socialLinks, x: e.target.value })}
                        placeholder="@username"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Instagram
                      </label>
                      <input
                        type="text"
                        value={socialLinks.instagram}
                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        placeholder="@username"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        TikTok
                      </label>
                      <input
                        type="text"
                        value={socialLinks.tiktok}
                        onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                        placeholder="@username"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Podcast
                      </label>
                      <input
                        type="text"
                        value={socialLinks.podcast}
                        onChange={(e) => setSocialLinks({ ...socialLinks, podcast: e.target.value })}
                        placeholder="https://open.spotify.com/show/..."
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveSocial()}
                      disabled={savingCard}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save Social Links'}
                    </button>
                  </div>
                )}

                {/* Travel Info Form */}
                {selectedCard === 'personal' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Account Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountType('personal')}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            accountType === 'personal'
                              ? 'border-[#f472b6] bg-[rgba(244,114,182,0.12)] text-[#FBCFE8]'
                              : 'border-white/15 bg-white/[0.04] text-[#D1D5DB]'
                          }`}
                        >
                          Personal
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType('business')}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            accountType === 'business'
                              ? 'border-[#f472b6] bg-[rgba(244,114,182,0.12)] text-[#FBCFE8]'
                              : 'border-white/15 bg-white/[0.04] text-[#D1D5DB]'
                          }`}
                        >
                          Business
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        Business accounts are eligible for local business suggestion cards.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Preferred locations for suggestions
                      </label>
                      <p className="mb-2 text-xs text-[#6B7280]">
                        Optional — places you like or have visited. Your main feed still follows your home location.
                      </p>
                      <PlaceAutocompleteField
                        value={preferredLocationQuery}
                        onChange={setPreferredLocationQuery}
                        onSelectSuggestion={addPreferredLocation}
                        mode="location"
                        showIcon
                        placeholder="Search city or neighborhood"
                        inputClassName="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] py-3 pl-10 pr-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                      {preferredLocations.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {preferredLocations.map((place) => (
                            <span
                              key={place}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[13px] text-[#E5E7EB]"
                            >
                              {place}
                              <button
                                type="button"
                                onClick={() => removePreferredLocation(place)}
                                className="text-[#9CA3AF]"
                                aria-label={`Remove ${place}`}
                              >
                                <FiX className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        {preferredLocations.length}/12 added. Pick from search suggestions.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const places = preferredLocations.slice(0, 12);
                        try {
                          const ok = await persistLaravelProfile({
                            places_traveled: places,
                            account_type: accountType,
                            is_business: accountType === 'business',
                          });
                          if (!ok) login({ ...user, placesTraveled: places.length ? places : undefined, accountType });
                        } catch {
                          Swal.fire(
                            bottomSheet({
                              title: 'Could not save',
                              message: 'Preferences were saved on this device only.',
                              icon: 'alert',
                            })
                          );
                          login({ ...user, placesTraveled: places.length ? places : undefined, accountType });
                        }
                        setSelectedCard(null);
                      }}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      Save preferences
                    </button>
                  </div>
                )}

                {selectedCard === 'places' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">Places traveled</label>
                      <p className="mt-1.5 text-xs text-[#6B7280]">Cities and places you have been. Visitors see this list on your Places pill.</p>
                      <PlaceAutocompleteField
                        value={preferredLocationQuery}
                        onChange={setPreferredLocationQuery}
                        onSelectSuggestion={addPreferredLocation}
                        mode="location"
                        showIcon
                        placeholder="Search a city or place"
                        inputClassName="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] py-3 pl-10 pr-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                      {preferredLocations.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {preferredLocations.map((place) => (
                            <span key={place} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[13px] text-[#E5E7EB]">
                              {place}
                              <button type="button" onClick={() => removePreferredLocation(place)} className="text-[#9CA3AF]" aria-label={`Remove ${place}`}>
                                <FiX className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-[#6B7280]">{preferredLocations.length}/12 added.</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">Favourite places</label>
                      <p className="mt-1.5 text-xs text-[#6B7280]">Places you want to highlight. Visitors see these under the same Places pill.</p>
                      <PlaceAutocompleteField
                        value={favouritePlaceQuery}
                        onChange={setFavouritePlaceQuery}
                        onSelectSuggestion={addFavouritePlace}
                        mode="location"
                        showIcon
                        placeholder="Search a city or place"
                        inputClassName="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] py-3 pl-10 pr-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                      {favouritePlaces.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {favouritePlaces.map((place) => (
                            <span key={place} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[13px] text-[#E5E7EB]">
                              {place}
                              <button type="button" onClick={() => removeFavouritePlace(place)} className="text-[#9CA3AF]" aria-label={`Remove ${place}`}>
                                <FiX className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-xs text-[#6B7280]">{favouritePlaces.length}/12 added.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void savePlaces()}
                      disabled={savingCard}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save places'}
                    </button>
                  </div>
                )}

                {/* Location Form */}
                {selectedCard === 'location' && (
                  <div className="space-y-4">
                    {/* National (Country) - First */}
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Country
                      </label>
                      <select
                        value={national}
                        onChange={(e) => {
                          setNational(e.target.value);
                        }}
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white focus:outline-none"
                      >
                        <option value="">Select a country</option>
                        {nationalOptions.map(country => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Regional (State/Province/City) - Second */}
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Region / State
                      </label>
                      {loadingRegions ? (
                        <div className="flex w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="ml-2 text-sm text-gray-500">Loading regions...</span>
                        </div>
                      ) : regionalOptions.length > 0 ? (
                        <select
                          value={regional}
                          onChange={(e) => {
                            setRegional(e.target.value);
                          }}
                          disabled={!national}
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select a region</option>
                          {regionalOptions.map(region => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </select>
                      ) : national ? (
                        <input
                          type="text"
                          value={regional}
                          onChange={(e) => setRegional(e.target.value)}
                          placeholder="e.g., Dublin, Paris, London"
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={regional}
                          onChange={(e) => setRegional(e.target.value)}
                          placeholder="Select country first"
                          disabled
                          className="w-full cursor-not-allowed rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white opacity-55 placeholder:text-[#6B7280]"
                        />
                      )}
                    </div>

                    {/* Local (Neighborhood/Town) - Last */}
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Local area
                      </label>
                      {loadingCities ? (
                        <div className="flex w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="ml-2 text-sm text-gray-500">Loading local areas...</span>
                        </div>
                      ) : localOptions.length > 0 ? (
                        <select
                          value={local}
                          onChange={(e) => {
                            setLocal(e.target.value);
                          }}
                          disabled={!regional}
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select a local area</option>
                          {localOptions.map(area => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      ) : regional ? (
                        <input
                          type="text"
                          value={local}
                          onChange={(e) => setLocal(e.target.value)}
                          placeholder="e.g., Finglas, Montmartre, Camden"
                          className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={local}
                          onChange={(e) => setLocal(e.target.value)}
                          placeholder="Select region first"
                          disabled
                          className="w-full cursor-not-allowed rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white opacity-55 placeholder:text-[#6B7280]"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveLocationCard()}
                      disabled={savingCard || !national || !regional || !local}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save Location'}
                    </button>
                  </div>
                )}

                {/* Interests Form */}
                {selectedCard === 'interests' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Interests (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={interestsDraft}
                        onChange={(e) => setInterestsDraft(e.target.value)}
                        placeholder="e.g., Technology, Travel, Food"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        Separate multiple interests with commas
                      </p>
                    </div>
                    {interestsDraft.split(',').map((item) => item.trim()).filter(Boolean).length > 0 && (
                      <div>
                        <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                          Current Interests
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {interestsDraft.split(',').map((item) => item.trim()).filter(Boolean).map((interest, index) => (
                            <span
                              key={index}
                              className="px-3 py-1.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-medium rounded-full"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void saveInterestsCard()}
                      disabled={savingCard}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save Interests'}
                    </button>
                  </div>
                )}

                {/* Country Flag Form */}
                {selectedCard === 'flag' && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Pick a flag
                      </label>
                      <div className="grid grid-cols-8 gap-2">
                        {['IE', 'GB', 'FR', 'ES', 'IT', 'DE', 'PT', 'NL', 'US', 'CA', 'BR', 'MX', 'AU', 'NZ', 'JP', 'CN', 'IN', 'PK', 'ZA', 'KE', 'EG', 'TR', 'RU', 'UA'].map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setCountryFlag(f)}
                            className={`flex h-12 items-center justify-center rounded-md px-1 ${countryFlag === f ? 'bg-[rgba(244,114,182,0.12)] ring-2 ring-[#f472b6]' : 'bg-white/[0.04]'}`}
                            aria-label={`Select flag ${f}`}
                          >
                            <Flag value={f} size={24} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-semibold text-[#D1D5DB]">
                        Or paste your flag emoji
                      </label>
                      <input
                        value={countryFlag}
                        onChange={(e) => setCountryFlag(e.target.value)}
                        maxLength={8}
                        placeholder="🇮🇪"
                        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none text-2xl"
                      />
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        This flag shows beside your handle on feed and profile.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveFlagCard()}
                      disabled={savingCard}
                      className="mt-4 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#111827] disabled:opacity-45"
                    >
                      {savingCard ? 'Saving...' : 'Save Flag'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {draftsOpen && (
          <div className="fixed inset-0 z-[240] flex items-end justify-center" onClick={() => setDraftsOpen(false)}>
            <div className="absolute inset-0 bg-black/55" />
            <div
              className="relative flex h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-b-0 border-[rgba(244,114,182,0.35)] bg-[#0B0E14]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-center pt-2">
                <div className="h-1 w-10 rounded-full bg-white/30" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-7">
                <div
                  className="mb-3.5 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, rgba(244,114,182,0), rgba(244,114,182,0.7), rgba(244,114,182,0))' }}
                />
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">Drafts</h2>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-[rgba(244,114,182,0.4)] bg-[rgba(244,114,182,0.18)] px-2 py-0.5 text-[13px] font-bold text-[#FBCFE8]">
                      {drafts.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white"
                    aria-label="Close drafts"
                  >
                    <FiX className="h-[22px] w-[22px]" />
                  </button>
                </div>
                {drafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-12">
                    <FiFileText className="h-9 w-9 text-white/45" />
                    <p className="text-[15px] text-white/60">No drafts saved yet</p>
                  </div>
                ) : (
                  drafts.map((draft) => {
                    const place = draftPlace(draft);
                    const when = formatDraftDate(draft.updatedAt || draft.createdAt);
                    const header = [when, place].filter(Boolean).join(' · ');
                    const preview = draftPreview(draft);
                    const visual = draftVisual(draft);
                    return (
                      <div
                        key={draft.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenDraft(draft)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleOpenDraft(draft);
                          }
                        }}
                        className="mb-2.5 flex w-full items-stretch gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-[18px] text-left"
                        aria-label="Resume draft"
                      >
                        {visual ? (
                          <span className="flex h-12 w-12 shrink-0 self-center overflow-hidden rounded-[10px] bg-[#151922]">
                            {visual.type === 'video' && !visual.poster ? (
                              <video src={visual.uri} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                            ) : (
                              <img src={visual.poster || visual.uri} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                        ) : null}
                        <span className="flex min-w-0 flex-1 flex-col justify-center">
                          {header ? <span className="mb-1 truncate text-xs text-[#9CA3AF]">{header}</span> : null}
                          <span className={`line-clamp-2 text-[15px] leading-5 ${preview === 'No caption yet' ? 'font-semibold text-[#6B7280]' : 'font-bold text-white'}`}>
                            {preview}
                          </span>
                        </span>
                        <span className="flex min-h-[76px] flex-col items-end justify-between py-0.5">
                          <span className="rounded-full bg-white px-2.5 py-1.5 text-xs font-bold text-[#0B0E14]">Resume</span>
                          <button
                            type="button"
                            aria-label="Delete draft"
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(239,68,68,0.16)] text-[#FCA5A5]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDraftPendingDeleteId(draft.id);
                            }}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {draftPendingDeleteId ? (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 px-6">
            <button type="button" className="absolute inset-0" aria-label="Cancel delete" onClick={() => setDraftPendingDeleteId(null)} />
            <div className="relative w-full max-w-[360px] rounded-[18px] border border-[#2A2F3D] bg-[#161B22] px-5 pb-4 pt-[22px] text-center">
              <div className="mx-auto mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[rgba(229,57,53,0.16)] text-[#FF8A80]">
                <FiTrash2 className="h-[22px] w-[22px]" />
              </div>
              <h2 className="text-[19px] font-bold text-white">Delete draft?</h2>
              <p className="mt-2 text-sm leading-5 text-[#8B949E]">
                This draft will be permanently removed from your phone. This action cannot be undone.
              </p>
              <button
                type="button"
                className="mt-[18px] w-full rounded-xl bg-[#E53935] py-[13px] text-[15px] font-bold text-white"
                onClick={() => {
                  const draftId = draftPendingDeleteId;
                  setDraftPendingDeleteId(null);
                  if (draftId) void handleDeleteDraft(draftId);
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-[#21262D] py-[13px] text-[15px] font-semibold text-[#E6EDF3]"
                onClick={() => setDraftPendingDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {/* My Feed Modal */}
        {myFeedOpen && (
          <div className="fixed inset-0 z-[220] bg-[#020617]">
            <div
              ref={myFeedListRef}
              className="h-full overflow-y-auto"
            >
              <div className="sticky top-0 z-30 bg-[#020617]/95 backdrop-blur border-b border-white/10 px-4 py-3">
                <div className="mx-auto w-full max-w-2xl flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <img src={splashLogo} alt="Gazetteer" className="w-8 h-8 object-contain rounded-lg bg-white/5 p-1" />
                    <h2 className="text-xl font-bold text-gray-100">My feed</h2>
                  </div>
                  <button onClick={closeMyFeed} className="p-2 bg-white text-black hover:bg-gray-100 rounded-full transition-colors" aria-label="Close My Feed">
                    <FiX className="w-6 h-6 text-black" />
                  </button>
                </div>
              </div>
              <div className="mx-auto w-full max-w-2xl p-4 pb-10">
                {myFeedOpeningPostId && (
                  <div className="mb-3 text-xs font-semibold text-sky-200 bg-sky-500/15 border border-sky-400/30 rounded-lg px-3 py-2">
                    Opening post...
                  </div>
                )}
                {myFeedPosts.length > 0 ? (
                  <div className="space-y-3">
                    {myFeedPosts.map((post) => {
                      const firstMedia = post.mediaItems?.[0];
                      const thumb = firstMedia?.url || post.mediaUrl || '';
                      const isImage = firstMedia?.type === 'image' || post.mediaType === 'image';
                      const isVideo = firstMedia?.type === 'video' || post.mediaType === 'video';
                      const textPreview = (post.text || '').trim();
                      const displayName = (post.userHandle || user?.handle || '@you').replace(/^@/, '');
                      return (
                        <article key={post.id} className="rounded-2xl border border-white/10 bg-[#111827] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => openMyFeedPost(post)}
                            className="w-full text-left"
                            title="Open post"
                          >
                            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar
                                  name={displayName}
                                  src={user?.avatarUrl || getAvatarForHandle(post.userHandle || user?.handle || '@you')}
                                  size={34}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-semibold truncate">{displayName}</p>
                                  <p className="text-xs text-gray-400 truncate">{new Date(post.createdAt).toLocaleString()}</p>
                                </div>
                              </div>
                              {myFeedEditedPostIds[post.id] && (
                                <span className="px-2 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-semibold">
                                  Edited
                                </span>
                              )}
                            </div>
                            {thumb && isImage ? (
                              <img src={thumb} alt="My post" className="w-full max-h-[520px] object-cover bg-black" />
                            ) : thumb && isVideo ? (
                              <video src={thumb} className="w-full max-h-[520px] object-cover bg-black" muted playsInline />
                            ) : (
                              <div className="p-4 bg-gradient-to-br from-gray-900 to-gray-700">
                                <p className="text-white text-sm whitespace-pre-wrap">{textPreview || 'No text'}</p>
                              </div>
                            )}
                            {(post.caption || (post.text && thumb)) && (
                              <div className="px-4 py-3">
                                <p className="text-sm text-gray-200 whitespace-pre-wrap">{post.caption || post.text}</p>
                              </div>
                            )}
                            <div className="px-4 py-3 border-t border-white/10 flex items-center gap-4 text-xs text-gray-300">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!user?.id) return;
                                  void (async () => {
                                    try {
                                      const updated = await toggleLike(String(user.id), post.id, post);
                                      const nextLikes = updated.stats?.likes ?? post.stats?.likes ?? 0;
                                      post.stats = { ...post.stats, likes: nextLikes };
                                      setMyFeedRefreshTick((v) => v + 1);
                                    } catch (error) {
                                      console.error('Failed to like my feed post:', error);
                                    }
                                  })();
                                }}
                                className="inline-flex items-center gap-1 hover:text-white transition-colors"
                                aria-label="Like post"
                              >
                                <FiThumbsUp className="w-4 h-4" /> {post.stats?.likes ?? 0}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openMyFeedComments(post);
                                }}
                                className="inline-flex items-center gap-1 hover:text-white transition-colors"
                                aria-label="Open comments"
                              >
                                <FiMessageCircle className="w-4 h-4" /> {post.stats?.comments ?? 0}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteMyFeedPostFromCard(post);
                                }}
                                className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-red-200 hover:bg-red-500/20 transition-colors"
                                aria-label="Delete post"
                                title="Delete post"
                              >
                                <FiX className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-10">You have not posted anything yet.</p>
                )}

              </div>

              {myFeedSelectedPost && (
                <div
                  className="fixed inset-0 z-[230] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
                  onClick={() => setMyFeedSelectedPost(null)}
                >
                  <div
                    className="bg-[#020617] border border-white/10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-[#020617] border-b border-white/10 px-4 py-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-100">Post</h3>
                      <button
                        onClick={() => setMyFeedSelectedPost(null)}
                        className="p-2 bg-white text-black hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close post"
                      >
                        <FiX className="w-5 h-5 text-black" />
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      {myFeedSelectedPost.mediaUrl ? (
                        myFeedSelectedPost.mediaType === 'video' ? (
                          <video
                            src={myFeedSelectedPost.mediaUrl}
                            controls
                            playsInline
                            className="w-full rounded-xl bg-black max-h-[56vh]"
                          />
                        ) : (
                          <img
                            src={myFeedSelectedPost.mediaUrl}
                            alt="Post"
                            className="w-full rounded-xl object-cover max-h-[56vh]"
                          />
                        )
                      ) : (
                        <div className="rounded-xl p-4 bg-gradient-to-br from-gray-900 to-gray-700">
                          <p className="text-white whitespace-pre-wrap">{myFeedSelectedPost.text || 'No text'}</p>
                        </div>
                      )}

                      {myFeedSelectedPost.caption && (
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{myFeedSelectedPost.caption}</p>
                      )}
                      {myFeedSelectedPost.text && myFeedSelectedPost.mediaUrl && (
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{myFeedSelectedPost.text}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{new Date(myFeedSelectedPost.createdAt).toLocaleString()}</span>
                        <span>{myFeedSelectedPost.stats?.likes ?? 0} likes</span>
                      </div>
                      {myFeedEditedPostIds[myFeedSelectedPost.id] && (
                        <div className="inline-flex items-center px-2 py-1 rounded-md bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-semibold">
                          Edited
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleDeleteMyFeedPost}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-black font-semibold hover:bg-gray-100 transition-colors"
                      >
                        Delete post
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {myFeedCommentsOpen && (
                <div className="fixed inset-0 z-[235] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setMyFeedCommentsOpen(false)}>
                  <div className="bg-black border-2 border-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="sticky top-0 bg-black border-b-2 border-white px-4 py-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-100">
                        {myFeedComments.length} {myFeedComments.length === 1 ? 'comment' : 'comments'}
                      </h3>
                      <button
                        onClick={() => setMyFeedCommentsOpen(false)}
                        className="p-2 bg-white text-black hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close comments"
                      >
                        <FiX className="w-5 h-5 text-black" />
                      </button>
                    </div>
                    <div className="p-4 space-y-3">
                      {myFeedCommentsLoading ? (
                        <p className="text-sm text-gray-300">Loading comments...</p>
                      ) : myFeedComments.length === 0 ? (
                        <p className="text-sm text-gray-400">No comments yet.</p>
                      ) : (
                        <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                          {myFeedComments.map((comment) => (
                            <div key={comment.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                              <p className="text-xs font-semibold text-gray-100">{comment.userHandle || 'User'}</p>
                              <p className="text-sm text-gray-200 mt-1 whitespace-pre-wrap">{comment.text || ''}</p>
                              <div className="mt-2 flex items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => { void handleToggleMyFeedCommentLike(comment.id); }}
                                  className="text-sky-300 hover:text-sky-200 transition-colors"
                                >
                                  {(comment.userLiked ? 'Unlike' : 'Like')} ({comment.likes ?? 0})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMyFeedReplyingTo(comment.id)}
                                  className="text-sky-300 hover:text-sky-200 transition-colors"
                                >
                                  Reply ({comment.replyCount ?? 0})
                                </button>
                              </div>
                              {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                                <div className="mt-2 pl-3 border-l border-white/10 space-y-2">
                                  {comment.replies.map((reply) => (
                                    <div key={reply.id}>
                                      <p className="text-[11px] font-semibold text-gray-300">{reply.userHandle || 'User'}</p>
                                      <p className="text-xs text-gray-300">{reply.text || ''}</p>
                                      <button
                                        type="button"
                                        onClick={() => { void handleToggleMyFeedReplyLike(comment.id, reply.id); }}
                                        className="mt-1 text-[11px] text-sky-300 hover:text-sky-200 transition-colors"
                                      >
                                        {(reply.userLiked ? 'Unlike' : 'Like')} ({reply.likes ?? 0})
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {myFeedReplyingTo && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            value={myFeedReplyDraft}
                            onChange={(e) => setMyFeedReplyDraft(e.target.value)}
                            placeholder="Write a reply..."
                            className="w-full sm:flex-1 min-h-[42px] rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-white"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setMyFeedReplyingTo(null)} className="px-3 py-2 rounded-lg border border-white/20 text-gray-200 hover:bg-white/5">Cancel</button>
                            <button type="button" onClick={() => { void handleAddMyFeedReply(); }} className="px-3 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-100">Send</button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          value={myFeedCommentDraft}
                          onChange={(e) => setMyFeedCommentDraft(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 min-h-[42px] rounded-lg border border-white/20 bg-[#0b1220] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-white"
                        />
                        <button type="button" onClick={() => { void handleAddMyFeedComment(); }} className="px-3 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-100">Post</button>
                      </div>
                      {myFeedCommentsPost && (
                        <p className="text-[11px] text-gray-500">Commenting on post by {myFeedCommentsPost.userHandle}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collections Modal */}
        {collectionsOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCollectionsOpen(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Collections</h2>
                <button onClick={() => setCollectionsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="p-6">
                {collections.length > 0 ? (
                  <div className="space-y-3">
                    {collections.map((collection) => {
                      const postCount = collection.postIds?.length || 0;
                      return (
                        <button
                          key={collection.id}
                          onClick={() => {
                            setCollectionsOpen(false);
                            nav(`/collection/${collection.id}`, { state: { collectionName: collection.name } });
                          }}
                          className="w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <CollectionCoverThumb
                              collection={collection}
                              className="w-16 h-16 rounded-xl flex-shrink-0"
                              iconClassName="w-7 h-7 text-gray-400"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 mb-1 truncate">{collection.name}</h3>
                              <p className="text-sm text-gray-600">
                                {postCount} {postCount === 1 ? 'post' : 'posts'}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No collections yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invite Friends Modal */}
        {inviteFriendsOpen && (
          <div className="fixed inset-0 z-[210] isolate bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setInviteFriendsOpen(false)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Invite Friends</h2>
                <button onClick={() => setInviteFriendsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <button
                  type="button"
                  onClick={() => { void handleSyncFacebookFriends(); }}
                  disabled={inviteSyncing}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold text-gray-900 inline-flex items-center gap-2">
                    <FaFacebook className="w-4 h-4 text-blue-600" />
                    <span>{inviteSyncing ? 'Syncing Facebook...' : 'Find Facebook Friends'}</span>
                  </div>
                  <div className="text-sm text-gray-500">Sync friends who connected with your app.</div>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleShareInviteToWhatsApp(); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-semibold text-gray-900 inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[10px] font-bold">W</span>
                    <span>Share to WhatsApp</span>
                  </div>
                  <div className="text-sm text-gray-500">Share the Gazetteer app with friends.</div>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleShareInviteToMessenger(); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-semibold text-gray-900 inline-flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white text-[10px] font-bold">M</span>
                    <span>Share to Messenger</span>
                  </div>
                  <div className="text-sm text-gray-500">Share the Gazetteer app with friends.</div>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleMatchContacts(); }}
                  disabled={contactsSyncing}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold text-gray-900">{contactsSyncing ? 'Syncing contacts...' : 'Find contacts'}</div>
                  <div className="text-sm text-gray-500">Sync your contacts to discover friends.</div>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleInviteByQrOrLink(); }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="font-semibold text-gray-900 inline-flex items-center gap-2">
                    <FiGrid className="w-4 h-4 text-gray-800" />
                    <span>Invite by link or QR</span>
                  </div>
                  <div className="text-sm text-gray-500">Share your profile and connect faster.</div>
                </button>

                {inviteMatchedFriends.length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      Facebook matches ({inviteMatchedFriends.length})
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {inviteMatchedFriends.map((friend) => (
                        <div key={friend.id} className="rounded-xl border border-gray-200 px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {friend.display_name || friend.handle || friend.facebook_name || 'User'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{friend.handle}</div>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                            onClick={async () => {
                              try {
                                await toggleFollow(friend.handle);
                                showToast(`Followed ${friend.handle}`);
                              } catch {
                                showToast('Could not follow right now.');
                              }
                            }}
                          >
                            Follow
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="fixed inset-0 z-[230] flex items-end justify-center">
            <button type="button" className="absolute inset-0 bg-[rgba(11,7,17,0.82)]" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
            <div className="relative flex max-h-[80%] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-[#2A2F3D] bg-[#0B0E14]">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-4">
                <h2 className="text-xl font-bold text-white">Settings</h2>
                <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                  <FiX className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-7 pt-3">
                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Comment safety</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Who can comment, hidden words, and the review queue</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setCommentSafetyOpen(true);
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Open comment safety
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Invite friends</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Share Gazetteer with people you want on here</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setInviteFriendsOpen(true);
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Invite friends
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Content preferences</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Edit preferred locations for feed suggestions</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      nav('/preferences/locations');
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Open preferences
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Stories</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Photo, video, and text stories (Clip studio)</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      nav('/clip');
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Create story
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Video playback</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Feed autoplay and default mute for videos</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      nav('/settings/playback');
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Playback settings
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Phone number</p>
                  <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Text a code to a new number and update your account</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      nav('/settings/phone');
                    }}
                    className="mt-2.5 rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Change phone number
                  </button>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Privacy</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2.5">
                      <p className="text-sm font-semibold text-white">Private account</p>
                      <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Only approved followers can view your profile</p>
                    </div>
                    <SettingsSwitch checked={isPrivate} disabled={isTogglingPrivacy} onClick={handleTogglePrivacy} />
                  </div>
                </div>

                <div className="mb-3 rounded-2xl border border-[#2A2F3D] bg-[#161B22] p-3.5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Push Notifications</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSafetyAlert({
                          title: 'Reset notifications?',
                          message: 'Every alert type turns back on for this phone.',
                          icon: 'alert',
                          showCancelButton: true,
                          confirmButtonText: 'Reset',
                          cancelButtonText: 'Cancel',
                          onConfirm: () => {
                            setNotificationPrefs(resetNotificationPreferences());
                          },
                        });
                      }}
                      className="rounded-lg border border-[#2A2F3D] bg-[#21262D] px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mb-3 flex items-center">
                    <FiBell className="mr-2.5 h-[22px] w-[22px] shrink-0 text-[#00F2FF]" />
                    <div className="min-w-0 flex-1 pr-2.5">
                      <p className="text-sm font-semibold text-white">Push Notifications</p>
                      <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Receive updates on post boosts and activity</p>
                    </div>
                    <SettingsSwitch accent="cyan" checked={osPushOn} disabled={osPushBusy} onClick={() => void handleOsPush(!osPushOn)} />
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2.5">
                      <p className="text-sm font-semibold text-white">Enable notifications</p>
                      <p className="mt-0.5 text-xs leading-[17px] text-[#8B949E]">Master switch for alerts on this device</p>
                    </div>
                    <SettingsSwitch
                      checked={notificationPrefs.enabled}
                      onClick={() => {
                        const next = { ...notificationPrefs, enabled: !notificationPrefs.enabled };
                        setNotificationPrefs(next);
                        saveNotificationPreferences(next);
                      }}
                    />
                  </div>
                  {notificationPrefs.enabled ? (
                    <div>
                      {SETTINGS_ALERT_TYPES.map(([key, label]) => (
                        <div key={key} className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">{label}</p>
                          <SettingsSwitch
                            checked={notificationPrefs[key]}
                            onClick={() => {
                              const next = { ...notificationPrefs, [key]: !notificationPrefs[key] };
                              setNotificationPrefs(next);
                              saveNotificationPreferences(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSafetyAlert({
                      title: 'Log out?',
                      message: 'You will need to sign in again to use Gazetteer on this phone.',
                      icon: 'alert',
                      showCancelButton: true,
                      confirmButtonText: 'Log out',
                      cancelButtonText: 'Cancel',
                      onConfirm: () => {
                        logout();
                        nav('/landing');
                      },
                    });
                  }}
                  className="mt-1.5 w-full rounded-xl bg-[#E53935] px-6 py-[13px] text-base font-semibold text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {commentSafetyOpen && (
          <div className="fixed inset-0 z-[240] flex items-end justify-center" onClick={() => setCommentSafetyOpen(false)}>
            <div className="absolute inset-0 bg-black/55" />
            <div
              className="relative flex h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-b-0 border-[rgba(244,114,182,0.28)] bg-[#0B0E14]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-center pt-2">
                <div className="h-1 w-[42px] rounded-full bg-white/30" />
              </div>
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-9">
                <div
                  className="mx-1 h-0.5 rounded-sm"
                  style={{ background: 'linear-gradient(90deg, rgba(244,114,182,0), rgba(244,114,182,0.7), rgba(244,114,182,0))' }}
                />
                <div className="flex items-center justify-between px-1 pb-2">
                  <h2 className="text-[22px] font-bold text-white">Comment Safety</h2>
                  <button
                    type="button"
                    onClick={() => setCommentSafetyOpen(false)}
                    className="rounded-full p-2 text-white"
                    aria-label="Close comment safety"
                  >
                    <FiX className="h-[22px] w-[22px]" />
                  </button>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#161B22] p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Comment Controls</p>
                  <div className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-semibold text-white">Allow comments on posts</p>
                      <p className="mt-0.5 text-xs text-[#8B949E]">Turn this off to stop new comments on your posts</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={commentModerationPrefs.allowComments}
                      onClick={() => {
                        const enabled = !commentModerationPrefs.allowComments;
                        void saveCommentControls(
                          enabled,
                          enabled
                            ? commentModerationPrefs.commentAudience === 'nobody'
                              ? 'everyone'
                              : commentModerationPrefs.commentAudience
                            : 'nobody',
                        );
                      }}
                      className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 ${commentModerationPrefs.allowComments ? 'justify-end bg-[#d91b5c]' : 'justify-start bg-[#30363D]'}`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {([
                      ['everyone', 'Everyone'],
                      ['followers', 'Followers only'],
                      ['nobody', 'Nobody (Turn off comments)'],
                    ] as const).map(([id, label]) => {
                      const selected = commentModerationPrefs.commentAudience === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => void saveCommentControls(id !== 'nobody', id)}
                          className={`flex w-full items-center gap-3 rounded-xl border bg-[#0B0E14] px-3 py-3 text-left ${selected ? 'border-[rgba(244,114,182,0.7)]' : 'border-[#2A2F3D]'}`}
                        >
                          <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${selected ? 'border-[#F472B6]' : 'border-[#8B949E]'}`}>
                            {selected ? <span className="h-2 w-2 rounded-full bg-[#F472B6]" /> : null}
                          </span>
                          <span className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#C9D1D9]'}`}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#161B22] p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.6px] text-[#8B949E]">Comment Filters</p>
                    <button
                      type="button"
                      onClick={() => {
                        const resetPrefs = { ...commentModerationPrefs, strictMode: false, customHiddenWords: [] as string[] };
                        setCommentModerationPrefs(resetPrefs);
                        setCommentModerationPreferences(resetPrefs);
                        setCommentWordDraft('');
                        setSafetyAlert({
                          title: 'Comment Safety Reset',
                          message: 'Strict mode and hidden words were reset.',
                          icon: 'success',
                        });
                      }}
                      className="rounded-lg bg-[#21262D] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-semibold text-white">Strict filtering</p>
                      <p className="mt-0.5 text-xs text-[#8B949E]">Auto-hide warning-level negative comments</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={commentModerationPrefs.strictMode}
                      onClick={() => {
                        const next = { ...commentModerationPrefs, strictMode: !commentModerationPrefs.strictMode };
                        setCommentModerationPrefs(next);
                        setCommentModerationPreferences(next);
                      }}
                      className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 ${commentModerationPrefs.strictMode ? 'justify-end bg-[#d91b5c]' : 'justify-start bg-[#30363D]'}`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-[#8B949E]">Hidden words and phrases</p>
                  <div className="flex items-center gap-2">
                    <input
                      value={commentWordDraft}
                      onChange={(event) => setCommentWordDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        const incoming = String(commentWordDraft || '').trim().toLowerCase();
                        if (!incoming) return;
                        const next = {
                          ...commentModerationPrefs,
                          customHiddenWords: Array.from(new Set([...(commentModerationPrefs.customHiddenWords || []), incoming])),
                        };
                        setCommentModerationPrefs(next);
                        setCommentModerationPreferences(next);
                        setCommentWordDraft('');
                      }}
                      placeholder="Add word or phrase to auto-hide"
                      className="min-w-0 flex-1 rounded-lg border border-[#2A2F3D] bg-[#0B0E14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#9CA3AF]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const incoming = String(commentWordDraft || '').trim().toLowerCase();
                        if (!incoming) return;
                        const next = {
                          ...commentModerationPrefs,
                          customHiddenWords: Array.from(new Set([...(commentModerationPrefs.customHiddenWords || []), incoming])),
                        };
                        setCommentModerationPrefs(next);
                        setCommentModerationPreferences(next);
                        setCommentWordDraft('');
                      }}
                      className="rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-[#0B0E14]"
                    >
                      Add
                    </button>
                  </div>
                  {(commentModerationPrefs.customHiddenWords || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {commentModerationPrefs.customHiddenWords.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => {
                            const next = {
                              ...commentModerationPrefs,
                              customHiddenWords: (commentModerationPrefs.customHiddenWords || []).filter((entry) => entry !== word),
                            };
                            setCommentModerationPrefs(next);
                            setCommentModerationPreferences(next);
                          }}
                          className="rounded-full border border-[#2A2F3D] bg-[#0B0E14] px-2.5 py-1 text-xs text-white"
                        >
                          {word} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8B949E]">No hidden words added yet.</p>
                  )}
                </div>

                <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-[#161B22] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-white">Hidden comments review</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8B949E]">{hiddenCommentQueue.length} pending</span>
                      {filteredHiddenQueue.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSafetyAlert({
                              title: 'Approve all visible?',
                              message: `This will approve ${filteredHiddenQueue.length} item(s) in the current filter.`,
                              icon: 'alert',
                              showCancelButton: true,
                              confirmButtonText: 'Approve all',
                              cancelButtonText: 'Cancel',
                              onConfirm: () => {
                                const visible = filteredHiddenQueue;
                                void (async () => {
                                  await Promise.all(visible.map((item) => approveHiddenComment(item.id)));
                                  const approvedIds = new Set(visible.map((item) => item.id));
                                  setHiddenCommentQueue((prev) => prev.filter((row) => !approvedIds.has(row.id)));
                                  setSafetyAlert({
                                    title: 'Approved',
                                    message: 'Approved all visible items.',
                                    icon: 'success',
                                  });
                                })();
                              },
                            });
                          }}
                          className="rounded-md border border-[#2A2F3D] bg-[#21262D] px-2 py-1 text-[11px] font-semibold text-white"
                        >
                          Approve all
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(['all', 'comments', 'replies'] as const).map((filterKey) => {
                      const active = hiddenQueueFilter === filterKey;
                      return (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setHiddenQueueFilter(filterKey)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? 'border-white bg-white text-[#0B0E14]' : 'border-[#2A2F3D] bg-[#0B0E14] text-[#8B949E]'}`}
                        >
                          {filterKey === 'all' ? 'All' : filterKey === 'comments' ? 'Comments' : 'Replies'}
                        </button>
                      );
                    })}
                  </div>
                  {loadingHiddenCommentQueue ? (
                    <p className="text-xs text-[#8B949E]">Loading review queue...</p>
                  ) : filteredHiddenQueue.length === 0 ? (
                    <p className="text-xs text-[#8B949E]">No hidden comments to review right now.</p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {filteredHiddenQueue.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-lg border border-[#2A2F3D] bg-[#0B0E14] p-2.5">
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {item.userHandle} {item.isReply ? 'replied' : 'commented'}
                            </p>
                            <p className="line-clamp-2 text-xs text-[#C9D1D9]">{item.text}</p>
                            {item.moderationReason ? (
                              <p className="mt-0.5 text-[11px] text-[#F472B6]">Reason: {item.moderationReason}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCommentSafetyOpen(false);
                                nav(`/post/${encodeURIComponent(String(item.postId))}`);
                              }}
                              className="rounded-md border border-[#2A2F3D] bg-[#21262D] px-2 py-1 text-[11px] font-semibold text-white"
                            >
                              Open post
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  const ok = await approveHiddenComment(item.id);
                                  if (!ok) return;
                                  setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                })();
                              }}
                              className="rounded-md border border-[#2A2F3D] bg-[#21262D] px-2 py-1 text-[11px] font-semibold text-white"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSafetyAlert({
                                  title: 'Delete hidden comment?',
                                  message: 'This action cannot be undone.',
                                  icon: 'alert',
                                  showCancelButton: true,
                                  confirmButtonText: 'Delete',
                                  cancelButtonText: 'Cancel',
                                  onConfirm: () => {
                                    void (async () => {
                                      const ok = await deleteHiddenComment(item.id);
                                      if (!ok) return;
                                      setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                    })();
                                  },
                                });
                              }}
                              className="rounded-md border border-[rgba(229,57,53,0.45)] bg-[rgba(229,57,53,0.16)] px-2 py-1 text-[11px] font-semibold text-[#FF8A80]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {securityOpen && (
          <div className="fixed inset-0 z-[240] flex items-end justify-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/72"
              aria-label="Close security"
              onClick={() => {
                if (!securityBusy) closeSecurityModal();
              }}
            />
            <div
              className="relative mb-0 w-[min(400px,calc(100%-32px))] overflow-hidden rounded-t-3xl border border-b-0 border-white/[0.08]"
              style={{ background: 'linear-gradient(168deg, #03091B 0%, #071330 42%, #160830 78%, #0A051C 100%)' }}
            >
              <div className="px-5 pb-4 pt-1">
                <div className="flex justify-center pb-2 pt-2">
                  <div className="h-1 w-10 rounded-full bg-white/30" />
                </div>
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.6px] text-white">Gazetteer says</p>
                <div className="mb-3 flex justify-center text-white">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <circle cx="8" cy="10" r="0.7" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="10" r="0.7" fill="currentColor" stroke="none" />
                    <circle cx="16" cy="10" r="0.7" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                {securityStep === 'phone' ? (
                  <>
                    <h2 className="mb-2 text-center text-lg font-semibold text-white">Add phone</h2>
                    <p className="mb-4 text-center text-[15px] leading-[22px] text-[#E2E8F0]">
                      We&apos;ll text you a verification code. Add your number for extra security and easier account recovery.
                    </p>
                    <div className="mb-3 flex gap-2">
                      <input
                        value={phoneCountryCode}
                        onChange={(event) => setPhoneCountryCode(event.target.value)}
                        placeholder="+353"
                        inputMode="tel"
                        className="w-[92px] rounded-[10px] border border-white/[0.08] bg-[rgba(30,30,32,0.82)] px-2.5 py-2.5 text-white outline-none placeholder:text-[#9CA3AF]"
                      />
                      <input
                        value={phoneInput}
                        onChange={(event) => setPhoneInput(event.target.value)}
                        placeholder="Phone number"
                        inputMode="tel"
                        className="min-w-0 flex-1 rounded-[10px] border border-white/[0.08] bg-[rgba(30,30,32,0.82)] px-2.5 py-2.5 text-white outline-none placeholder:text-[#9CA3AF]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={securityBusy}
                      onClick={() => void handleSendSecurityCode()}
                      className="mb-2 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#03091B] disabled:opacity-60"
                    >
                      {securityBusy ? 'Sending...' : 'Continue'}
                    </button>
                    <button
                      type="button"
                      disabled={securityBusy}
                      onClick={closeSecurityModal}
                      className="mb-2 w-full rounded-full border border-white/[0.12] bg-white/[0.06] py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
                    >
                      Not now
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="mb-2 text-center text-lg font-semibold text-white">Enter 6-digit code</h2>
                    <p className="mb-4 text-center text-[15px] leading-[22px] text-[#E2E8F0]">
                      Your code was sent to {pendingPhoneNumber}
                    </p>
                    <input
                      value={otpInput}
                      onChange={(event) => setOtpInput(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      className="mb-3 w-full rounded-[10px] border border-white/[0.08] bg-[rgba(30,30,32,0.82)] px-3 py-3 text-center text-lg tracking-[6px] text-white outline-none placeholder:text-[#9CA3AF]"
                    />
                    <button
                      type="button"
                      disabled={securityBusy}
                      onClick={() => void handleVerifySecurityCode()}
                      className="mb-2 w-full rounded-full bg-white py-3.5 text-[15px] font-bold text-[#03091B] disabled:opacity-60"
                    >
                      {securityBusy ? 'Verifying...' : 'Verify'}
                    </button>
                    <button
                      type="button"
                      disabled={securityBusy}
                      onClick={closeSecurityModal}
                      className="mb-2 w-full rounded-full border border-white/[0.12] bg-white/[0.06] py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <GazetteerAlertSheet
          visible={safetyAlert !== null}
          title={safetyAlert?.title ?? ''}
          message={safetyAlert?.message}
          icon={safetyAlert?.icon ?? 'alert'}
          showIcon={false}
          confirmButtonText={safetyAlert?.confirmButtonText ?? 'Done'}
          cancelButtonText={safetyAlert?.cancelButtonText ?? 'Cancel'}
          showCancelButton={safetyAlert?.showCancelButton ?? false}
          onConfirm={() => {
            const action = safetyAlert?.onConfirm;
            setSafetyAlert(null);
            action?.();
          }}
          onDismiss={() => setSafetyAlert(null)}
        />

      <CreateGroupModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={(g) => {
          setCreateGroupOpen(false);
          nav(`/messages/group/${encodeURIComponent(g.id)}`);
          showToast(
            `You're in “${g.name}”. Tap + in the header to invite people, or use their profile → Invite to group.`,
          );
        }}
      />
    </div>
  );
}