import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar';
import CreateGroupModal from '../components/CreateGroupModal';
import { FiCamera, FiBookmark, FiMessageCircle, FiLock, FiUnlock, FiX, FiUser, FiMapPin, FiThumbsUp, FiGlobe, FiEdit3, FiLink2, FiUsers, FiUserCheck, FiPlus, FiSettings, FiFileText, FiLayers, FiType, FiImage, FiGrid, FiVideo } from 'react-icons/fi';
import Flag from '../components/Flag';
import { getUserCollections } from '../api/collections';
import type { Collection } from '../types';
import { approveHiddenComment, deleteHiddenComment, deletePost, fetchHiddenCommentsForOwner, getFollowedUsers, posts, type HiddenCommentReviewItem } from '../api/posts';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { showToast } from '../utils/toast';
import { setProfilePrivacy } from '../api/privacy';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import { fetchFollowers, fetchFollowing, updateAuthProfile, mapLaravelUserToAppFields, sendPhoneVerificationCode, verifyPhoneVerificationCode } from '../api/client';
import type { Post, User } from '../types';
import { getAvatarForHandle } from '../api/users';
import { 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  type NotificationPreferences,
  initializeNotifications,
  resetNotificationPreferences
} from '../services/notifications';
import { testBrowserNotification, testNotificationTypes, testImageNotification } from '../utils/testNotifications';
import { runEndpointHealthCheck } from '../utils/endpointHealth';
import {
  getCommentModerationPreferences,
  setCommentModerationPreferences,
  type CommentModerationPreferences,
} from '../utils/commentModeration';

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

