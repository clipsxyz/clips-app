import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import Avatar from '../components/Avatar';
import { FiCamera, FiBookmark, FiMessageCircle, FiLock, FiUnlock, FiX, FiUser, FiMapPin, FiHeart, FiGlobe, FiEdit3, FiLink2, FiTwitter, FiInstagram, FiVideo, FiSettings, FiFileText } from 'react-icons/fi';
import Flag from '../components/Flag';
import { getUserCollections } from '../api/collections';
import type { Collection } from '../types';
import { posts } from '../api/posts';
import Swal from 'sweetalert2';
import { setProfilePrivacy } from '../api/privacy';
import { fetchRegionsForCountry, fetchCitiesForRegion } from '../utils/googleMaps';
import { getDrafts, deleteDraft, type Draft } from '../api/drafts';
import { getUnreadTotal } from '../api/messages';

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
  const [selectedCard, setSelectedCard] = React.useState<'bio' | 'social' | 'personal' | 'location' | 'interests' | 'flag' | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [placesTraveled, setPlacesTraveled] = React.useState<string>(user?.placesTraveled?.join(', ') || '');
  const [showProfilePictureModal, setShowProfilePictureModal] = React.useState(false);
  
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
      setSocialLinks(user.socialLinks);
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
        const result = await Swal.fire({
          title: 'Set Profile to Public?',
          html: `
            <div style="text-align: center; padding: 20px 0;">
              <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
                Your posts and stories will still be public on locations news feed.
              </p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Set to Public',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#0095f6',
          cancelButtonColor: '#ffffff',
          background: '#262626',
          color: '#ffffff',
          customClass: {
            popup: 'instagram-style-modal',
            title: 'instagram-modal-title',
            htmlContainer: 'instagram-modal-content',
            confirmButton: 'instagram-confirm-btn',
            cancelButton: 'instagram-cancel-btn',
            actions: 'instagram-modal-actions'
          },
          buttonsStyling: true,
          reverseButtons: false,
          focusConfirm: false,
          focusCancel: false
        });

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

      Swal.fire({
        title: newPrivacyState ? 'Profile Set to Private' : 'Profile Set to Public',
          html: `
          <div style="text-align: center; padding: 20px 0;">
            <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
              ${newPrivacyState 
                ? 'Your profile is now private. Only approved followers can view your profile and send you messages.' 
                : 'Your profile is now public. Anyone can view your profile and send you messages.'}
            </p>
          </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'Done',
        confirmButtonColor: '#0095f6',
        background: '#262626',
        color: '#ffffff',
        customClass: {
          popup: 'instagram-style-modal',
          title: 'instagram-modal-title',
          htmlContainer: 'instagram-modal-content',
          confirmButton: 'instagram-confirm-btn',
          actions: 'instagram-modal-actions'
        },
        buttonsStyling: true,
        timer: 3000,
        timerProgressBar: false
      });
    } catch (error) {
      console.error('Error toggling privacy:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to update privacy settings',
        icon: 'error'
      });
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
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Not Signed In</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please sign in to view your profile</p>
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
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8 relative">
          {/* Passport Title */}
          <h1 className="text-2xl font-bold mb-4 passport-shimmer">Passport</h1>
          
          {/* Top Bar - Messages, Drafts, Collections, Settings */}
          <div className="flex items-center justify-between mb-6 px-2">
            {/* Messages */}
            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => nav('/inbox')}
                className="relative flex items-center justify-center p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
                aria-label="Messages"
                title="Messages"
              >
                <FiMessageCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-pink-500 text-white text-[10px] leading-[18px] rounded-full text-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
            
            {/* Drafts */}
            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => setDraftsOpen(!draftsOpen)}
                className="flex items-center justify-center p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
                aria-label="Drafts"
                title="Drafts"
              >
                <FiFileText className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              
              {/* Drafts Dropdown */}
              {draftsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDraftsOpen(false)}
                  />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {drafts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No drafts yet
                        </div>
                      ) : (
                        drafts.map(draft => (
                          <div
                            key={draft.id}
                            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 group"
                          >
                            <video
                              src={draft.videoUrl}
                              className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                {new Date(draft.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {Math.floor(draft.videoDuration)}s
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setDraftsOpen(false);
                                  nav('/create/filters', { state: { videoUrl: draft.videoUrl, videoDuration: draft.videoDuration } });
                                }}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Continue editing"
                              >
                                <FiEdit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(draft.id)}
                                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete draft"
                              >
                                <FiX className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Collections */}
            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => setCollectionsOpen(!collectionsOpen)}
                className="flex items-center justify-center p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
                aria-label="Collections"
                title="Collections"
              >
                <FiBookmark className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>

              {/* Collections Dropdown */}
              {collectionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCollectionsOpen(false)}
                  />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {collections.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No collections yet
                        </div>
                      ) : (
                        collections.map(collection => (
                          <button
                            key={collection.id}
                            onClick={() => {
                              setCollectionsOpen(false);
                              nav(`/collection/${collection.id}`, { state: { collectionName: collection.name } });
                            }}
                            className="w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
                          >
                            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {collection.thumbnailUrl ? (
                                (() => {
                                  // Find the first post to check its mediaType
                                  const firstPost = collection.postIds.length > 0
                                    ? posts.find(p => p.id === collection.postIds[0])
                                    : null;
                                  const isVideo = firstPost?.mediaType === 'video' ||
                                    collection.thumbnailUrl.toLowerCase().endsWith('.mp4') ||
                                    collection.thumbnailUrl.toLowerCase().endsWith('.webm') ||
                                    collection.thumbnailUrl.toLowerCase().endsWith('.mov');
                                  return isVideo ? (
                                    <video
                                      src={collection.thumbnailUrl}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                      onLoadedMetadata={(e) => {
                                        // Ensure first frame is shown
                                        const video = e.currentTarget;
                                        video.currentTime = 0;
                                      }}
                                    />
                                  ) : (
                                    <img
                                      src={collection.thumbnailUrl}
                                      alt={collection.name}
                                      className="w-full h-full object-cover"
                                    />
                                  );
                                })()
                              ) : (
                                <FiBookmark className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {collection.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {collection.postIds.length} {collection.postIds.length === 1 ? 'post' : 'posts'}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Settings */}
            <div className="relative flex-1 flex justify-center">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center justify-center p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow"
                aria-label="Settings"
                title="Settings"
              >
                <FiSettings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>

              {/* Settings Dropdown */}
              {settingsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSettingsOpen(false)}
                  />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          logout();
                          nav('/login', { replace: true });
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Profile Picture and Info - Centered */}
          <div className="relative inline-block mb-4 mx-auto">
            <button
              onClick={() => setShowProfilePictureModal(true)}
              className="cursor-pointer group relative"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.name}
                size="xl"
                className="border-4 border-white dark:border-gray-800 shadow-xl group-hover:shadow-2xl transition-all duration-200"
              />
              <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <FiCamera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </button>
            {/* Animated "Tap to change" message */}
            <div className="absolute top-1/2 -translate-y-1/2 left-full ml-4 whitespace-nowrap">
              <div className="profile-picture-tooltip bg-gray-900 dark:bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                Tap to change
              </div>
            </div>
          </div>
          
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
                    <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-2xl">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={`${user.name}'s profile picture`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-6xl font-bold text-white">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Change Button */}
                  <label className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                      <FiCamera className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Change</span>
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
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{user.name}</h1>
            <button
              onClick={handleTogglePrivacy}
              disabled={isTogglingPrivacy}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isPrivate ? 'Profile is private - Click to make public' : 'Profile is public - Click to make private'}
              aria-label={isPrivate ? 'Make profile public' : 'Make profile private'}
            >
              {isPrivate ? (
                <FiLock className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <FiUnlock className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
          <p className="text-brand-600 dark:text-brand-400 font-medium">@{user.handle}</p>
          {isPrivate && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-center gap-1">
              <FiLock className="w-3 h-3" />
              Your profile is private
            </p>
          )}
        </div>

        {/* Profile Cards - Styled like CreatePage templates */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Bio Card - Pink */}
            <button
              onClick={() => setSelectedCard('bio')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-pink-400 dark:border-pink-500 hover:border-pink-500 dark:hover:border-pink-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-pink-100 group-hover:to-pink-200 dark:group-hover:from-pink-900 dark:group-hover:to-pink-800 transition-all duration-200">
                <FiEdit3 className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Bio</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {bio ? 'Edit bio' : 'Add bio'}
                </div>
              </div>
            </button>

            {/* Social Links Card - Green */}
            <button
              onClick={() => setSelectedCard('social')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-green-400 dark:border-green-500 hover:border-green-500 dark:hover:border-green-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-green-100 group-hover:to-green-200 dark:group-hover:from-green-900 dark:group-hover:to-green-800 transition-all duration-200">
                <FiLink2 className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Social Links</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add links</div>
              </div>
            </button>

            {/* Travel Info Card - Orange */}
            <button
              onClick={() => setSelectedCard('personal')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-orange-400 dark:border-orange-500 hover:border-orange-500 dark:hover:border-orange-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-orange-100 group-hover:to-orange-200 dark:group-hover:from-orange-900 dark:group-hover:to-orange-800 transition-all duration-200">
                <FiUser className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Travel Info</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Edit details</div>
              </div>
            </button>

            {/* Location Card - Blue */}
            <button
              onClick={() => setSelectedCard('location')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-blue-400 dark:border-blue-500 hover:border-blue-500 dark:hover:border-blue-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-blue-100 group-hover:to-blue-200 dark:group-hover:from-blue-900 dark:group-hover:to-blue-800 transition-all duration-200">
                <FiMapPin className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Location</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Set location</div>
              </div>
            </button>

            {/* Interests Card - Yellow */}
            <button
              onClick={() => setSelectedCard('interests')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-yellow-400 dark:border-yellow-500 hover:border-yellow-500 dark:hover:border-yellow-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-yellow-100 group-hover:to-yellow-200 dark:group-hover:from-yellow-900 dark:group-hover:to-yellow-800 transition-all duration-200">
                <FiHeart className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Interests</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add interests</div>
              </div>
            </button>

            {/* Country Flag Card - Red */}
            <button
              onClick={() => setSelectedCard('flag')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 group border-2 border-dashed border-red-400 dark:border-red-500 hover:border-red-500 dark:hover:border-red-400"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 group-hover:from-red-100 group-hover:to-red-200 dark:group-hover:from-red-900 dark:group-hover:to-red-800 transition-all duration-200">
                <FiGlobe className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Country Flag</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Select flag</div>
              </div>
            </button>
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
            
            {/* Bottom Sheet */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out translate-y-0"
              style={{ maxHeight: '85vh' }}
            >
              {/* Handle Bar */}
              <div className="flex items-center justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedCard === 'bio' && 'Edit Bio'}
                  {selectedCard === 'social' && 'Social Links'}
                  {selectedCard === 'personal' && 'Travel Information'}
                  {selectedCard === 'location' && 'Location Settings'}
                  {selectedCard === 'interests' && 'Interests'}
                  {selectedCard === 'flag' && 'Country Flag'}
                </h2>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close"
                >
                  <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Bio Form */}
                {selectedCard === 'bio' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        rows={6}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        This will be visible on your profile
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Email cannot be changed
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Website
                      </label>
                      <input
                        type="text"
                        value={socialLinks.website}
                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        X (Twitter)
                      </label>
                      <input
                        type="text"
                        value={socialLinks.x}
                        onChange={(e) => setSocialLinks({ ...socialLinks, x: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Instagram
                      </label>
                      <input
                        type="text"
                        value={socialLinks.instagram}
                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        TikTok
                      </label>
                      <input
                        type="text"
                        value={socialLinks.tiktok}
                        onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })}
                        placeholder="@username"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Places You've Traveled To
                      </label>
                      <input
                        type="text"
                        value={placesTraveled}
                        onChange={(e) => setPlacesTraveled(e.target.value)}
                        placeholder="e.g., Paris, London, Tokyo, New York"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Separate multiple places with commas
                      </p>
                    </div>
                    {user.placesTraveled && user.placesTraveled.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        National (Country) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={national}
                        onChange={(e) => {
                          setNational(e.target.value);
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Regional (State/Province/City) <span className="text-red-500">*</span>
                      </label>
                      {loadingRegions ? (
                        <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading regions...</span>
                        </div>
                      ) : regionalOptions.length > 0 ? (
                        <select
                          value={regional}
                          onChange={(e) => {
                            setRegional(e.target.value);
                          }}
                          disabled={!national}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      ) : (
                        <input
                          type="text"
                          value={regional}
                          onChange={(e) => setRegional(e.target.value)}
                          placeholder="Select country first"
                          disabled
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 cursor-not-allowed"
                        />
                      )}
                    </div>

                    {/* Local (Neighborhood/Town) - Last */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Local (Neighborhood/Town) <span className="text-red-500">*</span>
                      </label>
                      {loadingCities ? (
                        <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading local areas...</span>
                        </div>
                      ) : localOptions.length > 0 ? (
                        <select
                          value={local}
                          onChange={(e) => {
                            setLocal(e.target.value);
                          }}
                          disabled={!regional}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      ) : (
                        <input
                          type="text"
                          value={local}
                          onChange={(e) => setLocal(e.target.value)}
                          placeholder="Select region first"
                          disabled
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500 cursor-not-allowed"
                        />
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (!national || !regional || !local) {
                          Swal.fire({
                            title: 'Missing Information',
                            text: 'Please fill in all location fields (National, Regional, and Local)',
                            icon: 'warning',
                            confirmButtonColor: '#0095f6',
                            background: '#262626',
                            color: '#ffffff',
                            customClass: {
                              popup: 'instagram-style-modal',
                              title: 'instagram-modal-title',
                              htmlContainer: 'instagram-modal-content',
                              confirmButton: 'instagram-confirm-btn',
                              actions: 'instagram-modal-actions'
                            }
                          });
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Separate multiple interests with commas
                      </p>
                    </div>
                    {user.interests && user.interests.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className={`h-12 rounded-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${countryFlag === f ? 'ring-2 ring-brand-500 bg-brand-50 dark:bg-brand-900/20' : ''} px-1`}
                            aria-label={`Select flag ${f}`}
                          >
                            <Flag value={f} size={24} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Or paste your flag emoji
                      </label>
                      <input
                        value={countryFlag}
                        onChange={(e) => setCountryFlag(e.target.value)}
                        maxLength={8}
                        placeholder="🇮🇪"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent text-2xl"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
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
      </div>
    </div>
  );
}