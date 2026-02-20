import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar';
import { FiCamera, FiBookmark, FiMessageCircle, FiLock, FiUnlock, FiX, FiUser, FiMapPin, FiHeart, FiGlobe, FiEdit3, FiLink2, FiUsers, FiUserCheck, FiPlus, FiTwitter, FiInstagram, FiVideo, FiSettings, FiFileText } from 'react-icons/fi';
import Flag from '../components/Flag';
import { getUserCollections } from '../api/collections';
import type { Collection } from '../types';
import { posts } from '../api/posts';
import Swal from 'sweetalert2';
import { bottomSheet } from '../utils/swalBottomSheet';
import { setProfilePrivacy } from '../api/privacy';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';
import { getFollowedUsers } from '../api/posts';
import { fetchFollowers, fetchFollowing } from '../api/client';
import { getAvatarForHandle } from '../api/users';
import { 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  type NotificationPreferences,
  initializeNotifications
} from '../services/notifications';
import { testBrowserNotification, testNotificationTypes, testImageNotification } from '../utils/testNotifications';

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
  });
  const [countryFlag, setCountryFlag] = React.useState(user?.countryFlag || '');
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [collectionsOpen, setCollectionsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [draftsOpen, setDraftsOpen] = React.useState(false);
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
  const [placesTraveled, setPlacesTraveled] = React.useState<string>(user?.placesTraveled?.join(', ') || '');
  const [showProfilePictureModal, setShowProfilePictureModal] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>(getNotificationPreferences());
  const [isInitializingNotifications, setIsInitializingNotifications] = React.useState(false);
  
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
    if (user?.socialLinks) {
      setSocialLinks({
        website: user.socialLinks.website ?? '',
        x: user.socialLinks.x ?? '',
        instagram: user.socialLinks.instagram ?? '',
        tiktok: user.socialLinks.tiktok ?? ''
      });
    }
  }, [user?.socialLinks]);

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

  async function handleDeleteDraft(draftId: string) {
    try {
      await deleteDraft(draftId);
      await loadDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Signed In</h2>
          <p className="text-gray-600 mb-4">Please sign in to view your profile</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header - Sticky (light mode only) */}
      <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
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
              <h1 className="text-xl font-bold text-gray-900 truncate" title={user?.name}>
                {user?.name || 'Passport'}
              </h1>
            </div>

            {/* Right: Private/Public Toggle */}
            <div className="flex-shrink-0">
              <button
                onClick={handleTogglePrivacy}
                disabled={isTogglingPrivacy}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title={isPrivate ? 'Profile is private - Click to make public' : 'Profile is public - Click to make private'}
                aria-label={isPrivate ? 'Make profile public' : 'Make profile private'}
              >
                {isPrivate ? (
                  <FiLock className="w-5 h-5 text-gray-700" />
                ) : (
                  <FiUnlock className="w-5 h-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>

          {/* Tabs: Messages, Drafts, Collections, Settings */}
          <div className="flex items-center justify-around border-t border-gray-200 mt-3 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                nav('/inbox');
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors relative pointer-events-auto"
            >
              <FiMessageCircle className="w-5 h-5 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close other modals first
                setSettingsOpen(false);
                setCollectionsOpen(false);
                // Then open drafts
                setDraftsOpen(true);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors relative pointer-events-auto"
            >
              <FiFileText className="w-5 h-5 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">Drafts</span>
              {drafts.length > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {drafts.length > 9 ? '9+' : drafts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close other modals first
                setSettingsOpen(false);
                setDraftsOpen(false);
                // Then open collections
                loadCollections(); // Refresh collections before opening
                setCollectionsOpen(true);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors relative pointer-events-auto"
            >
              <FiBookmark className="w-5 h-5 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">Collections</span>
              {collections.length > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {collections.length > 9 ? '9+' : collections.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close other modals first
                setCollectionsOpen(false);
                setDraftsOpen(false);
                // Then open settings
                setSettingsOpen(true);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors pointer-events-auto"
            >
              <FiSettings className="w-5 h-5 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">Settings</span>
            </button>
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
                  <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={`${user.name}'s profile picture`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                        <span className="text-6xl font-bold text-white">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Change Button */}
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2 px-6 py-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                    <FiCamera className="w-6 h-6 text-gray-700" />
                    <span className="text-sm font-medium text-gray-700">Change</span>
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

        {/* Profile Cards - Airbnb style: white, rounded, subtle shadow, side-by-side */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Followers Card - top left */}
            <button
              onClick={() => setSelectedCard('followers')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.followers}
                icon={<FiUsers className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Followers</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{followersCount}</div>
              </div>
            </button>

            {/* Following Card - top right */}
            <button
              onClick={() => setSelectedCard('following')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.following}
                icon={<FiUserCheck className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Following</div>
                <div className="text-lg font-bold text-gray-900 mt-0.5">{followingCount}</div>
              </div>
            </button>

            {/* Bio Card */}
            <button
              onClick={() => setSelectedCard('bio')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.bio}
                icon={<FiEdit3 className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Bio</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {bio ? 'Edit bio' : 'Add bio'}
                </div>
              </div>
            </button>

            {/* Social Links Card */}
            <button
              onClick={() => setSelectedCard('social')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.social}
                icon={<FiLink2 className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Social Links</div>
                <div className="text-xs text-gray-500 mt-0.5">Add links</div>
              </div>
            </button>

            {/* Travel Info Card */}
            <button
              onClick={() => setSelectedCard('personal')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.personal}
                icon={<FiUser className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Travel Info</div>
                <div className="text-xs text-gray-500 mt-0.5">Edit details</div>
              </div>
            </button>

            {/* Location Card */}
            <button
              onClick={() => setSelectedCard('location')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.location}
                icon={<FiMapPin className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Location</div>
                <div className="text-xs text-gray-500 mt-0.5">Set location</div>
              </div>
            </button>

            {/* Interests Card */}
            <button
              onClick={() => setSelectedCard('interests')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.interests}
                icon={<FiHeart className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Interests</div>
                <div className="text-xs text-gray-500 mt-0.5">Add interests</div>
              </div>
            </button>

            {/* Country Flag Card */}
            <button
              onClick={() => setSelectedCard('flag')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl cursor-pointer bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full"
            >
              <ProfileCardImage
                imagePath={PROFILE_CARD_IMAGES.flag}
                icon={<FiGlobe className="w-6 h-6 text-gray-600" />}
              />
              <div className="text-center w-full">
                <div className="font-semibold text-sm text-gray-900">Country Flag</div>
                <div className="text-xs text-gray-500 mt-0.5">Select flag</div>
              </div>
            </button>
          </div>
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
                      onClick={() => {
                        const updatedUser = { ...user, bio };
                        login(updatedUser);
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
                    <button
                      onClick={() => {
                        const updatedUser = { ...user, socialLinks };
                        login(updatedUser);
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
                      onClick={() => {
                        const places = placesTraveled.split(',').map(p => p.trim()).filter(p => p);
                        const updatedUser = { ...user, placesTraveled: places };
                        login(updatedUser);
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
                      onClick={() => {
                        if (!national || !regional || !local) {
                          Swal.fire(bottomSheet({
                            title: 'Missing Information',
                            message: 'Please fill in all location fields (National, Regional, and Local)',
                            icon: 'alert',
                          }));
                          return;
                        }
                        const updatedUser = { ...user, national, regional, local };
                        login(updatedUser);
                        setSelectedCard(null);
                        // Dispatch event to update newsfeed
                        window.dispatchEvent(new CustomEvent('locationUpdated', {
                          detail: { national, regional, local }
                        }));
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
                      <div key={draft.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-1">
                              {new Date(draft.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-gray-900 line-clamp-2">
                              {draft.caption || 'No text'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteDraft(draft.id)}
                            className="p-2 hover:bg-red-100 rounded-full transition-colors"
                            title="Delete draft"
                          >
                            <FiX className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No drafts yet</p>
                )}
              </div>
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
                              <img
                                src={collection.thumbnailUrl}
                                alt={collection.name}
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                              />
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
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <button onClick={() => setSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="p-6 space-y-6">
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
    </div>
  );
}