// Notification Toggle Component
function NotificationToggle({ 
  label, 
  description, 
  enabled, 
  onChange 
}: { 
  label: string; 
  description: string; 
  enabled: boolean; 
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 pr-4">
        <p className="font-medium text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
          enabled ? 'bg-brand-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

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
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [commentSafetyOpen, setCommentSafetyOpen] = React.useState(false);
  const [draftsOpen, setDraftsOpen] = React.useState(false);
  const [myFeedOpen, setMyFeedOpen] = React.useState(false);
  const [myFeedVisible, setMyFeedVisible] = React.useState(false);
  const [myFeedDragY, setMyFeedDragY] = React.useState(0);
  const [myFeedSelectedPost, setMyFeedSelectedPost] = React.useState<Post | null>(null);
  const [myFeedRefreshTick, setMyFeedRefreshTick] = React.useState(0);
  const [myFeedEditedPostIds, setMyFeedEditedPostIds] = React.useState<Record<string, true>>({});
  const [myFeedOpeningPostId, setMyFeedOpeningPostId] = React.useState<string | null>(null);
  const myFeedTouchStartYRef = React.useRef<number | null>(null);
  const myFeedSheetRef = React.useRef<HTMLDivElement | null>(null);
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [isPrivate, setIsPrivate] = React.useState(user?.is_private || false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<'bio' | 'social' | 'personal' | 'location' | 'interests' | 'flag' | 'followers' | 'following' | null>(null);
  const [followersCount, setFollowersCount] = React.useState(0);
  const [followingCount, setFollowingCount] = React.useState(0);
  const [followersList, setFollowersList] = React.useState<string[]>([]);
  const [followingList, setFollowingList] = React.useState<string[]>([]);
  const [loadingFollowers, setLoadingFollowers] = React.useState(false);
  const [loadingFollowing, setLoadingFollowing] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [placesTraveled, setPlacesTraveled] = React.useState<string>(user?.placesTraveled?.join(', ') || '');
  const [accountType, setAccountType] = React.useState<'personal' | 'business'>(user?.accountType === 'business' ? 'business' : 'personal');
  const [showProfilePictureModal, setShowProfilePictureModal] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>(getNotificationPreferences());
  const [commentModerationPrefs, setCommentModerationPrefs] = React.useState<CommentModerationPreferences>(getCommentModerationPreferences());
  const [commentWordDraft, setCommentWordDraft] = React.useState('');
  const [hiddenCommentQueue, setHiddenCommentQueue] = React.useState<HiddenCommentReviewItem[]>([]);
  const [loadingHiddenCommentQueue, setLoadingHiddenCommentQueue] = React.useState(false);
  const [hiddenQueueFilter, setHiddenQueueFilter] = React.useState<'all' | 'comments' | 'replies'>('all');
  const [isInitializingNotifications, setIsInitializingNotifications] = React.useState(false);
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
    if (!settingsOpen || !user?.handle) return;
    let cancelled = false;
    (async () => {
      setLoadingHiddenCommentQueue(true);
      try {
        const items = await fetchHiddenCommentsForOwner(user.handle);
        if (!cancelled) setHiddenCommentQueue(items);
      } catch (error) {
        console.error('Failed to load hidden comments review queue:', error);
        if (!cancelled) setHiddenCommentQueue([]);
      } finally {
        if (!cancelled) setLoadingHiddenCommentQueue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, user?.handle]);

  React.useEffect(() => {
    const onLocalPostCreated = () => {
      setMyFeedRefreshTick((v) => v + 1);
    };
    window.addEventListener('localPostCreated', onLocalPostCreated);
    return () => window.removeEventListener('localPostCreated', onLocalPostCreated);
  }, []);

  React.useEffect(() => {
    if (!myFeedOpen) {
      setMyFeedVisible(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setMyFeedVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [myFeedOpen]);

  const closeMyFeed = React.useCallback(() => {
    setMyFeedVisible(false);
    setMyFeedDragY(0);
    setMyFeedSelectedPost(null);
    window.setTimeout(() => setMyFeedOpen(false), 180);
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

  const openMyFeedPost = React.useCallback((post: Post) => {
    setMyFeedOpeningPostId(post.id);
    const sheet = myFeedSheetRef.current;
    if (sheet) {
      sheet.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.setTimeout(() => {
      setMyFeedSelectedPost(post);
      setMyFeedOpeningPostId(null);
    }, 140);
  }, []);


  const handleMyFeedTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    myFeedTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleMyFeedTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const startY = myFeedTouchStartYRef.current;
    if (startY == null) return;
    const currentY = event.touches[0]?.clientY ?? startY;
    const delta = Math.max(0, currentY - startY);
    setMyFeedDragY(delta);
  }, []);

  const handleMyFeedTouchEnd = React.useCallback(() => {
    if (myFeedDragY > 90) {
      closeMyFeed();
    } else {
      setMyFeedDragY(0);
    }
    myFeedTouchStartYRef.current = null;
  }, [closeMyFeed, myFeedDragY]);
  
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
    if (user?.placesTraveled) {
      setPlacesTraveled(user.placesTraveled.join(', '));
    } else {
      setPlacesTraveled('');
    }
  }, [user?.placesTraveled]);

  React.useEffect(() => {
    setAccountType(user?.accountType === 'business' ? 'business' : 'personal');
  }, [user?.accountType]);

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

  const profileCompletion = React.useMemo(() => {
    const checks = [
      Boolean(user?.avatarUrl),
      Boolean((user as any)?.profileBackgroundUrl),
      Boolean((bio || '').trim()),
      Boolean((socialLinks.website || socialLinks.instagram || socialLinks.tiktok || socialLinks.x || socialLinks.podcast || '').trim()),
      Boolean((national || regional || local || '').trim()),
    ];
    const completed = checks.filter(Boolean).length;
    const total = checks.length;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
    };
  }, [user?.avatarUrl, (user as any)?.profileBackgroundUrl, bio, socialLinks.website, socialLinks.instagram, socialLinks.tiktok, socialLinks.x, socialLinks.podcast, national, regional, local]);

  React.useEffect(() => {
    if (user?.is_private !== undefined) {
      setIsPrivate(user.is_private);
    }
  }, [user?.is_private]);

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

  // Load following count (from local state)
  React.useEffect(() => {
    if (!user?.id) return;
    const uid = String(user.id);
    getFollowedUsers(uid).then((handles) => {
      setFollowingList(handles);
      setFollowingCount(handles.length);
    });
  }, [user?.id]);

  // Load followers count (from API when available; mock shows 0)
  React.useEffect(() => {
    if (!user?.handle) return;
    const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
    if (!useLaravelApi) {
      setFollowersCount(0);
      setFollowersList([]);
      return;
    }
    fetchFollowers(user.handle, 0, 100)
      .then((res: any) => {
        const list = Array.isArray(res?.data) ? res.data : res?.followers ?? [];
        const handles = list.map((u: any) => u?.handle ?? u?.user_handle ?? String(u)).filter(Boolean);
        setFollowersList(handles);
        setFollowersCount(handles.length);
      })
      .catch(() => {
        setFollowersCount(0);
        setFollowersList([]);
      });
  }, [user?.handle]);

  // When opening Followers or Following modal, refresh list
  React.useEffect(() => {
    if (!user?.id) return;
    const uid = String(user.id);
    if (selectedCard === 'following') {
      setLoadingFollowing(true);
      getFollowedUsers(uid).then((handles) => {
        setFollowingList(handles);
        setFollowingCount(handles.length);
        setLoadingFollowing(false);
      });
    }
    if (selectedCard === 'followers' && user?.handle) {
      const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';
      if (useLaravelApi) {
        setLoadingFollowers(true);
        fetchFollowers(user.handle, 0, 200)
          .then((res: any) => {
            const list = Array.isArray(res?.data) ? res.data : res?.followers ?? [];
            const handles = list.map((u: any) => u?.handle ?? u?.user_handle ?? String(u)).filter(Boolean);
            setFollowersList(handles);
            setFollowersCount(handles.length);
            setLoadingFollowers(false);
          })
          .catch(() => setLoadingFollowers(false));
      }
    }
  }, [selectedCard, user?.id, user?.handle]);

  // Refresh following count when user follows/unfollows elsewhere (e.g. feed or view profile)
  React.useEffect(() => {
    if (!user?.id) return;
    const handler = () => {
      getFollowedUsers(String(user.id)).then((handles) => {
        setFollowingList(handles);
        setFollowingCount(handles.length);
      });
    };
    window.addEventListener('followToggled', handler);
    return () => window.removeEventListener('followToggled', handler);
  }, [user?.id]);

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

    if (!draft.videoUrl) return;

    const firstItem = draft.mediaItems && draft.mediaItems.length > 0 ? draft.mediaItems[0] : null;
    const mediaType: 'image' | 'video' =
      firstItem?.type ?? draft.mediaType ?? (draft.videoUrl.startsWith('data:image/') ? 'image' : 'video');

    nav('/create/gallery-preview', {
      state: {
        fromDraft: true,
        draftId: draft.id,
        draftMediaUrl: draft.videoUrl,
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

  const handleTogglePrivacy = async () => {
    if (isTogglingPrivacy || !user) return;
    
    setIsTogglingPrivacy(true);
    try {
      const newPrivacyState = !isPrivate;
      
      // Show warning when setting to public
      if (!newPrivacyState) {
        const result = await Swal.fire(bottomSheet({
          title: 'Set Profile to Public?',
          message: 'Your posts and stories will still be public on locations news feed.',
          showCancelButton: true,
          confirmButtonText: 'Set to Public',
          cancelButtonText: 'Cancel',
        }));

        if (!result.isConfirmed) {
          setIsTogglingPrivacy(false);
          return;
        }
      }

      // Toggle privacy locally (using localStorage like the rest of the app)
      const updatedUser = { ...user, is_private: newPrivacyState };
      setIsPrivate(newPrivacyState);
      login(updatedUser);
      
      // Also save to privacy storage
      if (user.handle) {
        setProfilePrivacy(user.handle, newPrivacyState);
      }

      // Persist to backend profile when available (best effort).
      try {
        await updateAuthProfile({ is_private: newPrivacyState } as any);
      } catch (syncError) {
        console.warn('Failed to sync privacy setting to backend, keeping local state:', syncError);
      }

      Swal.fire(bottomSheet({
        title: newPrivacyState ? 'Profile Set to Private' : 'Profile Set to Public',
        message: newPrivacyState
          ? 'Your profile is now private. Only approved followers can view your profile and send you messages.'
          : 'Your profile is now public. Anyone can view your profile and send you messages.',
        icon: 'success',
        confirmButtonText: 'Done',
      }));
    } catch (error) {
      console.error('Error toggling privacy:', error);
      Swal.fire(bottomSheet({ title: 'Error', message: 'Failed to update privacy settings', icon: 'alert' }));
    } finally {
      setIsTogglingPrivacy(false);
    }
  };

  const handleSecurityPhoneVerify = async () => {
    const phoneStep = await Swal.fire({
      title: 'Add phone',
      html: `
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left; margin-top:8px; width:100%; max-width:100%; box-sizing:border-box;">
          <p style="margin:0; color:#a1a1aa; font-size:13px;">
            Add your phone number for extra security, easier account recovery, and quicker logins.
          </p>
          <div style="display:flex; gap:8px; width:100%; max-width:100%; box-sizing:border-box;">
            <select id="phone-country-code" style="flex:0 0 96px; width:96px; min-width:96px; max-width:96px; border-radius:10px; border:1px solid #3f3f46; background:#18181b; color:#fff; padding:10px 8px; box-sizing:border-box;">
              <option value="+353">IE +353</option>
              <option value="+44">UK +44</option>
              <option value="+1">US +1</option>
              <option value="+33">FR +33</option>
              <option value="+55">BR +55</option>
            </select>
            <input id="phone-number-input" type="tel" placeholder="Phone number" style="flex:1 1 auto; min-width:0; width:100%; max-width:100%; border-radius:10px; border:1px solid #3f3f46; background:#18181b; color:#fff; padding:10px; box-sizing:border-box;" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continue',
      cancelButtonText: 'Not now',
      background: '#111111',
      color: '#ffffff',
      focusConfirm: false,
      customClass: {
        popup: 'swal-bottom-sheet-popup',
        confirmButton: 'swal-bottom-sheet-confirm',
        cancelButton: 'swal-bottom-sheet-cancel',
      },
      preConfirm: () => {
        const countryEl = document.getElementById('phone-country-code') as HTMLSelectElement | null;
        const phoneEl = document.getElementById('phone-number-input') as HTMLInputElement | null;
        const countryCode = countryEl?.value?.trim() || '+353';
        const phoneDigits = (phoneEl?.value || '').replace(/\D+/g, '');
        if (phoneDigits.length < 7 || phoneDigits.length > 15) {
          Swal.showValidationMessage('Enter a valid phone number.');
          return null;
        }
        return `${countryCode}${phoneDigits}`;
      },
    });
    if (!phoneStep.isConfirmed || !phoneStep.value) return;

    const phoneNumber = String(phoneStep.value);
    const sendResult = await sendPhoneVerificationCode(phoneNumber);
    if (sendResult.delivery === 'mock' && sendResult.debug_code) {
      showToast(`Demo PIN: ${sendResult.debug_code}`);
    } else {
      showToast('Verification code sent');
    }

    const otpStep = await Swal.fire({
      title: 'Enter 6-digit code',
      text: `Your code was sent to ${phoneNumber}`,
      input: 'text',
      inputPlaceholder: '000000',
      inputAttributes: {
        maxlength: '6',
        autocapitalize: 'off',
        autocorrect: 'off',
        inputmode: 'numeric',
      },
      showCancelButton: true,
      confirmButtonText: 'Verify',
      cancelButtonText: 'Cancel',
      background: '#111111',
      color: '#ffffff',
      customClass: {
        popup: 'swal-bottom-sheet-popup',
        confirmButton: 'swal-bottom-sheet-confirm',
        cancelButton: 'swal-bottom-sheet-cancel',
      },
      preConfirm: (value) => {
        const typed = String(value || '').replace(/\D+/g, '');
        if (typed.length !== 6) {
          Swal.showValidationMessage('Enter the 6-digit code.');
          return null;
        }
        return typed;
      },
    });
    if (!otpStep.isConfirmed || !otpStep.value) return;

    try {
      await verifyPhoneVerificationCode(phoneNumber, String(otpStep.value));
      await Swal.fire(bottomSheet({
        title: 'Phone verified',
        message: 'Your account now has an extra verification step.',
        icon: 'success',
        confirmButtonText: 'Done',
      }));
    } catch (err: any) {
      await Swal.fire(bottomSheet({
        title: 'Verification failed',
        message: err?.message || 'Could not verify code. Please try again.',
        icon: 'alert',
      }));
    }
  };

  const handleProfilePictureSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file);

    if (file) {
      setIsUpdatingProfile(true);
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newAvatarUrl = e.target?.result as string;
          console.log('New avatar URL:', newAvatarUrl);

          // Update user with new avatar
          const updatedUser = {
            ...user,
            avatarUrl: newAvatarUrl
          };

          console.log('Updated user:', updatedUser);
          login(updatedUser);
          setIsUpdatingProfile(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error updating profile picture:', error);
        setIsUpdatingProfile(false);
      }
    }
  };

  const removeProfilePicture = () => {
    setIsUpdatingProfile(true);
    const updatedUser = {
      ...user,
      avatarUrl: undefined
    };
    login(updatedUser);
    setIsUpdatingProfile(false);
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

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100">
      {/* Header - Sticky (dark experiment) */}
      <div className="sticky top-0 z-[100] bg-[#020617]/95 backdrop-blur-md border-b border-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Profile Picture with + to show you can change it */}
            <div className="flex-shrink-0 relative">
              <button
                type="button"
                onClick={() => setShowProfilePictureModal(true)}
                className="block cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-full"
                aria-label="Change profile picture"
              >
                <Avatar
                  src={user?.avatarUrl}
                  name={user?.name || 'User'}
                  size="sm"
                  className="pointer-events-none"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
                </span>
              </button>
            </div>

            {/* Center: User name */}
            <div className="flex-1 flex justify-center min-w-0 px-2">
              <h1 className="text-xl font-bold text-white truncate" title={user?.name}>
                {user?.name || 'Passport'}
              </h1>
            </div>

            {/* Right: Private/Public Toggle */}
            <div className="flex-shrink-0">
              <button
                onClick={handleTogglePrivacy}
                disabled={isTogglingPrivacy}
                className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                title={isPrivate ? 'Profile is private - Click to make public' : 'Profile is public - Click to make private'}
                aria-label={isPrivate ? 'Make profile public' : 'Make profile private'}
              >
                {isPrivate ? (
                  <FiLock className="w-5 h-5 text-gray-200" />
                ) : (
                  <FiUnlock className="w-5 h-5 text-gray-200" />
                )}
              </button>
            </div>
          </div>

          {/* Quick actions rail: horizontal snap chips */}
          <div className="border-t border-gray-800 mt-3 pt-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 px-0.5" style={{ scrollSnapType: 'x mandatory' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!ownProfileHandle) return;
                  setSettingsOpen(false);
                  setCommentSafetyOpen(false);
                  setCollectionsOpen(false);
                  setDraftsOpen(false);
                  setMyFeedOpen(true);
                }}
                disabled={!ownProfileHandle}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ scrollSnapAlign: 'start' }}
                title="Open my posts feed"
              >
                <FiGrid className="w-4 h-4" />
                <span className="text-xs font-semibold">My feed</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  nav('/profile/cover');
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiCamera className="w-4 h-4" />
                <span className="text-xs font-semibold">Cover</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCreateGroupOpen(true);
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-cyan-500/35 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50 transition-colors flex items-center gap-2"
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
                  setSettingsOpen(false);
                  setCommentSafetyOpen(false);
                  setDraftsOpen(false);
                  loadCollections();
                  setCollectionsOpen(true);
                }}
                className="relative shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-white/15 bg-black/40 text-gray-100 hover:bg-white/10 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiBookmark className="w-4 h-4" />
                <span className="text-xs font-semibold">Collections</span>
                {collections.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                    {collections.length > 9 ? '9+' : collections.length}
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
                <FiLock className="w-4 h-4" />
                <span className="text-xs font-semibold">Comment Safety</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleSecurityPhoneVerify();
                }}
                className="shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-300/40 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-900/45 transition-colors flex items-center gap-2"
                style={{ scrollSnapAlign: 'start' }}
              >
                <FiUserCheck className="w-4 h-4" />
                <span className="text-xs font-semibold">Security</span>
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
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="max-w-2xl mx-auto px-6 py-4">
        {/* Profile Picture Modal */}
        {showProfilePictureModal && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
              onClick={() => setShowProfilePictureModal(false)}
            >
              <div
                className="relative flex flex-col items-center gap-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Enlarged Profile Picture */}
                <div className="relative">
                  <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-gray-700 shadow-2xl">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.name}'s profile picture`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-6xl font-bold text-gray-100">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Change Button */}
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2 px-6 py-3 bg-gray-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                    <FiCamera className="w-6 h-6 text-gray-200" />
                    <span className="text-sm font-medium text-gray-100">Change</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleProfilePictureSelect(e);
                      setShowProfilePictureModal(false);
                    }}
                    className="hidden"
                    disabled={isUpdatingProfile}
                  />
                </label>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowProfilePictureModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"
                  aria-label="Close"
                >
                  <FiX className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Private profile notice only (name/handle in header) */}
        {isPrivate && (
          <div className="text-center mb-4">
            <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
              <FiLock className="w-3 h-3" />
              Your profile is private
            </p>
          </div>
        )}

        {/* Edit profile hub (Instagram/TikTok-style quick management) */}
        <div className="px-4 mb-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Edit Profile</h2>
                <p className="text-xs text-gray-400 mt-0.5">Quickly update your identity and profile presence.</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full border border-white/20 bg-black/50 text-gray-200">
                {profileCompletion.percent}% complete
              </span>
            </div>

            <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${profileCompletion.percent}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowProfilePictureModal(true)}
                className="py-2.5 rounded-xl border border-white/20 bg-black text-white text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <FiCamera className="w-4 h-4" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => nav('/profile/cover')}
                className="py-2.5 rounded-xl border border-white/20 bg-black text-white text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <FiImage className="w-4 h-4" />
                Cover
              </button>
              <button
                type="button"
                onClick={() => setSelectedCard('bio')}
                className="py-2.5 rounded-xl border border-white/20 bg-black text-white text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <FiEdit3 className="w-4 h-4" />
                Bio
              </button>
              <button
                type="button"
                onClick={() => setSelectedCard('social')}
                className="py-2.5 rounded-xl border border-white/20 bg-black text-white text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <FiLink2 className="w-4 h-4" />
                Links
              </button>
            </div>
          </div>
        </div>

        {/* Profile cards grouped by function (cleaner hierarchy) */}
        <div className="px-4 py-4 space-y-4">
          <section className="space-y-2">
            <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">Audience</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedCard('followers')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.followers}
                    icon={<FiUsers className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Followers</div>
                    <div className="text-lg font-bold text-white mt-0.5">{followersCount}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedCard('following')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.following}
                    icon={<FiUserCheck className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Following</div>
                    <div className="text-lg font-bold text-white mt-0.5">{followingCount}</div>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">Identity</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedCard('bio')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.bio}
                    icon={<FiEdit3 className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Bio</div>
                    <div className="text-xs text-gray-400 mt-0.5">{bio ? 'Edit bio' : 'Add bio'}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedCard('social')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.social}
                    icon={<FiLink2 className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Social Links</div>
                    <div className="text-xs text-gray-400 mt-0.5">Add links</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedCard('location')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.location}
                    icon={<FiMapPin className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Location</div>
                    <div className="text-xs text-gray-400 mt-0.5">Set location</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedCard('flag')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.flag}
                    icon={<FiGlobe className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Country Flag</div>
                    <div className="text-xs text-gray-400 mt-0.5">Select flag</div>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">Preferences</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedCard('personal')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.personal}
                    icon={<FiUser className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Travel Info</div>
                    <div className="text-xs text-gray-400 mt-0.5">{accountType === 'business' ? 'Business account' : 'Personal account'}</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedCard('interests')}
                className="rounded-2xl cursor-pointer text-left w-full group"
              >
                <div className="h-full flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#020617] border border-white/12 hover:border-white/28 hover:bg-[#0a1226] transition-colors">
                  <ProfileCardImage
                    imagePath={PROFILE_CARD_IMAGES.interests}
                    icon={<FiThumbsUp className="w-6 h-6 text-gray-600" />}
                  />
                  <div className="text-center w-full">
                    <div className="font-semibold text-sm text-gray-100">Interests</div>
                    <div className="text-xs text-gray-400 mt-0.5">Add interests</div>
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Sheet Modal */}
      {selectedCard && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setSelectedCard(null)}
            />
            
            {/* Bottom Sheet - flex so content area scrolls */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out translate-y-0 flex flex-col"
              style={{ maxHeight: '85vh' }}
            >
              {/* Handle Bar */}
              <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Header - title and X close for all cards */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 gap-3">
                <h2 className="text-xl font-bold text-gray-900 flex-1 min-w-0">
                  {selectedCard === 'bio' && 'Edit Bio'}
                  {selectedCard === 'social' && 'Social Links'}
                  {selectedCard === 'personal' && 'Travel Information'}
                  {selectedCard === 'location' && 'Location Settings'}
                  {selectedCard === 'interests' && 'Interests'}
                  {selectedCard === 'flag' && 'Country Flag'}
                  {selectedCard === 'followers' && 'Followers'}
                  {selectedCard === 'following' && 'Following'}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedCard(null)}
                  className="flex-shrink-0 p-2.5 rounded-full hover:bg-gray-100 border border-gray-200 transition-colors"
                  aria-label="Close"
                  title="Close"
                >
                  <FiX className="w-6 h-6 text-gray-700" />
                </button>
              </div>

              {/* Content - scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 pb-8">
                {/* Followers List */}
                {selectedCard === 'followers' && (
                  <div className="py-2">
                    {loadingFollowers ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-3 text-gray-500">Loading…</span>
                      </div>
                    ) : followersList.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No followers yet</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {followersList.map((handle) => (
                          <li key={handle}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCard(null);
                                nav(`/user/${encodeURIComponent(handle)}`);
                              }}
                              className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 text-left"
                            >
                              <Avatar src={getAvatarForHandle(handle)} name={handle} size="sm" />
                              <span className="font-medium text-gray-900">{handle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Following List */}
                {selectedCard === 'following' && (
                  <div className="py-2">
                    {loadingFollowing ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-3 text-gray-500">Loading…</span>
                      </div>
                    ) : followingList.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Not following anyone yet</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {followingList.map((handle) => (
                          <li key={handle}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCard(null);
                                nav(`/user/${encodeURIComponent(handle)}`);
                              }}
                              className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 text-left"
                            >
                              <Avatar src={getAvatarForHandle(handle)} name={handle} size="sm" />
                              <span className="font-medium text-gray-900">{handle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Bio Form */}
                {selectedCard === 'bio' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        rows={6}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        This will be visible on your profile
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Email cannot be changed
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Age
                      </label>
                      <input
                        type="number"
                        value={user.age || ''}
                        onChange={(e) => {
                          const age = parseInt(e.target.value) || undefined;
                          login({ ...user, age });
                        }}
                        placeholder="Enter your age"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Active
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const bioTrim = bio.trim();
                        try {
                          const ok = await persistLaravelProfile({ bio: bioTrim || null });
                          if (!ok) login({ ...user, bio: bioTrim || undefined });
                        } catch {
                          Swal.fire(
                            bottomSheet({
                              title: 'Could not save',
                              message: 'Bio was saved on this device only.',
                              icon: 'alert',
                            })
                          );
                          login({ ...user, bio: bioTrim || undefined });
                        }
                        setSelectedCard(null);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Bio
                    </button>
                  </div>
                )}

                {/* Social Links Form */}
                {selectedCard === 'social' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website
                      </label>
                      <input
                        type="text"
                        value={socialLinks.website}
                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        X (Twitter)
                      </label>
                      <input
                        type="text"
                        value={socialLinks.x}
                        onChange={(e) => setSocialLinks({ ...socialLinks, x: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instagram
                      </label>
                      <input
                        type="text"
                        value={socialLinks.instagram}
                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TikTok
                      </label>
                      <input
                        type="text"
                        value={socialLinks.tiktok}
                        onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Podcast
                      </label>
                      <input
                        type="text"
                        value={socialLinks.podcast}
                        onChange={(e) => setSocialLinks({ ...socialLinks, podcast: e.target.value })}
                        placeholder="https://open.spotify.com/show/..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const nextSocial = {
                          website: socialLinks.website.trim() || undefined,
                          x: socialLinks.x.trim() || undefined,
                          instagram: socialLinks.instagram.trim() || undefined,
                          tiktok: socialLinks.tiktok.trim() || undefined,
                          podcast: socialLinks.podcast.trim() || undefined,
                        };
                        const hasAny = Object.values(nextSocial).some(Boolean);
                        try {
                          const ok = await persistLaravelProfile({
                            social_links: nextSocial,
                          });
                          if (!ok) login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
                        } catch {
                          Swal.fire(
                            bottomSheet({
                              title: 'Could not save',
                              message: 'Social links were saved on this device only.',
                              icon: 'alert',
                            })
                          );
                          login({ ...user, socialLinks: hasAny ? nextSocial : undefined });
                        }
                        setSelectedCard(null);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Social Links
                    </button>
                  </div>
                )}

                {/* Travel Info Form */}
                {selectedCard === 'personal' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountType('personal')}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                            accountType === 'personal'
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Personal
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType('business')}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                            accountType === 'business'
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Business
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Business accounts are eligible for local business suggestion cards.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Places You've Traveled To
                      </label>
                      <input
                        type="text"
                        value={placesTraveled}
                        onChange={(e) => setPlacesTraveled(e.target.value)}
                        placeholder="e.g., Paris, London, Tokyo, New York"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Separate multiple places with commas
                      </p>
                    </div>
                    {user.placesTraveled && user.placesTraveled.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Places
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {user.placesTraveled.map((place, index) => (
                            <span
                              key={index}
                              className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-full"
                            >
                              {place}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        const places = placesTraveled.split(',').map(p => p.trim()).filter(p => p);
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
                              message: 'Travel list was saved on this device only.',
                              icon: 'alert',
                            })
                          );
                          login({ ...user, placesTraveled: places.length ? places : undefined, accountType });
                        }
                        setSelectedCard(null);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Travel Info
                    </button>
                  </div>
                )}

                {/* Location Form */}
                {selectedCard === 'location' && (
                  <div className="space-y-4">
                    {/* National (Country) - First */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        National (Country) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={national}
                        onChange={(e) => {
                          setNational(e.target.value);
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Regional (State/Province/City) <span className="text-red-500">*</span>
                      </label>
                      {loadingRegions ? (
                        <div className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      ) : (
                        <input
                          type="text"
                          value={regional}
                          onChange={(e) => setRegional(e.target.value)}
                          placeholder="Select country first"
                          disabled
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 placeholder-gray-400 cursor-not-allowed"
                        />
                      )}
                    </div>

                    {/* Local (Neighborhood/Town) - Last */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Local (Neighborhood/Town) <span className="text-red-500">*</span>
                      </label>
                      {loadingCities ? (
                        <div className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      ) : (
                        <input
                          type="text"
                          value={local}
                          onChange={(e) => setLocal(e.target.value)}
                          placeholder="Select region first"
                          disabled
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 placeholder-gray-400 cursor-not-allowed"
                        />
                      )}
                    </div>

                    <button
                      onClick={async () => {
                        if (!national || !regional || !local) {
                          Swal.fire(bottomSheet({
                            title: 'Missing Information',
                            message: 'Please fill in all location fields (National, Regional, and Local)',
                            icon: 'alert',
                          }));
                          return;
                        }
                        try {
                          const ok = await persistLaravelProfile({
                            location_local: local,
                            location_regional: regional,
                            location_national: national,
                          });
                          if (!ok) login({ ...user, national, regional, local });
                        } catch {
                          Swal.fire(
                            bottomSheet({
                              title: 'Could not save',
                              message: 'Location was saved on this device only.',
                              icon: 'alert',
                            })
                          );
                          login({ ...user, national, regional, local });
                        }
                        setSelectedCard(null);
                        window.dispatchEvent(
                          new CustomEvent('locationUpdated', {
                            detail: { national, regional, local },
                          })
                        );
                      }}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Location
                    </button>
                  </div>
                )}

                {/* Interests Form */}
                {selectedCard === 'interests' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Interests (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={user.interests?.join(', ') || ''}
                        onChange={(e) => {
                          const interests = e.target.value.split(',').map(i => i.trim()).filter(i => i);
                          login({ ...user, interests });
                        }}
                        placeholder="e.g., Technology, Travel, Food"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Separate multiple interests with commas
                      </p>
                    </div>
                    {user.interests && user.interests.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Interests
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {user.interests.map((interest, index) => (
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
                      onClick={() => setSelectedCard(null)}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Interests
                    </button>
                  </div>
                )}

                {/* Country Flag Form */}
                {selectedCard === 'flag' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pick a flag
                      </label>
                      <div className="grid grid-cols-8 gap-2">
                        {['IE', 'GB', 'FR', 'ES', 'IT', 'DE', 'PT', 'NL', 'US', 'CA', 'BR', 'MX', 'AU', 'NZ', 'JP', 'CN', 'IN', 'PK', 'ZA', 'KE', 'EG', 'TR', 'RU', 'UA'].map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setCountryFlag(f);
                              login({ ...user, countryFlag: f });
                            }}
                            className={`h-12 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors ${countryFlag === f ? 'ring-2 ring-brand-500 bg-brand-50' : ''} px-1`}
                            aria-label={`Select flag ${f}`}
                          >
                            <Flag value={f} size={24} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Or paste your flag emoji
                      </label>
                      <input
                        value={countryFlag}
                        onChange={(e) => setCountryFlag(e.target.value)}
                        maxLength={8}
                        placeholder="🇮🇪"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-2xl"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        This flag shows beside your handle on feed and profile.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        login({ ...user, countryFlag });
                        setSelectedCard(null);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-xl shadow-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-200"
                    >
                      Save Flag
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Drafts Modal */}
        {draftsOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDraftsOpen(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Drafts</h2>
                <button onClick={() => setDraftsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="p-6">
                {drafts.length > 0 ? (
                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => handleOpenDraft(draft)}
                        className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Thumbnail preview */}
                          <div className="relative w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {draft.isTextOnly ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600">
                                <FiType className="w-6 h-6" />
                              </div>
                            ) : (() => {
                              const thumbUrl = draft.mediaItems?.[0]?.url ?? draft.videoUrl;
                              const isImage = (draft.mediaItems && draft.mediaItems[0]?.type === 'image') || (!draft.mediaItems && (draft.mediaType === 'image' || draft.videoUrl.startsWith('data:image/')));
                              return isImage ? (
                                <img src={thumbUrl} alt={draft.caption || 'Draft'} className="w-full h-full object-cover" />
                              ) : (
                                <video src={thumbUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                              );
                            })()}
                            {draft.mediaItems && draft.mediaItems.length > 1 && (
                              <div className="absolute bottom-0 right-0 p-1 rounded-tl bg-black/70 text-white flex items-center justify-center" title="Carousel">
                                <FiLayers className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                {new Date(draft.createdAt).toLocaleDateString()}
                              </p>
                              <p className="text-gray-900 line-clamp-2">
                                {draft.isTextOnly ? (draft.textBody || 'Text post') : (draft.caption || 'No text')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDraft(draft.id);
                              }}
                              className="p-2 hover:bg-red-100 rounded-full transition-colors"
                              title="Delete draft"
                            >
                              <FiX className="w-5 h-5 text-red-600" />
                            </button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No drafts yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* My Feed Modal */}
        {myFeedOpen && (
          <div
            className={`fixed inset-0 z-[220] backdrop-blur-sm flex items-end justify-center p-0 sm:p-4 transition-colors duration-200 ${
              myFeedVisible ? 'bg-black/60' : 'bg-black/0'
            }`}
            onClick={closeMyFeed}
          >
            <div
              className={`bg-[#020617] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-transform duration-200 ${
                myFeedVisible ? 'translate-y-0' : 'translate-y-full sm:translate-y-8'
              }`}
              ref={myFeedSheetRef}
              style={{
                transform: myFeedVisible
                  ? `translateY(${myFeedDragY}px)`
                  : undefined,
                transitionDuration: myFeedDragY > 0 ? '0ms' : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-30 bg-[#020617] border-b border-white/10 px-6 py-3">
                <div
                  className="flex justify-center pb-2 touch-none"
                  onTouchStart={handleMyFeedTouchStart}
                  onTouchMove={handleMyFeedTouchMove}
                  onTouchEnd={handleMyFeedTouchEnd}
                  onTouchCancel={handleMyFeedTouchEnd}
                >
                  <div className="w-12 h-1 bg-white/30 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-100">My Feed</h2>
                  <button onClick={closeMyFeed} className="p-2 bg-white text-black hover:bg-gray-100 rounded-full transition-colors" aria-label="Close My Feed">
                    <FiX className="w-6 h-6 text-black" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeMyFeed}
                  className="relative z-40 mt-3 w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-black font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  aria-label="Close tiles"
                  title="Close tiles"
                >
                  <FiX className="w-4 h-4" />
                  Close tiles
                </button>
              </div>
              <div className="p-4 pb-6">
                {myFeedOpeningPostId && (
                  <div className="mb-3 text-xs font-semibold text-sky-200 bg-sky-500/15 border border-sky-400/30 rounded-lg px-3 py-2">
                    Opening post...
                  </div>
                )}
                {myFeedPosts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {myFeedPosts.map((post) => {
                      const firstMedia = post.mediaItems?.[0];
                      const thumb = firstMedia?.url || post.mediaUrl || '';
                      const isImage = firstMedia?.type === 'image' || post.mediaType === 'image';
                      const isVideo = firstMedia?.type === 'video' || post.mediaType === 'video';
                      const textPreview = (post.text || '').trim();
                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => openMyFeedPost(post)}
                          className="relative aspect-square rounded-lg overflow-hidden bg-[#111827] border border-white/10 hover:opacity-95 transition-opacity"
                          title="Open post"
                        >
                          {thumb && isImage ? (
                            <img src={thumb} alt="My post" className="w-full h-full object-cover" />
                          ) : textPreview.length > 0 && !isVideo ? (
                            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 p-2.5 flex items-start">
                              <p className="text-white text-[11px] leading-4 line-clamp-6 text-left">{textPreview}</p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#111827] text-gray-400">
                              {isVideo ? <FiVideo className="w-6 h-6" /> : <FiType className="w-6 h-6" />}
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                            {post.stats?.likes ?? 0} likes
                          </div>
                          {myFeedEditedPostIds[post.id] && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-semibold">
                              Edited
                            </div>
                          )}
                        </button>
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
                            {collection.thumbnailUrl ? (
                              isVideoUrl(collection.thumbnailUrl) ? (
                                <video
                                  src={collection.thumbnailUrl}
                                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={collection.thumbnailUrl}
                                  alt={collection.name}
                                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                />
                              )
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <FiBookmark className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
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

        {/* Settings Modal */}
        {settingsOpen && (
          <div className="fixed inset-0 z-[220] isolate bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      nav('/preferences/locations');
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Content preferences</p>
                      <p className="text-xs text-gray-500">Edit preferred locations for feed suggestions</p>
                    </div>
                    <FiMapPin className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                <div>
                  <button
                    onClick={async () => {
                      const results = await runEndpointHealthCheck();
                      const failed = results.filter((r) => !r.ok);
                      const message = results
                        .map((r) => `${r.ok ? 'OK' : 'FAIL'} ${r.name}${r.details ? ` (${r.details})` : ''}`)
                        .join('\n');
                      Swal.fire(
                        bottomSheet({
                          title: failed.length === 0 ? 'Endpoint Health: All Good' : 'Endpoint Health: Issues Found',
                          message,
                          icon: failed.length === 0 ? 'success' : 'alert',
                        })
                      );
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Endpoint health check</p>
                      <p className="text-xs text-gray-500">Run a quick API connectivity/status check</p>
                    </div>
                    <FiSettings className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Notification Settings Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
                    {/* Test Notification Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          testBrowserNotification();
                          Swal.fire(bottomSheet({
                            title: 'Test Notification Sent',
                            message: 'Check your browser for a test notification. Make sure notifications are enabled!',
                            icon: 'alert',
                          }));
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        title="Test single notification"
                      >
                        🧪 Test
                      </button>
                      <button
                        onClick={() => {
                          testNotificationTypes();
                          Swal.fire(bottomSheet({
                            title: 'Test Sequence Started',
                            message: 'You will receive 4 different notification types (DM, Like, Comment, Follow). Watch your notifications!',
                            icon: 'alert',
                          }));
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        title="Test multiple notification types"
                      >
                        📋 Test All
                      </button>
                      <button
                        onClick={() => {
                          const reset = resetNotificationPreferences();
                          setNotificationPrefs(reset);
                          Swal.fire(bottomSheet({
                            title: 'Preferences Reset',
                            message: 'Notification preferences were reset to defaults.',
                            icon: 'success',
                          }));
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                        title="Reset notification preferences"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-200 mb-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Enable Notifications</p>
                      <p className="text-sm text-gray-500">Receive push notifications on this device</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newPrefs = { ...notificationPrefs, enabled: !notificationPrefs.enabled };
                        setNotificationPrefs(newPrefs);
                        saveNotificationPreferences(newPrefs);
                        
                        if (newPrefs.enabled) {
                          setIsInitializingNotifications(true);
                          try {
                            await initializeNotifications();
                            Swal.fire(bottomSheet({
                              title: 'Notifications Enabled',
                              message: 'You will now receive browser notifications',
                              icon: 'success',
                            }));
                          } catch (error) {
                            console.error('Error initializing notifications:', error);
                            Swal.fire(bottomSheet({
                              title: 'Error',
                              message: 'Failed to enable notifications. Please check your browser settings.',
                              icon: 'alert',
                            }));
                          } finally {
                            setIsInitializingNotifications(false);
                          }
                        }
                      }}
                      disabled={isInitializingNotifications}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                        notificationPrefs.enabled ? 'bg-brand-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notificationPrefs.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Individual Notification Types */}
                  {notificationPrefs.enabled && (
                    <div className="space-y-3">
                      <NotificationToggle
                        label="Direct Messages"
                        description="When someone sends you a message"
                        enabled={notificationPrefs.directMessages}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, directMessages: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Group Chat"
                        description="When there is activity in your group conversations"
                        enabled={notificationPrefs.groupChats}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, groupChats: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Likes"
                        description="When someone likes your post"
                        enabled={notificationPrefs.likes}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, likes: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Comments"
                        description="When someone comments on your post"
                        enabled={notificationPrefs.comments}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, comments: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Replies"
                        description="When someone replies to your comment"
                        enabled={notificationPrefs.replies}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, replies: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Follows"
                        description="When someone follows you"
                        enabled={notificationPrefs.follows}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, follows: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Follow Requests"
                        description="When someone requests to follow you"
                        enabled={notificationPrefs.followRequests}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, followRequests: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Story Insights"
                        description="When you receive story insights"
                        enabled={notificationPrefs.storyInsights}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, storyInsights: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Questions"
                        description="When someone answers your question"
                        enabled={notificationPrefs.questions}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, questions: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Shares"
                        description="When someone shares your post"
                        enabled={notificationPrefs.shares}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, shares: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                      <NotificationToggle
                        label="Reclips"
                        description="When someone reclips your post"
                        enabled={notificationPrefs.reclips}
                        onChange={(enabled) => {
                          const newPrefs = { ...notificationPrefs, reclips: enabled };
                          setNotificationPrefs(newPrefs);
                          saveNotificationPreferences(newPrefs);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      logout();
                      nav('/login');
                    }}
                    className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comment Safety Modal */}
        {commentSafetyOpen && (
          <div className="fixed inset-0 z-[220] isolate bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCommentSafetyOpen(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Comment Safety</h2>
                <button onClick={() => setCommentSafetyOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Comment Filters</h3>
                    <button
                      onClick={() => {
                        const resetPrefs = { strictMode: false, customHiddenWords: [] };
                        setCommentModerationPrefs(resetPrefs);
                        setCommentModerationPreferences(resetPrefs);
                        setCommentWordDraft('');
                        Swal.fire(bottomSheet({
                          title: 'Comment Safety Reset',
                          message: 'Strict mode and hidden words were reset.',
                          icon: 'success',
                        }));
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  <NotificationToggle
                    label="Strict filtering"
                    description="Auto-hide warning-level negative comments"
                    enabled={commentModerationPrefs.strictMode}
                    onChange={(enabled) => {
                      const next = { ...commentModerationPrefs, strictMode: enabled };
                      setCommentModerationPrefs(next);
                      setCommentModerationPreferences(next);
                    }}
                  />

                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-900 mb-2">Hidden words and phrases</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentWordDraft}
                        onChange={(e) => setCommentWordDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const incoming = String(commentWordDraft || '').trim().toLowerCase();
                            if (!incoming) return;
                            const next = {
                              ...commentModerationPrefs,
                              customHiddenWords: Array.from(new Set([...(commentModerationPrefs.customHiddenWords || []), incoming])),
                            };
                            setCommentModerationPrefs(next);
                            setCommentModerationPreferences(next);
                            setCommentWordDraft('');
                          }
                        }}
                        placeholder="Add word or phrase to auto-hide"
                        className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <button
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
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
                      >
                        Add
                      </button>
                    </div>

                    {(commentModerationPrefs.customHiddenWords || []).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {commentModerationPrefs.customHiddenWords.map((word) => (
                          <button
                            key={word}
                            onClick={() => {
                              const next = {
                                ...commentModerationPrefs,
                                customHiddenWords: (commentModerationPrefs.customHiddenWords || []).filter((w) => w !== word),
                              };
                              setCommentModerationPrefs(next);
                              setCommentModerationPreferences(next);
                            }}
                            className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                            title="Remove hidden word"
                          >
                            {word} x
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">No hidden words added yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Hidden comments review</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-800">
                        {hiddenCommentQueue.length} pending
                      </span>
                      {filteredHiddenQueue.length > 0 && (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire(
                              bottomSheet({
                                title: 'Approve all visible?',
                                message: `This will approve ${filteredHiddenQueue.length} item(s) in the current filter.`,
                                icon: 'alert',
                                showCancelButton: true,
                                confirmButtonText: 'Approve all',
                                cancelButtonText: 'Cancel',
                              })
                            );
                            if (!result.isConfirmed) return;
                            await Promise.all(filteredHiddenQueue.map((item) => approveHiddenComment(item.id)));
                            const approvedIds = new Set(filteredHiddenQueue.map((item) => item.id));
                            setHiddenCommentQueue((prev) => prev.filter((row) => !approvedIds.has(row.id)));
                            showToast('Approved all visible items');
                          }}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Approve all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {(['all', 'comments', 'replies'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        onClick={() => setHiddenQueueFilter(filterKey)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                          hiddenQueueFilter === filterKey
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        {filterKey === 'all' ? 'All' : filterKey === 'comments' ? 'Comments' : 'Replies'}
                      </button>
                    ))}
                  </div>
                  {loadingHiddenCommentQueue ? (
                    <p className="text-xs text-gray-600 mt-2">Loading review queue...</p>
                  ) : filteredHiddenQueue.length === 0 ? (
                    <p className="text-xs text-gray-600 mt-2">No hidden comments to review right now.</p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                      {filteredHiddenQueue.map((item) => (
                        <div key={item.id} className="rounded-lg bg-white border border-amber-100 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900">
                                {item.userHandle} {item.isReply ? 'replied' : 'commented'}
                              </p>
                              <p className="text-xs text-gray-700 truncate">{item.text}</p>
                              {item.moderationReason ? (
                                <p className="text-[11px] text-amber-800 mt-0.5">
                                  Reason: {item.moderationReason}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  const post = myFeedPosts.find((p) => String(p.id) === String(item.postId));
                                  if (!post) {
                                    showToast('Post not found in your feed');
                                    return;
                                  }
                                  setMyFeedOpen(true);
                                  window.setTimeout(() => openMyFeedPost(post), 220);
                                }}
                                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Open post
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await approveHiddenComment(item.id);
                                  if (!ok) return;
                                  setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                  showToast('Comment approved');
                                }}
                                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  const result = await Swal.fire(
                                    bottomSheet({
                                      title: 'Delete hidden comment?',
                                      message: 'This action cannot be undone.',
                                      icon: 'alert',
                                      showCancelButton: true,
                                      confirmButtonText: 'Delete',
                                      cancelButtonText: 'Cancel',
                                    })
                                  );
                                  if (!result.isConfirmed) return;
                                  const ok = await deleteHiddenComment(item.id);
                                  if (!ok) return;
                                  setHiddenCommentQueue((prev) => prev.filter((row) => row.id !== item.id));
                                  showToast('Comment deleted');
                                }}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
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