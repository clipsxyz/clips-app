import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUser, FiPlusSquare, FiSearch, FiZap, FiHeart, FiMessageSquare, FiShare2, FiMapPin, FiRepeat, FiMaximize, FiBookmark, FiEye, FiTrendingUp, FiBarChart2, FiMoreHorizontal, FiVolume2, FiVolumeX, FiPlus, FiCheck, FiCamera, FiBell, FiBarChart, FiHelpCircle } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { DOUBLE_TAP_THRESHOLD, ANIMATION_DURATIONS } from './constants';
import TopBar from './components/TopBar';
import CommentsModal from './components/CommentsModal';
import ShareModal from './components/ShareModal';
import ScenesModal from './components/ScenesModal';
import CreateModal from './components/CreateModal';
import TaggedUsersBottomSheet from './components/TaggedUsersBottomSheet';
import Avatar from './components/Avatar';
import { useAuth } from './context/Auth';
import { getFlagForHandle, getAvatarForHandle } from './api/users';
import Flag from './components/Flag';
import { useOnline } from './hooks/useOnline';
import { getUnreadTotal } from './api/messages';
import { getUnreadNotificationCount } from './api/notifications';
import { getStoryInsightsForUser } from './api/stories';
import { fetchPostsPage, fetchPostsByUser, toggleFollowForPost, toggleLike, addComment, incrementViews, incrementShares, reclipPost, decorateForUser, getState, setFollowState, deletePost } from './api/posts';
import { updatePost } from './api/client';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle, wasEverAStory } from './api/stories';
import { enqueue, drain } from './utils/mutationQueue';
import { timeAgo } from './utils/timeAgo';
import { getActiveAds, trackAdImpression, trackAdClick } from './api/ads';
import { getActiveBoost, getBoostTimeRemaining } from './api/boost';
import BoostSelectionModal from './components/BoostSelectionModal';
import SavePostModal from './components/SavePostModal';
import PostMenuModal from './components/PostMenuModal';
import EditPostModal from './components/EditPostModal';
import ShareToStoriesModal from './components/ShareToStoriesModal';
import { getCollectionsForPost } from './api/collections';
import type { Post, Ad, StickerOverlay } from './types';
import StickerOverlayComponent from './components/StickerOverlay';
import EffectWrapper from './components/EffectWrapper';
import type { EffectConfig } from './utils/effects';
import ProgressiveImage from './components/ProgressiveImage';
import ZoomableMedia from './components/ZoomableMedia';
import { getInstagramImageDimensions, getImageSize } from './utils/imageDimensions';
import Swal from 'sweetalert2';

// Global map to store video playback times per post ID for seamless transitions
const videoTimesMap = new Map<string, number>();
const videoMutedMap = new Map<string, boolean>();

type Tab = string; // Dynamic based on user location

function BottomNav({ onCreateClick }: { onCreateClick: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();

  // Get user initials for fallback
  const getUserInitials = (name: string): string => {
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const userInitials = user?.name ? getUserInitials(user.name) : 'U';

  const handleHomeClick = () => {
    nav('/feed');
    // Dispatch event to reset feed state
    window.dispatchEvent(new CustomEvent('resetFeed'));
  };

  // Helper to create square icon container (Uber Eats style)
  const createSquareIcon = (icon: React.ReactNode, isActive: boolean) => {
    return (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
        isActive 
          ? 'bg-gray-900 dark:bg-gray-100' 
          : 'bg-transparent border border-white'
      }`}>
        <div className={isActive ? 'text-white dark:text-gray-900' : 'text-white'}>
          {icon}
        </div>
      </div>
    );
  };

  const item = (path: string, label: string, icon: React.ReactNode, onClick?: () => void, isCustomIcon?: boolean) => {
    const active = loc.pathname === path;
    
    // For custom icons (like profile), render as-is but wrap in square container
    if (isCustomIcon) {
      return (
        <button
          onClick={onClick || (() => nav(path))}
          className="flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 active:scale-95"
          aria-current={active ? 'page' : undefined}
          title={label}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
            active 
              ? 'bg-gray-900 dark:bg-gray-100' 
              : 'bg-transparent border border-white'
          }`}>
            {icon}
          </div>
          <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
            active 
              ? 'text-gray-900 dark:text-white' 
              : 'text-white'
          }`}>
            {label}
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={onClick || (() => nav(path))}
        className="flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 active:scale-95"
        aria-current={active ? 'page' : undefined}
        title={label}
      >
        {createSquareIcon(icon, active)}
        <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
          active 
            ? 'text-gray-900 dark:text-white' 
            : 'text-white'
        }`}>
          {label}
        </span>
      </button>
    );
  };

  // Profile picture icon - square with rounded corners (Uber Eats style)
  const profileIcon = (
    <div className="w-full h-full rounded-lg overflow-hidden bg-gray-700 dark:bg-gray-600 flex items-center justify-center relative">
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt="Profile"
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            const fallback = img.parentElement?.querySelector('.profile-fallback');
            if (fallback) {
              (fallback as HTMLElement).style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span className="profile-fallback text-white text-xs font-semibold absolute inset-0 flex items-center justify-center" style={{ display: user?.avatarUrl ? 'none' : 'flex' }}>
        {userInitials}
      </span>
    </div>
  );

  return (
    <nav aria-label="Primary navigation" className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent z-40 pb-safe backdrop-blur-sm">
      <div className="mx-auto max-w-md flex items-center justify-around px-2 py-1">
        {item('/feed', 'Home', <FiHome size={16} />, handleHomeClick)}
        {item('/boost', 'Boost', <FiZap size={16} />)}
        {item('/create', 'Create', <FiPlusSquare size={16} />, onCreateClick)}
        {item('/search', 'Search', <FiSearch size={16} />)}
        {item('/profile', 'Passport', profileIcon, undefined, true)}
      </div>
    </nav>
  );
}

export default function App() {
  const navigate = useNavigate();
  const loc = useLocation();
  const [activeTab, setActiveTab] = React.useState<string>('Ireland');
  const [customLocation, setCustomLocation] = React.useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Determine current filter - custom location overrides tabs
  const currentFilter = customLocation || activeTab;

  return (
    <>
      <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800" style={{ backgroundColor: '#030712' }}>
        {loc.pathname !== '/login' && loc.pathname !== '/feed' && loc.pathname !== '/profile' && loc.pathname !== '/clip' && loc.pathname !== '/stories' && !loc.pathname.startsWith('/user/') && <TopBar activeTab={currentFilter} onLocationChange={setCustomLocation} />}
        <Outlet context={{ activeTab, setActiveTab, customLocation, setCustomLocation }} />
        {loc.pathname !== '/discover' && loc.pathname !== '/create/filters' && loc.pathname !== '/create/instant' && loc.pathname !== '/payment' && loc.pathname !== '/clip' && loc.pathname !== '/create' && loc.pathname !== '/template-editor' && loc.pathname !== '/login' && (
          <BottomNav onCreateClick={() => navigate('/create/instant')} />
        )}
      </main>

      {/* Create Modal */}
      <CreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onNavigate={(path) => navigate(path)}
      />
    </>
  );
}

function PillTabs(props: { active: Tab; onChange: (t: Tab) => void; onClearCustom?: () => void; userLocal?: string; userRegional?: string; userNational?: string; clipsCount?: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMountedRef = React.useRef(false);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [insightsCount, setInsightsCount] = React.useState(0);
  const [questionsCount, setQuestionsCount] = React.useState(0);
  const borderOverlayRef = React.useRef<HTMLDivElement>(null);
  const discoverBorderOverlayRef = React.useRef<HTMLDivElement>(null);
  const tabBorderOverlayRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});
  const prevActiveTabRef = React.useRef<Tab | null>(null);

  // Use user location from props or context, with fallback to defaults
  const local = props.userLocal || user?.local || 'Finglas';
  const regional = props.userRegional || user?.regional || 'Dublin';
  const national = props.userNational || user?.national || 'Ireland';
  const clipsCount = props.clipsCount || 0;

  // Track notification, insights, and questions counts
  React.useEffect(() => {
    if (!user?.handle) return;

    const updateCounts = async () => {
      try {
        // Update notification count
        const notifCount = await getUnreadNotificationCount(user.handle!);
        setNotificationCount(notifCount);

        // Update insights count
        const insights = await getStoryInsightsForUser(user.handle!);
        setInsightsCount(insights.length);

        // Update questions count
        try {
          const { getQuestionsForUser } = await import('./api/questions');
          const questions = await getQuestionsForUser(user.handle!);
          // Count only unanswered questions
          const unansweredQuestions = questions.filter(q => !q.repliedTo);
          setQuestionsCount(unansweredQuestions.length);
        } catch (error) {
          console.error('Error fetching questions count:', error);
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    // Initialize counts
    updateCounts();

    // Poll for updates every 10 seconds
    const interval = setInterval(updateCounts, 10000);

    // Listen for notification updates
    const handleNotificationUpdate = (event: CustomEvent) => {
      const handle = event.detail?.handle;
      if (handle === user.handle) {
        updateCounts();
      }
    };

    // Listen for new notifications being created
    const handleNotificationCreated = (event: CustomEvent) => {
      const notif = event.detail as { toHandle?: string };
      if (notif?.toHandle === user.handle) {
        updateCounts();
      }
    };

    window.addEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
    window.addEventListener('notificationCreated', handleNotificationCreated as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationsUpdated', handleNotificationUpdate as EventListener);
      window.removeEventListener('notificationCreated', handleNotificationCreated as EventListener);
    };
  }, [user?.handle]);

  // Main location / feed tabs (Clips and Discover are rendered beside the header)
  const tabs: Tab[] = [regional, national, 'Following'];


  // Easing function for smooth animation (ease-out cubic)
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Animate border reveal when active tab changes
  React.useEffect(() => {
    const currentTab = props.active;
    const prevTab = prevActiveTabRef.current;
    
    // Only animate if tab actually changed
    if (currentTab !== prevTab && currentTab) {
      const overlay = tabBorderOverlayRefs.current[currentTab];
      if (overlay) {
        // Reset overlay to start position
        overlay.style.maskImage = 'conic-gradient(from 0deg, black 360deg)';
        overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, black 360deg)';
        
        // Start animation
        const duration = 1800; // 1.8 seconds for smoother feel
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const rawProgress = Math.min(elapsed / duration, 1);
          // Apply easing for smoother animation
          const easedProgress = easeOutCubic(rawProgress);
          const angle = easedProgress * 360;
          
          // Create mask that reveals progressively going around
          const mask = `conic-gradient(from 0deg, transparent 0deg, transparent ${angle}deg, black ${angle}deg, black 360deg)`;
          overlay.style.maskImage = mask;
          overlay.style.webkitMaskImage = mask;
          
          if (rawProgress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Animation complete - make overlay fully transparent so border is fully visible
            overlay.style.maskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
            overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
          }
        };
        
        requestAnimationFrame(animate);
      }
    }
    
    prevActiveTabRef.current = currentTab;
  }, [props.active]);

  return (
    <div role="tablist" aria-label="Locations" className="sticky top-0 z-30 bg-[#030712] py-2 relative">
      {/* Scrim effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pointer-events-none z-0" />

      {/* Top header row with Clips on the left, centered Gazetteer logo, and Discover on the right */}
      <div className="relative z-10 mb-2 flex items-center px-2 sm:px-3 gap-1 sm:gap-2 min-w-0">
        {/* Left: Clips pill */}
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/stories');
            }}
            className="relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-300 hover:text-white transition-colors rounded-lg border-2 border-white"
          >
            <span className="relative z-10">Clips24</span>
          </button>
        </div>

        {/* Center: Gazetteer logo with wave */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/inbox');
            }}
            className="relative px-2 sm:px-4 py-1 flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
            aria-label="Go to notifications"
          >
            <div className="relative flex-shrink-0">
              <span className="relative z-10 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-white whitespace-nowrap">
                GAZETTEER
              </span>
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none gazetteer-wave-svg"
                viewBox="0 0 200 40"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="gazetteerWaveGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="transparent" stopOpacity="0" />
                    <stop offset="15%" stopColor="rgb(255, 140, 0)" stopOpacity="0.6" />
                    <stop offset="30%" stopColor="rgb(248, 0, 50)" stopOpacity="0.6" />
                    <stop offset="50%" stopColor="rgb(255, 0, 160)" stopOpacity="0.6" />
                    <stop offset="70%" stopColor="rgb(140, 40, 255)" stopOpacity="0.6" />
                    <stop offset="85%" stopColor="rgb(0, 35, 255)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M-20 26 C 20 4, 80 48, 140 8 S 240 42, 280 16"
                  fill="none"
                  stroke="url(#gazetteerWaveGradient)"
                  strokeWidth="24"
                  strokeLinecap="round"
                  className="gazetteer-wave-path"
                />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Green dot for notifications */}
              {notificationCount > 0 && (
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500"></div>
              )}
              {/* Purple dot for insights */}
              {insightsCount > 0 && (
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-500"></div>
              )}
              {/* Red dot for questions */}
              {questionsCount > 0 && (
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500"></div>
              )}
            </div>
          </button>
        </div>

        {/* Right: Discover pill */}
        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/discover');
            }}
            className="relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-300 hover:text-white transition-colors rounded-lg border-2 border-white"
          >
            <span className="relative z-10">Discover</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 relative z-10">
        {tabs.map(t => {
          const active = props.active === t;
          const id = `tab-${t}`;
          const panelId = `panel-${t}`;

          // Special handling for Discover, Clips, and Following tabs
          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (t === 'Discover') {
              navigate('/discover');
            } else if (t === 'Clips') {
              navigate('/stories');
            } else if (t === 'Following') {
              // Set active tab to Following and trigger following feed
              props.onChange('Following');
              window.dispatchEvent(new CustomEvent('setFollowingTab'));
              props.onClearCustom?.();
            } else {
              props.onChange(t);
              props.onClearCustom?.();
            }
          };

          // Format tab label
          const tabLabel = t;

          if (active) {
            // Check if this tab should have shimmer animation (regional, national, or Following)
            const shouldShimmer = t === regional || t === national || t === 'Following';

            return (
              <button
                key={t}
                id={id}
                role="tab"
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                onClick={handleClick}
                className="relative rounded-lg px-3 py-1.5 text-white text-sm font-medium transition-transform active:scale-[.98] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 flex items-center justify-center gap-1 max-w-[120px]"
                style={{
                  outline: 'none',
                  boxShadow: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Gradient border wrapper */}
                <div
                  className="absolute inset-0 rounded-lg p-0.5 overflow-hidden"
                  style={{
                    background: 'conic-gradient(from 0deg, rgb(255, 140, 0), rgb(248, 0, 50), rgb(255, 0, 160), rgb(140, 40, 255), rgb(0, 35, 255), rgb(25, 160, 255), rgb(255, 140, 0))',
                  }}
                >
                  {/* Overlay that covers border initially, then rotates to reveal it */}
                  <div
                    ref={(el) => { tabBorderOverlayRefs.current[t] = el; }}
                    className="absolute inset-0 bg-black rounded-lg"
                    style={{
                      maskImage: 'conic-gradient(from 0deg, black 360deg)',
                      WebkitMaskImage: 'conic-gradient(from 0deg, black 360deg)',
                    }}
                  />
                  <div className="w-full h-full rounded-lg bg-black relative z-10" />
                </div>
                {/* Content */}
                <span className="relative z-10 truncate whitespace-nowrap">
                  {shouldShimmer ? (
                    <span
                      className="truncate"
                      style={{
                        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0.3) 100%)',
                        backgroundSize: '200% 100%',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                        animation: 'shimmer 3s linear infinite',
                        display: 'inline-block'
                      }}
                    >
                      {tabLabel}
                    </span>
                  ) : (
                    <span className="truncate">{tabLabel}</span>
                  )}
                </span>
              </button>
            );
          }

          return (
            <button
              key={t}
              id={id}
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={handleClick}
              className="rounded-lg px-3 py-1.5 bg-black text-gray-600 dark:text-gray-500 text-sm font-medium transition-transform active:scale-[.98] hover:text-gray-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 opacity-60 max-w-[120px]"
              style={{
                outline: 'none',
                boxShadow: 'none',
                border: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span className="truncate whitespace-nowrap">{tabLabel}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}


function FollowButton({ initial, onToggle }: { initial: boolean; onToggle: () => Promise<void> }) {
  const [following, setFollowing] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setFollowing(v => !v);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? 'Unfollow user' : 'Follow user'}
      title={following ? 'Unfollow' : 'Follow'}
      className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-all duration-200 active:scale-[.98] flex items-center justify-center gap-2
        ${following
          ? 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
          : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
    >
      {following ? (
        <>
          <FiCheck className="w-4 h-4" />
          <span>Following</span>
        </>
      ) : (
        <span>Follow +</span>
      )}
    </button>
  );
}

function BoostButton({ postId, onBoost }: { postId: string; onBoost: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  const [isBoosted, setIsBoosted] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState(0);

  // Check boost status
  React.useEffect(() => {
    async function checkBoostStatus() {
      const boost = await getActiveBoost(postId);
      if (boost && boost.isActive) {
        setIsBoosted(true);
        const remaining = await getBoostTimeRemaining(postId);
        setTimeRemaining(remaining);
      } else {
        setIsBoosted(false);
        setTimeRemaining(0);
      }
    }

    checkBoostStatus();

    // Check every minute to update status
    const interval = setInterval(() => {
      checkBoostStatus();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [postId]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  async function onClick() {
    if (busy || isBoosted) return; // Don't allow clicking if already boosted
    setBusy(true);
    try {
      await onBoost();
    } finally {
      setBusy(false);
    }
  }

  if (isBoosted) {
    return (
      <button
        disabled
        aria-label="Post is boosted"
        title={`Boosted - ${formatTimeRemaining(timeRemaining)} remaining`}
        className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 bg-red-600 text-white dark:bg-red-500 flex items-center gap-2 cursor-not-allowed"
      >
        <FiZap className="w-4 h-4" />
        <span>Boosted</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label="Boost post"
      title="Boost this post"
      className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-all duration-200 active:scale-[.98] bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 flex items-center gap-2"
    >
      <FiZap className="w-4 h-4" />
      <span>Boost</span>
    </button>
  );
}

function PostHeader({ post, onFollow, isOverlaid = false, onMenuClick }: {
  post: Post;
  onFollow?: () => Promise<void>;
  isOverlaid?: boolean;
  onMenuClick?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasStory, setHasStory] = React.useState(false);
  const titleId = `post-title-${post.id}`;
  const userId = user?.id ?? 'anon';

  // Check if this is the current user's post
  const isCurrentUser = user?.handle === post.userHandle;
  // Use current user's avatarUrl if it's their post, otherwise get from handle
  const avatarSrc = isCurrentUser ? user?.avatarUrl : getAvatarForHandle(post.userHandle);

  // Check if user has unviewed stories using API
  React.useEffect(() => {
    async function checkStory() {
      try {
        let result;
        if (isCurrentUser) {
          // For current user, check if they have any stories at all
          result = await userHasStoriesByHandle(post.userHandle);
        } else {
          // For other users, check if current user has unviewed stories
          result = await userHasUnviewedStoriesByHandle(post.userHandle);
        }
        setHasStory(result);
      } catch (error) {
        console.error('Error checking story:', error);
      }
    }

    checkStory();
  }, [post.userHandle, isCurrentUser]);

  // Listen for stories viewed event
  React.useEffect(() => {
    function handleStoriesViewed(event: CustomEvent) {
      if (event.detail?.userHandle === post.userHandle) {
        // Re-check if user still has unviewed stories
        userHasUnviewedStoriesByHandle(post.userHandle)
          .then(setHasStory)
          .catch(console.error);
      }
    }

    function handleStoryCreated(event: CustomEvent) {
      // Re-check story status when a new story is created
      if (event.detail?.userHandle === post.userHandle) {
        if (isCurrentUser) {
          userHasStoriesByHandle(post.userHandle).then(setHasStory).catch(console.error);
        } else {
          userHasUnviewedStoriesByHandle(post.userHandle).then(setHasStory).catch(console.error);
        }
      }
    }

    window.addEventListener('storiesViewed', handleStoriesViewed as EventListener);
    window.addEventListener('storyCreated', handleStoryCreated as EventListener);
    return () => {
      window.removeEventListener('storiesViewed', handleStoriesViewed as EventListener);
      window.removeEventListener('storyCreated', handleStoryCreated as EventListener);
    };
  }, [post.userHandle, isCurrentUser]);

  const handleAvatarClick = () => {
    if (hasStory) {
      // Navigate to stories page with state to auto-open this user's stories
      navigate('/stories', { state: { openUserHandle: post.userHandle } });
    }
  };

  // Check if this is a reclipped post **by the current user**.
  // We only show the "reclipped" label when BOTH:
  // - the post is marked as reclipped AND
  // - local state says YOU reclipped it (userReclipped === true)
  // This prevents the UI from claiming you reclipped something when only the backend
  // or seed data says it's a reclip for someone else.
  const isReclippedPost =
    !!post.isReclipped &&
    !!post.originalUserHandle &&
    !!user?.handle &&
    post.userHandle === user.handle &&
    post.userReclipped === true;

  // Source of truth for follow state on feed cards:
  // read it directly from the shared follow state so the + / check
  // always matches what we've stored locally (even if post.isFollowing
  // was out of date).
  const isFollowingThisUser = React.useMemo(() => {
    try {
      const s = getState(userId);
      return !!s.follows[post.userHandle];
    } catch {
      // Fallback to whatever the post says if getState fails for any reason
      return !!post.isFollowing;
    }
  }, [userId, post.userHandle, post.isFollowing]);

  // Text colors based on whether header is overlaid on media
  const textColorClass = isOverlaid
    ? "text-white drop-shadow-md"
    : "text-gray-900 dark:text-gray-100";
  const subtextColorClass = isOverlaid
    ? "text-white/90 drop-shadow-md"
    : "text-gray-600 dark:text-gray-300";
  const separatorColorClass = isOverlaid
    ? "text-white/70"
    : "text-gray-400";
  const reclipColorClass = isOverlaid
    ? "text-white/90 drop-shadow-md"
    : "text-gray-500 dark:text-gray-400";

  return (
    <div className="relative flex items-start justify-between px-4 pt-4 pb-3">
      {/* Scrim effect - only show when overlaid on media */}
      {isOverlaid && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent pointer-events-none z-0" />
      )}

      {/* Content layer - above scrim */}
      <div className="relative z-10 flex items-start justify-between w-full">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative overflow-visible">
            <Avatar
              src={avatarSrc}
              name={post.userHandle.split('@')[0]} // Extract name from handle like "John@Dublin"
              size="sm"
              hasStory={hasStory}
              onClick={hasStory ? handleAvatarClick : undefined}
            />
            {/* + icon overlay on profile picture to follow (TikTok style) */}
            {!isCurrentUser && onFollow && !isFollowingThisUser && (
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onFollow) {
                    try {
                      await onFollow();
                    } catch (error) {
                      console.error('Error in onFollow from click:', error);
                    }
                  }
                }}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 border-2 border-white dark:border-gray-900 flex items-center justify-center transition-all duration-200 active:scale-90 shadow-lg z-30"
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  pointerEvents: 'auto'
                }}
                aria-label="Follow user"
              >
                <FiPlus className="w-3 h-3 text-white" strokeWidth={2.5} />
              </button>
            )}
            {/* Checkmark icon when following (replaces + icon) */}
            {!isCurrentUser && onFollow && isFollowingThisUser && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-lg z-30">
                <FiCheck className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="flex-1" onClick={(e) => e.stopPropagation()}>
            {/* Show reclip indicator if this is a reclipped post */}
            {isReclippedPost && (
              <div className={`text-xs mb-1 flex items-center gap-1 ${reclipColorClass}`}>
                <FiRepeat className="w-3 h-3" />
                <span>{post.userHandle} reclipped</span>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to original poster if reclipped, otherwise to reclipper
                navigate(`/user/${isReclippedPost ? post.originalUserHandle : post.userHandle}`);
              }}
              className={`text-left transition-opacity w-full ${isOverlaid ? 'hover:opacity-80' : 'hover:opacity-70'}`}
            >
              <h3 id={titleId} className={`font-semibold flex items-center gap-1.5 ${textColorClass}`}>
                <span>{isReclippedPost ? post.originalUserHandle : post.userHandle}</span>
                <Flag
                  value={isCurrentUser ? (user?.countryFlag || '') : (getFlagForHandle(isReclippedPost ? post.originalUserHandle! : post.userHandle) || '')}
                  size={16}
                />
              </h3>
            </button>
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-end gap-2">
          {/* Location and 3 dots - side by side */}
          <div className="flex items-center gap-2">
            {/* Story location - display only (where story was captured), not a feed filter */}
            {post.locationLabel && post.locationLabel !== 'Unknown Location' && (
              <span
                title={post.locationLabel}
                className={`px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 max-w-[120px] pointer-events-none select-none ${isOverlaid
                  ? 'bg-white/50 backdrop-blur-sm text-gray-800'
                  : 'bg-white/50 backdrop-blur-sm text-gray-800'
                  }`}
              >
                <span className="truncate whitespace-nowrap">{post.locationLabel}</span>
                <FiCamera className="w-2.5 h-2.5 text-gray-800 flex-shrink-0" />
              </span>
            )}
            {/* 3-dot menu button - no background, vertical dots */}
            {onMenuClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onMenuClick();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className={`p-1 transition-all active:scale-[.98] z-50 relative ${isOverlaid
                  ? 'text-white hover:opacity-70'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                aria-label="More options"
                title="More options"
              >
                <FiMoreHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {tags.slice(0, 5).map((t, i) => (
        <span
          key={i}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/50"
        >
          #{t}
        </span>
      ))}
    </div>
  );
}

function TextCard({ text, onDoubleLike, textStyle, stickers }: { text: string; onDoubleLike: () => Promise<void>; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string }; stickers?: StickerOverlay[]; userHandle?: string; locationLabel?: string; createdAt?: string }) {
  const [burst, setBurst] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const lastTap = React.useRef<number>(0);
  const touchHandled = React.useRef<boolean>(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      };
      updateSize();
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const shouldTruncate = text.length > 100;
  const displayText = shouldTruncate && !isExpanded ? text.substring(0, 100) + '...' : text;

  // Dark blue backgrounds inspired by your reference image
  const backgrounds = [
    '#1e3a8a', // Deep blue
    '#1e40af', // Rich blue
    '#1d4ed8', // Vibrant blue
    '#2563eb', // Electric blue
    '#3b82f6', // Bright blue
    '#1e293b', // Dark slate blue
    '#0f172a', // Very dark blue
    '#1a202c', // Dark navy
  ];

  // Use background from textStyle if provided, otherwise select based on text content
  const selectedBackground = textStyle?.background || (() => {
    const backgroundIndex = text.length % backgrounds.length;
    return backgrounds[backgroundIndex];
  })();

  // Get text size class - use normal readable size for feed display
  const getTextSizeClass = () => {
    return 'text-base'; // Normal readable text size like in the reference image
  };

  // Get text color from textStyle or default to white
  const textColor = textStyle?.color || 'white';

  async function handleTap() {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < 300) {
      // Double tap detected - only call onDoubleLike here
      setBurst(true);
      try {
        await onDoubleLike();
      } finally {
        setTimeout(() => setBurst(false), 600);
      }
    }
    // Always update lastTap for next potential double-tap
    lastTap.current = now;
  }

  function handleTouchEnd(_e: React.TouchEvent) {
    touchHandled.current = true;
    handleTap();
    // Prevent click event from firing after touch
    setTimeout(() => {
      touchHandled.current = false;
    }, 300);
  }

  function handleClick(e: React.MouseEvent) {
    // Prevent click if touch was already handled
    if (touchHandled.current) {
      e.preventDefault();
      return;
    }
    handleTap();
  }

  function handleMoreClick(e: React.MouseEvent) {
    e.stopPropagation(); // Prevent triggering double-tap like
    setIsExpanded(!isExpanded);
  }

  return (
    <div className="mx-4 mt-4 select-none max-w-full relative">
      {/* Decorative horizontal stripes on the left */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-8 flex flex-col gap-2 pointer-events-none z-0">
        <div className="w-12 h-0.5 bg-white/30"></div>
        <div className="w-12 h-0.5 bg-white/30"></div>
        <div className="w-12 h-0.5 bg-white/30"></div>
      </div>

      {/* Decorative horizontal stripes on the right */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-8 flex flex-col gap-2 pointer-events-none z-0">
        <div className="w-12 h-0.5 bg-white/30"></div>
        <div className="w-12 h-0.5 bg-white/30"></div>
        <div className="w-12 h-0.5 bg-white/30"></div>
      </div>

      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label="Double tap or press to like"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDoubleLike();
          }
        }}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        className="relative w-full rounded-lg bg-white shadow-lg z-10"
        style={{
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '16px',
          marginBottom: '12px'
        }}
      >
        {/* Speech bubble content */}
        <div className="text-base leading-relaxed whitespace-pre-wrap font-normal text-gray-800 break-words w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
          {displayText}
        </div>
        {shouldTruncate && (
          <div className="mt-3 flex justify-start">
            <button
              onClick={handleMoreClick}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors focus:outline-none focus:ring-0"
              style={{ outline: 'none', border: 'none', background: 'none' }}
              aria-label={isExpanded ? 'Show less' : 'Show more'}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}

        {/* Speech bubble tail - downward pointing triangle at bottom center */}
        <div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
          style={{
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '12px solid white'
          }}
        />

        {/* GIF/Sticker Overlays - Scaled down and repositioned for feed view */}
        {stickers && stickers.length > 0 && containerSize.width > 0 && (
          <>
            {stickers.map((overlay, index) => {
              // Scale down overlays in feed view to prevent overlap (60% of original size)
              const feedScale = 0.6;

              // Adjust position to avoid center where text typically is
              // If overlay is near center (45-55%), move it to edges
              let adjustedX = overlay.x;
              let adjustedY = overlay.y;

              if (overlay.x >= 45 && overlay.x <= 55 && overlay.y >= 45 && overlay.y <= 55) {
                // Move center-positioned overlays to corners/edges
                // Distribute them around the edges in a circle
                const total = stickers.length;
                const angle = (index / total) * Math.PI * 2;
                adjustedX = 50 + Math.cos(angle) * 30; // Spread around center
                adjustedY = 50 + Math.sin(angle) * 30;
                // Clamp to bounds (keep within 15-85% to avoid edges)
                adjustedX = Math.max(15, Math.min(85, adjustedX));
                adjustedY = Math.max(15, Math.min(85, adjustedY));
              }

              const adjustedOverlay = {
                ...overlay,
                scale: overlay.scale * feedScale,
                x: adjustedX,
                y: adjustedY
              };

              return (
                <StickerOverlayComponent
                  key={overlay.id}
                  overlay={adjustedOverlay}
                  onUpdate={() => { }} // Read-only in feed
                  onRemove={() => { }} // Read-only in feed
                  isSelected={false} // Read-only in feed
                  onSelect={() => { }} // Read-only in feed
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              );
            })}
          </>
        )}

        {/* Enhanced heart burst animation */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${burst ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="relative">
            {/* Main heart with Gazetteer gradient */}
            <svg className="w-20 h-20 drop-shadow-lg animate-pulse" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="heartGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff4ecb" />
                  <stop offset="50%" stopColor="#8f5bff" />
                  <stop offset="100%" stopColor="#ff4ecb" />
                </linearGradient>
              </defs>
              <path
                d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                fill="url(#heartGradientMain)"
              />
            </svg>

            {/* Floating hearts with softer gradient */}
            <div className="absolute inset-0">
              <div className={`absolute top-2 left-2 w-4 h-4 transition-all duration-500 ${burst ? 'opacity-100 translate-y-[-20px]' : 'opacity-0 translate-y-0'}`}>
                <svg viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="heartGradientSmall1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.9" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                    fill="url(#heartGradientSmall1)"
                  />
                </svg>
              </div>
              <div className={`absolute top-4 right-2 w-3 h-3 transition-all duration-700 delay-100 ${burst ? 'opacity-100 translate-y-[-25px] translate-x-[10px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="heartGradientSmall2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                    fill="url(#heartGradientSmall2)"
                  />
                </svg>
              </div>
              <div className={`absolute bottom-2 left-4 w-2 h-2 transition-all duration-600 delay-200 ${burst ? 'opacity-100 translate-y-[-15px] translate-x-[-8px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="heartGradientSmall3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.7" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                    fill="url(#heartGradientSmall3)"
                  />
                </svg>
              </div>
              <div className={`absolute bottom-4 right-4 w-3 h-3 transition-all duration-500 delay-150 ${burst ? 'opacity-100 translate-y-[-20px] translate-x-[5px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="heartGradientSmall4" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4ecb" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#8f5bff" stopOpacity="0.85" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                    fill="url(#heartGradientSmall4)"
                  />
                </svg>
              </div>
            </div>

            {/* Pulse rings */}
            <div className={`absolute inset-0 border-2 border-red-400 rounded-full transition-all duration-1000 ${burst ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}`}></div>
            <div className={`absolute inset-0 border border-red-300 rounded-full transition-all duration-1200 delay-100 ${burst ? 'opacity-0 scale-200' : 'opacity-100 scale-100'}`}></div>
          </div>
        </div>

        {/* Speech bubble tail/pointer at bottom center */}
        <div
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
          style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '12px solid white'
          }}
        />
      </div>
    </div>
  );
}

function CaptionText({ caption }: { caption: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const maxLength = 100;

  if (caption.length <= maxLength) {
    return (
      <div className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
        {caption}
      </div>
    );
  }

  const displayText = isExpanded ? caption : caption.substring(0, maxLength) + '...';

  return (
    <div className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed">
      {displayText}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 text-white text-xs font-medium hover:underline focus:outline-none focus:ring-0 focus:border-0 ml-2"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

// Bottom caption overlay with scrim - shows only first line with "more" icon
function BottomCaptionOverlay({ caption, onExpand }: { caption: string; onExpand?: () => void }) {
  // Split caption into lines and check if there's more than one line
  const lines = caption.split('\n').filter(line => line.trim().length > 0);
  const hasMoreLines = lines.length > 1;
  const firstLine = lines[0] || caption;

  // Also check if first line is too long (more than ~60 chars for single line display)
  const isFirstLineLong = firstLine.length > 60;
  const displayText = isFirstLineLong ? firstLine.substring(0, 60) + '...' : firstLine;
  const hasMore = hasMoreLines || isFirstLineLong;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      {/* Scrim effect - gradient overlay for better readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent pointer-events-none z-0" />

      {/* Content layer - above scrim */}
      <div className="relative z-10 px-4 pb-4 pt-6 pointer-events-auto">
        <div className="flex items-start gap-2">
          <p className="text-white text-sm leading-relaxed line-clamp-1 flex-1 drop-shadow-md">
            {displayText}
          </p>
          {hasMore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand?.();
              }}
              className="flex-shrink-0 p-1 text-white/90 hover:text-white transition-colors drop-shadow-md"
              aria-label="Show more"
            >
              <FiMoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Media({ url, mediaType, text, imageText, stickers, mediaItems, onDoubleLike, onOpenScenes, onCarouselIndexChange, onHeartAnimation, taggedUsers, onShowTaggedUsers, templateId: _templateId, videoCaptionsEnabled: _videoCaptionsEnabled, videoCaptionText: _videoCaptionText, subtitlesEnabled, subtitleText: _subtitleText, postUserHandle, postLocationLabel, postCreatedAt, postId, priority = false }: { url?: string; mediaType?: 'image' | 'video'; text?: string; imageText?: string; stickers?: StickerOverlay[]; mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: Array<any>; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>; onDoubleLike: () => Promise<void>; onOpenScenes?: () => void; onCarouselIndexChange?: (index: number) => void; onHeartAnimation?: (tapX: number, tapY: number) => void; taggedUsers?: string[]; onShowTaggedUsers?: () => void; templateId?: string; videoCaptionsEnabled?: boolean; videoCaptionText?: string; subtitlesEnabled?: boolean; subtitleText?: string; postUserHandle?: string; postLocationLabel?: string; postCreatedAt?: string; postId?: string; priority?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [burst, setBurst] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showControls, setShowControls] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isViewInScenesExpanded, setIsViewInScenesExpanded] = React.useState(true);
  const [showMuteButton, setShowMuteButton] = React.useState(true); // show when scroll onto card, hide after 2s; one tap brings back
  const muteButtonHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = React.useState(0); // 0..1 for video progress
  const [aspectRatio, setAspectRatio] = React.useState<number | null>(null); // width/height ratio
  const [tapPosition, setTapPosition] = React.useState<{ x: number; y: number } | null>(null);
  const lastTap = React.useRef<number>(0);
  const touchHandled = React.useRef<boolean>(false);
  const singleTapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingDoubleTap = React.useRef<boolean>(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const mediaContainerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  // Debug: Log taggedUsers when Media component receives them
  React.useEffect(() => {
    console.log('Media component - taggedUsers:', taggedUsers, 'onShowTaggedUsers:', !!onShowTaggedUsers, 'should show icon:', !!(taggedUsers && Array.isArray(taggedUsers) && taggedUsers.length > 0 && onShowTaggedUsers));
  }, [taggedUsers, onShowTaggedUsers]);

  // Determine if we have multiple media items (carousel)
  const items: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: Array<any>; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }> = mediaItems && mediaItems.length > 0 ? mediaItems : (url ? [{ url, type: (mediaType || 'image') as 'image' | 'video' }] : []);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const hasMultipleItems = items.length > 1;
  const currentItem = items[currentIndex];

  // Notify parent of carousel index changes
  React.useEffect(() => {
    if (onCarouselIndexChange && hasMultipleItems) {
      onCarouselIndexChange(currentIndex);
    }
  }, [currentIndex, hasMultipleItems, onCarouselIndexChange]);

  // Update container size for stickers
  React.useEffect(() => {
    if (mediaContainerRef.current && stickers && stickers.length > 0) {
      const updateSize = () => {
        const rect = mediaContainerRef.current?.getBoundingClientRect();
        if (rect) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      const observer = new ResizeObserver(updateSize);
      if (mediaContainerRef.current) {
        observer.observe(mediaContainerRef.current);
      }
      return () => {
        window.removeEventListener('resize', updateSize);
        observer.disconnect();
      };
    }
  }, [stickers, url, currentIndex]);

  // Video control functions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((error) => {
          console.error('Error playing video:', error);
        });
        setIsPlaying(true);
        setShowControls(false);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowControls(true);
      }
    }
  };

  // Removed duplicate handleVideoClick and handleVideoTouch - using unified handleTap instead

  const toggleMute = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMuted(prev => {
      const newMuted = !prev;
      // Update video element directly for immediate feedback
      if (videoRef.current) {
        videoRef.current.muted = newMuted;
      }
      // Store mute state for seamless transition to Scenes
      if (postId && videoMutedMap) {
        videoMutedMap.set(postId, newMuted);
      }
      return newMuted;
    });
  };

  // Restore video time when video loads (if returning from Scenes)
  React.useEffect(() => {
    if (currentItem?.type === 'video' && videoRef.current && postId && videoTimesMap) {
      const savedTime = videoTimesMap.get(postId);
      if (savedTime !== undefined && savedTime > 0) {
        const handleLoadedData = () => {
          if (videoRef.current && savedTime < videoRef.current.duration) {
            videoRef.current.currentTime = savedTime;
          }
        };
        videoRef.current.addEventListener('loadeddata', handleLoadedData);
        // Also try to set immediately if already loaded
        if (videoRef.current.readyState >= 2 && savedTime < videoRef.current.duration) {
          videoRef.current.currentTime = savedTime;
        }
        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener('loadeddata', handleLoadedData);
          }
        };
      }
    }
  }, [currentItem?.type, postId]);

  // Listen for resume video events (when returning from Scenes)
  React.useEffect(() => {
    if (!postId || currentItem?.type !== 'video') return;
    
    const handleResume = (e: CustomEvent) => {
      try {
        const v = videoRef.current;
        if (!v || e.detail?.time == null) return;
        const resumeTime = Number(e.detail.time);
        if (!Number.isFinite(resumeTime)) return;
        videoTimesMap.set(postId, resumeTime);
        const duration = Number(v.duration);
        if (Number.isFinite(duration) && resumeTime < duration) {
          v.currentTime = resumeTime;
          const checkAndPlay = () => {
            try {
              const v2 = videoRef.current;
              if (v2?.paused) {
                const rect = v2.getBoundingClientRect();
                const isInView = rect.top < window.innerHeight && rect.bottom > 0;
                if (isInView) {
                  v2.play().catch(() => {});
                  setIsPlaying(true);
                }
              }
            } catch (_) {}
          };
          checkAndPlay();
          setTimeout(checkAndPlay, 200);
        }
      } catch (err) {
        console.warn('Resume video handler error:', err);
      }
    };
    
    window.addEventListener(`resumeVideo-${postId}`, handleResume as EventListener);
    return () => {
      window.removeEventListener(`resumeVideo-${postId}`, handleResume as EventListener);
    };
  }, [postId, currentItem?.type]);

  // Listen for Scenes opening to pause feed video smoothly
  React.useEffect(() => {
    if (!postId || currentItem?.type !== 'video') return;
    
    const handleScenesOpening = () => {
      // Pause feed video when Scenes opens (after a brief delay for smooth transition)
      setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          // Save current time
          if (postId && videoTimesMap) {
            videoTimesMap.set(postId, videoRef.current.currentTime);
          }
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }, 150); // Small delay to allow Scenes video to sync
    };
    
    window.addEventListener(`scenesOpening-${postId}`, handleScenesOpening as EventListener);
    return () => {
      window.removeEventListener(`scenesOpening-${postId}`, handleScenesOpening as EventListener);
    };
  }, [postId, currentItem?.type]);

  // Intersection Observer for auto-play (wrapped in try/catch for mobile – avoids "Something went wrong" on phone)
  React.useEffect(() => {
    if (currentItem?.type !== 'video' || !videoRef.current) return;
    const videoEl = videoRef.current;
    try {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            try {
              if (entry.isIntersecting) {
                const v = videoRef.current;
                if (v) {
                  const duration = Number(v.duration);
                  const validDuration = Number.isFinite(duration) && duration > 0;
                  if (postId && videoTimesMap && validDuration) {
                    const savedTime = videoTimesMap.get(postId);
                    if (savedTime !== undefined && savedTime > 0 && savedTime < duration) {
                      v.currentTime = savedTime;
                    }
                  }
                  v.play().catch((err) => {
                    console.warn('Video play failed (e.g. mobile autoplay):', err);
                  });
                  setIsPlaying(true);
                }
                setShowMuteButton(true);
                if (muteButtonHideTimerRef.current) clearTimeout(muteButtonHideTimerRef.current);
                muteButtonHideTimerRef.current = setTimeout(() => {
                  setShowMuteButton(false);
                  muteButtonHideTimerRef.current = null;
                }, 2000);
              } else {
                const v = videoRef.current;
                if (v) {
                  if (postId && videoTimesMap) {
                    videoTimesMap.set(postId, v.currentTime);
                  }
                  v.pause();
                  setIsPlaying(false);
                  setShowControls(false);
                }
                if (muteButtonHideTimerRef.current) clearTimeout(muteButtonHideTimerRef.current);
                muteButtonHideTimerRef.current = null;
                setShowMuteButton(false);
              }
            } catch (err) {
              console.warn('IntersectionObserver callback error (mobile):', err);
            }
          });
        },
        { threshold: 0.5 }
      );
      observerRef.current.observe(videoEl);
    } catch (err) {
      console.warn('IntersectionObserver setup error:', err);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (muteButtonHideTimerRef.current) clearTimeout(muteButtonHideTimerRef.current);
    };
  }, [currentItem?.type, postId]);

  // Sync video muted state with isMuted state
  React.useEffect(() => {
    if (videoRef.current && currentItem?.type === 'video') {
      videoRef.current.muted = isMuted;
      // Store mute state for seamless transition to Scenes
      if (postId && videoMutedMap) {
        videoMutedMap.set(postId, isMuted);
      }
    }
  }, [isMuted, currentItem?.type, postId]);

  // Video event handlers
  const handleVideoLoad = () => {
    setIsLoading(false);
    setHasError(false);
    // Get video dimensions to calculate aspect ratio
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Media: Video load error', e);
    setIsLoading(false);
    setHasError(true);
  };

  // Image load handler to detect aspect ratio with Instagram clamping
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(false);
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Calculate clamped dimensions using Instagram rules
      const dimensions = getInstagramImageDimensions(img.naturalWidth, img.naturalHeight);
      setAspectRatio(dimensions.aspectRatio);
    }
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    setIsPaused(false);
    setShowControls(false);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    setIsPaused(true);
    setShowControls(true);
  };

  async function handleTap(e?: React.MouseEvent | React.TouchEvent) {
    // Prevent processing if already handling a double tap
    if (isProcessingDoubleTap.current) {
      return;
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    // Clear any pending single tap action
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }

    if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
      // Double tap detected
      isProcessingDoubleTap.current = true;

      // Get tap position relative to media container
      let tapX = 0;
      let tapY = 0;
      let clientX = 0;
      let clientY = 0;

      if (mediaContainerRef.current && e) {
        const rect = mediaContainerRef.current.getBoundingClientRect();

        if ('touches' in e && e.touches.length > 0) {
          // Touch event - use touch position
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if ('changedTouches' in e && e.changedTouches.length > 0) {
          // Touch end event - use changedTouches
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else if ('clientX' in e) {
          // Mouse event
          clientX = e.clientX;
          clientY = e.clientY;
        } else {
          // Fallback to center
          clientX = rect.left + rect.width / 2;
          clientY = rect.top + rect.height / 2;
        }

        tapX = clientX - rect.left;
        tapY = clientY - rect.top;
      } else {
        // Fallback to center if no event or container
        if (mediaContainerRef.current) {
          const rect = mediaContainerRef.current.getBoundingClientRect();
          tapX = rect.width / 2;
          tapY = rect.height / 2;
          clientX = rect.left + tapX;
          clientY = rect.top + tapY;
        }
      }

      // Set tap position for heart animation
      setTapPosition({ x: tapX, y: tapY });

      // Trigger heart animation callback
      if (onHeartAnimation) {
        onHeartAnimation(clientX, clientY);
      }

      // Show burst animation
      setBurst(true);

      try {
        // Call the like handler
        await onDoubleLike();
      } catch (error) {
        console.error('Error in double tap like:', error);
      } finally {
        // Smoothly fade out animations
        setTimeout(() => {
          setBurst(false);
        }, ANIMATION_DURATIONS.HEART_BURST);

        setTimeout(() => {
          setTapPosition(null);
          isProcessingDoubleTap.current = false;
        }, ANIMATION_DURATIONS.HEART_POPUP);
      }
    } else {
      // Single tap - wait to see if it's actually a double tap
      singleTapTimer.current = setTimeout(() => {
        // Only process single tap if no second tap came within threshold
        if (!isProcessingDoubleTap.current) {
          // For feed videos: single tap shows the mute button again (then it hides after 2s)
          if (currentItem?.type === 'video') {
            setShowMuteButton(true);
            if (muteButtonHideTimerRef.current) clearTimeout(muteButtonHideTimerRef.current);
            muteButtonHideTimerRef.current = setTimeout(() => {
              setShowMuteButton(false);
              muteButtonHideTimerRef.current = null;
            }, 2000);
          }
        }
        singleTapTimer.current = null;
      }, DOUBLE_TAP_THRESHOLD);
    }

    // Always update lastTap for next potential double-tap
    lastTap.current = now;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    try {
      e.preventDefault(); // Can throw on mobile if listener is passive
    } catch (_) {
      // Ignore – some mobile browsers don't allow preventDefault in passive touch
    }
    touchHandled.current = true;
    try {
      handleTap(e);
    } catch (err) {
      console.warn('Media handleTap error (touch):', err);
    }
    setTimeout(() => {
      touchHandled.current = false;
    }, 400);
  }

  function handleClick(e: React.MouseEvent) {
    if (touchHandled.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    try {
      handleTap(e);
    } catch (err) {
      console.warn('Media handleTap error (click):', err);
    }
  }

  // Set loading to false after timeout (fallback if image doesn't load)
  React.useEffect(() => {
    if (currentItem?.type === 'image' && isLoading) {
      const timeout = setTimeout(() => {
        console.warn('Image load timeout, setting loading to false');
        setIsLoading(false);
      }, 10000); // 10 second timeout
      return () => clearTimeout(timeout);
    }
  }, [currentItem?.type, isLoading]);

  // When switching to a video (e.g. carousel), show mute button for 2s
  React.useEffect(() => {
    if (currentItem?.type === 'video') {
      setShowMuteButton(true);
      if (muteButtonHideTimerRef.current) clearTimeout(muteButtonHideTimerRef.current);
      muteButtonHideTimerRef.current = setTimeout(() => {
        setShowMuteButton(false);
        muteButtonHideTimerRef.current = null;
      }, 2000);
    }
    return () => {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      if (muteButtonHideTimerRef.current) {
        clearTimeout(muteButtonHideTimerRef.current);
        muteButtonHideTimerRef.current = null;
      }
      // Reset double tap processing state
      isProcessingDoubleTap.current = false;
      // Clear tap position
      setTapPosition(null);
      setBurst(false);
    };
  }, [currentIndex]); // Reset when switching media items

  // Retract "View in Scenes" button after 2 seconds (for both video and image)
  React.useEffect(() => {
    if ((currentItem?.type === 'video' || currentItem?.type === 'image') && onOpenScenes && !isLoading) {
      setIsViewInScenesExpanded(true);
      const timer = setTimeout(() => {
        setIsViewInScenesExpanded(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentItem?.type, currentIndex, isLoading, onOpenScenes]);

  // Reset video state when switching items
  React.useEffect(() => {
    // Reset aspect ratio when switching items
    setAspectRatio(null);
    if (currentItem?.type === 'video' && videoRef.current) {
      setIsLoading(true);
      setIsPlaying(false);
      setIsPaused(false);
      setShowControls(false);
      setProgress(0);
      videoRef.current.load();
    } else if (currentItem?.type === 'image') {
      // Check if image is already loaded (cached images)
      // Use a small timeout to check after the ref is set
      setTimeout(() => {
        if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
          setIsLoading(false);
          setAspectRatio(imageRef.current.naturalWidth / imageRef.current.naturalHeight);
        } else {
          setIsLoading(true);
        }
      }, 0);
      setIsPlaying(false);
      setShowControls(false);
      setProgress(0);
    }
  }, [currentIndex, currentItem?.type]);

  // Check if image is already loaded (for cached images)
  React.useEffect(() => {
    if (currentItem?.type === 'image' && imageRef.current) {
      // Check immediately if image is already loaded
      if (imageRef.current.complete && imageRef.current.naturalWidth > 0) {
        setIsLoading(false);
        if (!aspectRatio) {
          setAspectRatio(imageRef.current.naturalWidth / imageRef.current.naturalHeight);
        }
      }
    }
  }, [currentItem?.url, currentItem?.type, aspectRatio]);

  // If this is a text-only post, render TextCard
  if (text && !url && (!mediaItems || mediaItems.length === 0)) {
    // textStyle will be passed from the post object
    return null; // Will be handled by FeedCard
  }

  // If no media at all, return null
  if (!currentItem) {
    return null;
  }

  function handleNext() {
    if (hasMultipleItems && currentIndex < items.length - 1) {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        return nextIndex < items.length ? nextIndex : prev;
      });
    }
  }

  function handlePrevious() {
    if (hasMultipleItems) {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function _handleDotClick(index: number) {
    setCurrentIndex(index);
  }

  // Calculate container style with Instagram aspect ratio clamping
  const containerStyle: React.CSSProperties = React.useMemo(() => {
    // If we have aspect ratio, use Instagram clamping
    if (aspectRatio) {
      const dimensions = getInstagramImageDimensions(
        window.innerWidth,
        window.innerWidth / aspectRatio
      );
      return {
        width: '100%',
        height: dimensions.height,
        maxHeight: '90vh', // Prevent extremely tall images
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
      };
    }

    // Default aspect ratio while loading
    return {
      aspectRatio: '9/16',
      maxHeight: '55vh',
      width: '100%',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    };
  }, [aspectRatio]);

  return (
    <div className="mx-0 my-0 select-none">
      <div
        ref={mediaContainerRef}
        role="button"
        tabIndex={0}
        aria-label="Open media. Double tap or press to like"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDoubleLike();
          } else if (hasMultipleItems && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            if (e.key === 'ArrowLeft') handlePrevious();
            else handleNext();
          }
        }}
        onClick={handleClick}
        onTouchStart={(e) => {
          // Don't handle touch start if it's a pinch gesture (2 touches) - let zoom component handle it
          if (e.touches.length === 2) {
            return;
          }
        }}
        onTouchMove={(e) => {
          // Don't handle touch move if it's a pinch gesture (2 touches) - let zoom component handle it
          if (e.touches.length === 2) {
            return;
          }
        }}
        onTouchEnd={(e) => {
          // Only handle touch end if not a pinch gesture (2 touches)
          if (e.touches.length === 0 || e.changedTouches.length === 1) {
            handleTouchEnd(e);
          }
        }}
        className="relative aspect-[9/16] max-h-[55vh] rounded-2xl overflow-hidden bg-gray-900 mx-auto shadow-lg"
        style={containerStyle}
      >
        {(() => {
          // Get effects for current media item
          const itemEffects = currentItem.effects || [];

          // Handle text-only clips - display as Twitter card preview
          if (currentItem.type === 'text') {
            // Extract text from data URL or use text property
            let textContent = '';
            let textStyle: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } | undefined;

            if ((currentItem as any).text) {
              textContent = (currentItem as any).text;
              textStyle = (currentItem as any).textStyle;
            } else if (currentItem.url && currentItem.url.startsWith('data:text/plain;base64,')) {
              try {
                const base64Text = currentItem.url.split(',')[1];
                textContent = atob(base64Text);
                textStyle = (currentItem as any).textStyle || { color: '#ffffff', size: 'medium', background: '#000000' };
              } catch (e) {
                console.error('Error decoding text from data URL:', e);
                textContent = 'Text content';
              }
            }

            // Display as Twitter card preview (white card with black text box)
            return (
              <div className="w-full h-full flex items-center justify-center p-4 bg-black">
                <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-2xl" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                  {/* Post Header */}
                  <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar
                        src={postUserHandle ? getAvatarForHandle(postUserHandle) : undefined}
                        name={postUserHandle ? postUserHandle.split('@')[0] : 'User'}
                        size="sm"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold flex items-center gap-1.5 text-gray-900 text-sm">
                          <span>{postUserHandle || 'User'}</span>
                          {postUserHandle && (
                            <Flag
                              value={getFlagForHandle(postUserHandle) || ''}
                              size={14}
                            />
                          )}
                        </h3>
                        <div className="text-xs text-gray-600 flex items-center gap-2 mt-0.5">
                          {postLocationLabel && postLocationLabel !== 'Unknown Location' && (
                            <>
                              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-gray-800 font-medium">
                                <span>{postLocationLabel}</span>
                                <FiCamera className="w-3.5 h-3.5 text-gray-800" />
                              </span>
                              {postCreatedAt && <span className="text-gray-400">·</span>}
                            </>
                          )}
                          {postCreatedAt && (
                            <span>{timeAgo(typeof postCreatedAt === 'string' ? parseInt(postCreatedAt) : postCreatedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Text Content - Twitter card style (white card with black text box) */}
                  <div className="p-4 w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div className="p-4 rounded-lg bg-black overflow-hidden w-full" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                      <div className="text-base leading-relaxed whitespace-pre-wrap font-normal text-white break-words w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
                        {textContent}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Match create post page exactly - use object-cover in fixed aspect container
          let mediaElement = currentItem.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentItem.url}
              className="w-full h-full object-cover"
              preload="metadata"
              playsInline
              muted={isMuted}
              loop
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              onLoadStart={() => console.log('Media: Video load started')}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={() => {
                const v = videoRef.current;
                if (v && v.duration > 0) {
                  setProgress(v.currentTime / v.duration);
                }
              }}
            >
              {/* Enable built-in captions if subtitles are enabled */}
              {subtitlesEnabled && (
                <track kind="captions" srcLang="en" label="English" default />
              )}
            </video>
          ) : (
            <ProgressiveImage
              src={currentItem.url}
              alt=""
              priority={priority}
              className="w-full h-full"
              onLoad={(e) => {
                // ProgressiveImage passes the event, use it directly
                if (e) {
                  handleImageLoad(e);
                }
              }}
              onError={handleImageError}
            />
          );

          // Apply effects in reverse order (last effect wraps everything)
          itemEffects.forEach((effect: EffectConfig) => {
            mediaElement = (
              <EffectWrapper key={effect.type} effect={effect} isActive={true}>
                {mediaElement}
              </EffectWrapper>
            );
          });

          return (
            <div className="relative w-full h-full">
              <ZoomableMedia>
                {mediaElement}
              </ZoomableMedia>

              {/* Loading Spinner */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
                  <div className="text-center text-white">
                    <div className="text-2xl mb-2">⚠️</div>
                    <div className="text-sm">Failed to load {currentItem.type}</div>
                  </div>
                </div>
              )}

              {/* Mute/Unmute Button - Center of video (show when scroll onto card, hide after 2s; one tap brings back) */}
              {!isLoading && !hasError && currentItem.type === 'video' && showMuteButton && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" style={{ touchAction: 'auto' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsMuted(prev => !prev);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsMuted(prev => !prev);
                    }}
                    className="p-3 rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors shadow-lg pointer-events-auto"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                    title={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? (
                      <FiVolumeX size={24} />
                    ) : (
                      <FiVolume2 size={24} />
                    )}
                  </button>
                </div>
              )}

              {/* View in Scenes Button - Bottom right for video and image (kept below bottom nav z-index) */}
              {!isLoading && !hasError && (currentItem.type === 'video' || currentItem.type === 'image') && onOpenScenes && (
                <div className="absolute bottom-4 right-4 z-20 pointer-events-auto" style={{ touchAction: 'auto' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Store current video time before opening Scenes for seamless transition
                      if (videoRef.current && postId) {
                        const currentTime = videoRef.current.currentTime;
                        videoTimesMap.set(postId, currentTime);
                        // Dispatch event to store time
                        window.dispatchEvent(new CustomEvent(`storeVideoTime-${postId}`, {
                          detail: { time: currentTime }
                        }));
                      }
                      // Don't pause immediately - let ScenesModal handle the transition
                      // This allows for a smoother, Instagram-like experience
                      onOpenScenes();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Store current video time before opening Scenes for seamless transition
                      if (videoRef.current && postId) {
                        const currentTime = videoRef.current.currentTime;
                        videoTimesMap.set(postId, currentTime);
                        // Dispatch event to store time
                        window.dispatchEvent(new CustomEvent(`storeVideoTime-${postId}`, {
                          detail: { time: currentTime }
                        }));
                      }
                      // Don't pause immediately - let ScenesModal handle the transition
                      // This allows for a smoother, Instagram-like experience
                      onOpenScenes();
                    }}
                    onMouseEnter={() => setIsViewInScenesExpanded(true)}
                    onMouseLeave={() => {
                      // Retract after 2 seconds when mouse leaves
                      setTimeout(() => {
                        setIsViewInScenesExpanded(false);
                      }, 2000);
                    }}
                    className={`${isViewInScenesExpanded ? 'px-2' : 'px-1.5'} py-1 bg-black/70 rounded text-white text-[10px] font-semibold hover:bg-black/90 active:bg-black transition-all duration-300 shadow-lg pointer-events-auto flex items-center gap-1`}
                    aria-label="View in Scenes"
                    title="View in Scenes"
                  >
                    <FiEye className="w-3 h-3 flex-shrink-0" />
                    {isViewInScenesExpanded && (
                      <span className="whitespace-nowrap">View in Scenes</span>
                    )}
                  </button>
                </div>
              )}

              {/* Paused Overlay - Mute Button Only (no play/pause control); same show/hide as center mute */}
              {isPaused && currentItem.type === 'video' && showMuteButton && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                  <div className="flex flex-col items-center gap-3">
                    {/* Centered Mute Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsMuted(prev => !prev);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsMuted(prev => !prev);
                      }}
                      className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors pointer-events-auto z-50"
                      aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                      title={isMuted ? 'Unmute video' : 'Mute video'}
                    >
                      {isMuted ? (
                        <FiVolumeX size={16} />
                      ) : (
                        <FiVolume2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              )}


            </div>
          );
        })()}

        {/* Carousel Navigation - Only show if multiple items */}
        {hasMultipleItems && (
          <>
            {/* Previous Button - Always show when not on first image - Positioned in middle left */}
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePrevious();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute top-1/2 left-4 w-10 h-10 rounded-full flex items-center justify-center transition-all z-50 pointer-events-auto bg-black/50 hover:bg-black/70 backdrop-blur-sm cursor-pointer"
                aria-label="Previous image"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'auto',
                  touchAction: 'manipulation'
                }}
              >
                <svg className="w-5 h-5 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next Button - Always show when not on last image - Positioned in middle right */}
            {currentIndex < items.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNext();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute top-1/2 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all z-50 pointer-events-auto bg-black/50 hover:bg-black/70 backdrop-blur-sm cursor-pointer"
                aria-label="Next image"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'auto',
                  touchAction: 'manipulation'
                }}
              >
                <svg className="w-5 h-5 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

          </>
        )}

        {/* Sticker Overlays */}
        {stickers && stickers.length > 0 && containerSize.width > 0 && (
          <>
            {stickers.map((overlay) => (
              <StickerOverlayComponent
                key={overlay.id}
                overlay={overlay}
                onUpdate={() => { }} // Read-only in feed
                onRemove={() => { }} // Read-only in feed
                isSelected={false} // Read-only in feed
                onSelect={() => { }} // Read-only in feed
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
              />
            ))}
          </>
        )}

        {/* Tagged Users Icon - Bottom of image/video */}
        {(() => {
          const hasTaggedUsers = taggedUsers && Array.isArray(taggedUsers) && taggedUsers.length > 0;
          const hasHandler = !!onShowTaggedUsers;
          const shouldShow = hasTaggedUsers && hasHandler;

          if (hasTaggedUsers && !hasHandler) {
            console.warn('Media: taggedUsers exists but onShowTaggedUsers is missing', { taggedUsers, onShowTaggedUsers });
          }
          if (shouldShow) {
            console.log('Media: Showing tag icon', { taggedUsers, count: taggedUsers.length });
          }

          return shouldShow;
        })() ? (
          <div className="absolute bottom-4 left-4 z-40">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Clear any pending single tap timer to prevent onOpenScenes from firing
                if (singleTapTimer.current) {
                  clearTimeout(singleTapTimer.current);
                  singleTapTimer.current = null;
                }
                onShowTaggedUsers?.();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Clear any pending single tap timer to prevent onOpenScenes from firing
                if (singleTapTimer.current) {
                  clearTimeout(singleTapTimer.current);
                  singleTapTimer.current = null;
                }
                onShowTaggedUsers?.();
              }}
              className="w-8 h-8 rounded-full bg-black bg-opacity-70 flex items-center justify-center hover:bg-opacity-90 transition-all shadow-lg"
              aria-label="View tagged users"
              title={`View ${taggedUsers?.length || 0} tagged ${(taggedUsers?.length || 0) === 1 ? 'person' : 'people'}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className="text-white"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Person silhouette - head and shoulders */}
                <path
                  d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        ) : null}
        {/* Image Text Overlay */}
        {imageText && currentItem?.type === 'image' && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div
              className="px-3 py-2 text-lg font-bold drop-shadow-lg"
              style={{
                background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57, #ff9ff3)',
                backgroundSize: '300% 300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'gradientShift 3s ease-in-out infinite'
              }}
            >
              {imageText}
            </div>
          </div>
        )}
        {/* Heart pop-up animation at tap position - doubled size with white to purple gradient */}
        {tapPosition && (
          <div
            className="absolute pointer-events-none z-50 transition-opacity duration-300"
            style={{
              left: `${tapPosition.x}px`,
              top: `${tapPosition.y}px`,
              transform: 'translate(-50%, -50%)',
              animation: 'heartPopUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            <svg className="w-40 h-40 drop-shadow-2xl" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="heartGradientTap" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#8f5bff" />
                </linearGradient>
              </defs>
              <path
                d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
                fill="url(#heartGradientTap)"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// Heart drop animation component - animates from tap position to like button
function HeartDropAnimation({ startX, startY, targetElement, onComplete }: { startX: number; startY: number; targetElement: HTMLElement; onComplete: () => void }) {
  const [progress, setProgress] = React.useState(0);
  const [endPosition, setEndPosition] = React.useState<{ x: number; y: number } | null>(null);
  const heartRef = React.useRef<HTMLDivElement>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!targetElement) return;

    // Get target position (like button center)
    try {
      const rect = targetElement.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;
      setEndPosition({ x: targetX, y: targetY });
      startTimeRef.current = Date.now();

      // Animate using requestAnimationFrame
      const animate = () => {
        if (!startTimeRef.current) return;

        const elapsed = Date.now() - startTimeRef.current;
        const duration = 800; // 800ms
        const t = Math.min(elapsed / duration, 1);

        // Ease-in function
        const eased = t * t;
        setProgress(eased);

        if (t < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          onComplete();
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } catch (error) {
      console.error('Error calculating heart animation target:', error);
      onComplete();
    }
  }, [targetElement, onComplete]);

  if (!endPosition) return null;

  const deltaX = endPosition.x - startX;
  const deltaY = endPosition.y - startY;
  const currentX = startX + deltaX * progress;
  const currentY = startY + deltaY * progress;
  const scale = 1 - (progress * 0.7); // Scale from 1 to 0.3
  const opacity = 1 - progress;

  return (
    <div
      ref={heartRef}
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: `${currentX}px`,
        top: `${currentY}px`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: opacity,
        transition: 'none'
      }}
    >
      <svg
        className="w-20 h-20 drop-shadow-lg"
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id="heartGradientDrop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4ecb" />
            <stop offset="50%" stopColor="#8f5bff" />
            <stop offset="100%" stopColor="#ff4ecb" />
          </linearGradient>
        </defs>
        <path
          d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"
          fill="url(#heartGradientDrop)"
        />
      </svg>
    </div>
  );
}

function EngagementBar({
  post,
  onLike,
  onShare: _onShare,
  onOpenComments,
  onReclip,
  onSave,
  currentUserHandle,
  currentUserId,
  showMetricsIcon,
  onToggleMetrics,
  isMetricsOpen,
  likeButtonRef
}: {
  post: Post;
  onLike: () => Promise<void>;
  onShare: () => Promise<void>;
  onOpenComments: () => void;
  onReclip: () => Promise<void>;
  onSave?: () => void;
  currentUserHandle?: string;
  currentUserId?: string;
  showMetricsIcon?: boolean;
  onToggleMetrics?: () => void;
  isMetricsOpen?: boolean;
  likeButtonRef?: React.RefObject<HTMLButtonElement>;
}) {
  const [isSaved, setIsSaved] = React.useState(false);
  const [showShareToStoriesModal, setShowShareToStoriesModal] = React.useState(false);

  // Check if post is saved
  React.useEffect(() => {
    async function checkIfSaved() {
      if (currentUserId && onSave) {
        try {
          const collections = await getCollectionsForPost(currentUserId, post.id);
          setIsSaved(collections.length > 0);
        } catch (error) {
          console.error('Error checking if post is saved:', error);
        }
      }
    }
    checkIfSaved();
  }, [currentUserId, post.id, onSave]);

  // Listen for save events
  React.useEffect(() => {
    if (!onSave) return;

    const handlePostSaved = () => {
      if (currentUserId) {
        getCollectionsForPost(currentUserId, post.id)
          .then(collections => setIsSaved(collections.length > 0))
          .catch(console.error);
      }
    };

    window.addEventListener(`postSaved-${post.id}`, handlePostSaved);
    return () => {
      window.removeEventListener(`postSaved-${post.id}`, handlePostSaved);
    };
  }, [post.id, currentUserId, onSave]);
  const [liked, setLiked] = React.useState(post.userLiked);
  const [likes, setLikes] = React.useState(post.stats.likes);
  const [views, setViews] = React.useState(post.stats.views);
  const [comments, setComments] = React.useState(post.stats.comments);
  const [shares, setShares] = React.useState(post.stats.shares);
  const [reclips, setReclips] = React.useState(post.stats.reclips);
  const [userReclipped, setUserReclipped] = React.useState(post.userReclipped || false);
  const [busy, setBusy] = React.useState(false);

  // Sync with post data changes
  React.useEffect(() => {
    setLiked(post.userLiked);
    setLikes(post.stats.likes);
    setViews(post.stats.views);
    setComments(post.stats.comments);
    setShares(post.stats.shares);
    setReclips(post.stats.reclips);
    setUserReclipped(post.userReclipped || false);
  }, [post.userLiked, post.stats.likes, post.stats.views, post.stats.comments, post.stats.shares, post.stats.reclips, post.userReclipped]);

  // Listen for engagement updates
  React.useEffect(() => {
    const handleCommentAdded = () => {
      setComments(prev => prev + 1);
    };

    const handleShareAdded = () => {
      setShares(prev => prev + 1);
    };

    const handleReclipAdded = () => {
      setReclips(prev => prev + 1);
    };

    const handleViewAdded = () => {
      setViews(prev => prev + 1);
    };

    const handleLikeToggled = (event: CustomEvent) => {
      setLiked(event.detail.liked);
      setLikes(event.detail.likes);
    };

    // Listen for all engagement events
    window.addEventListener(`commentAdded-${post.id}`, handleCommentAdded);
    window.addEventListener(`shareAdded-${post.id}`, handleShareAdded);
    window.addEventListener(`reclipAdded-${post.id}`, handleReclipAdded);
    window.addEventListener(`viewAdded-${post.id}`, handleViewAdded);
    window.addEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);

    // Listen for post updates (text/location edits)
    const handlePostUpdated = ((e: CustomEvent) => {
      const { text, location } = e.detail;
      // Update the post in the feed
      window.dispatchEvent(new CustomEvent(`updatePostInFeed-${post.id}`, {
        detail: { text, location }
      }));
    }) as EventListener;
    window.addEventListener(`postUpdated-${post.id}`, handlePostUpdated);

    return () => {
      window.removeEventListener(`commentAdded-${post.id}`, handleCommentAdded);
      window.removeEventListener(`shareAdded-${post.id}`, handleShareAdded);
      window.removeEventListener(`reclipAdded-${post.id}`, handleReclipAdded);
      window.removeEventListener(`viewAdded-${post.id}`, handleViewAdded);
      window.removeEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);
      window.removeEventListener(`postUpdated-${post.id}`, handlePostUpdated);
    };
  }, [post.id]);

  async function likeClick() {
    if (busy) return;
    setBusy(true);
    try {
      await onLike();
    } finally {
      setBusy(false);
    }
  }

  async function reclipClick() {
    if (busy) return;
    
    // Show confirmation modal
    const result = await Swal.fire({
      title: 'Gazetteer says',
      html: `
        <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Reshare this to followers?</p>
        <div style="text-align: center; padding: 20px 0;">
          <p style="color: #ffffff; font-size: 14px; line-height: 20px; margin: 0;">
            This post will be shared to your followers in their Following feed.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0095f6',
      cancelButtonColor: '#8e8e8e',
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
      allowOutsideClick: true,
      allowEscapeKey: true
    });

    // Only proceed if user clicked OK
    if (!result.isConfirmed) {
      return;
    }

    setBusy(true);
    try {
      await onReclip();
    } finally {
      setBusy(false);
    }
  }

  async function shareClick() {
    if (busy) return;
    // ShareToStoriesModal already has OK/Cancel buttons, so no need for additional confirmation
    setShowShareToStoriesModal(true);
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: '#030712' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Like */}
          <button
            ref={likeButtonRef}
            className="flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50"
            onClick={likeClick}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            title={liked ? 'Unlike' : 'Like'}
          >
            {liked ? (
              <AiFillHeart className="w-5 h-5 text-purple-500" />
            ) : (
              <FiHeart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300">{likes}</span>
          </button>

          {/* Views */}
          <div className="flex items-center gap-2">
            <FiEye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{views}</span>
          </div>

          {/* Comments */}
          <button
            className="flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50"
            onClick={onOpenComments}
            aria-label="Comments"
            title="Comments"
          >
            <FiMessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{comments}</span>
          </button>

          {/* Share to Stories */}
          <button
            className="flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50"
            onClick={shareClick}
            aria-label="Share post to stories"
            title="Share post to stories"
          >
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full bg-gray-600 dark:bg-gray-400"></div>
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="9"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  fill="none"
                />
                <line
                  x1="10"
                  y1="6"
                  x2="10"
                  y2="14"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="6"
                  y1="10"
                  x2="14"
                  y2="10"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{shares}</span>
          </button>

          {/* Reclip */}
          <button
            className={`flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50 ${post.userHandle === currentUserHandle ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={reclipClick}
            disabled={post.userHandle === currentUserHandle}
            aria-label={post.userHandle === currentUserHandle ? "Cannot reclip your own post" : "Reclip post"}
            title={post.userHandle === currentUserHandle ? "Cannot reclip your own post" : "Reclip post"}
          >
            <FiRepeat className={`w-5 h-5 ${userReclipped ? 'text-green-500' : 'text-gray-600 dark:text-gray-400'}`} />
            <span className="text-sm text-gray-700 dark:text-gray-300">{reclips}</span>
          </button>

          {/* Metrics (only on boost page for boosted posts) */}
          {showMetricsIcon && onToggleMetrics && (
            <button
              className="flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50"
              onClick={onToggleMetrics}
              aria-label="Toggle metrics"
              title="View metrics"
            >
              <FiBarChart2 className={`w-5 h-5 transition-colors ${isMetricsOpen ? 'text-brand-600 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
        </div>
      </div>
      <ShareToStoriesModal
        isOpen={showShareToStoriesModal}
        onClose={() => setShowShareToStoriesModal(false)}
        post={post}
      />
    </div>
  );
}

function BoostMetrics({ post, isOpen }: { post: Post; isOpen: boolean }) {
  const [isBoosted, setIsBoosted] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [feedType, setFeedType] = React.useState<string>('');

  React.useEffect(() => {
    async function checkBoost() {
      const boost = await getActiveBoost(post.id);
      if (boost && boost.isActive) {
        setIsBoosted(true);
        const remaining = await getBoostTimeRemaining(post.id);
        setTimeRemaining(remaining);

        // Get feed type label
        switch (boost.feedType) {
          case 'local':
            setFeedType('Local Newsfeed');
            break;
          case 'regional':
            setFeedType('Regional Newsfeed');
            break;
          case 'national':
            setFeedType('National Newsfeed');
            break;
        }
      } else {
        setIsBoosted(false);
      }
    }

    checkBoost();
    const interval = setInterval(checkBoost, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [post.id]);

  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!isBoosted) return null;

  return (
    <div className={`mx-4 mb-4 p-4 bg-white dark:bg-gray-900 rounded-xl border-2 border-brand-200 dark:border-brand-800 transition-all duration-300 overflow-hidden shadow-sm ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 p-0 mb-0'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiTrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Boost Metrics</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="px-2 py-1 bg-brand-100 dark:bg-brand-900 rounded-full text-brand-700 dark:text-brand-300 font-medium">
            {feedType}
          </span>
          <span className="text-gray-500 dark:text-gray-500">
            {formatTimeRemaining(timeRemaining)} left
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <FiEye className="w-4 h-4" />
            <span className="text-xs font-medium">Views</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.stats.views.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <FiHeart className="w-4 h-4" />
            <span className="text-xs font-medium">Likes</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.stats.likes.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <FiMessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium">Comments</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.stats.comments.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <FiShare2 className="w-4 h-4" />
            <span className="text-xs font-medium">Shares</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.stats.shares.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <FiRepeat className="w-4 h-4" />
            <span className="text-xs font-medium">Reclips</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {post.stats.reclips.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export const FeedCard = React.memo(function FeedCard({ post, onLike, onFollow, onShare, onOpenComments, onView, onReclip, onOpenScenes, showBoostIcon, onBoost, onDelete, priority = false }: {
  post: Post;
  onLike: () => Promise<void>;
  onFollow?: () => Promise<void>;
  onShare: () => Promise<void>;
  onOpenComments: () => void;
  onView: () => Promise<void>;
  onReclip: () => Promise<void>;
  onOpenScenes: () => void;
  showBoostIcon?: boolean;
  onBoost?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  priority?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const titleId = `post-title-${post.id}`;
  const [hasBeenViewed, setHasBeenViewed] = React.useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
  const [isBoosted, setIsBoosted] = React.useState(false);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const [showTaggedUsersModal, setShowTaggedUsersModal] = React.useState(false);
  const [heartAnimation, setHeartAnimation] = React.useState<{ startX: number; startY: number } | null>(null);
  const likeButtonRef = React.useRef<HTMLButtonElement>(null);
  const articleRef = React.useRef<HTMLElement>(null);

  // Debug: Log taggedUsers for template posts
  React.useEffect(() => {
    if (post.taggedUsers && post.taggedUsers.length > 0) {
      console.log('FeedCard - post has taggedUsers:', post.taggedUsers, 'post.id:', post.id.substring(0, 30), 'templateId:', post.templateId);
    } else if (post.templateId) {
      console.log('FeedCard - template post but NO taggedUsers:', { postId: post.id.substring(0, 30), templateId: post.templateId, taggedUsers: post.taggedUsers });
    }
  }, [post.taggedUsers, post.id, post.templateId]);

  // Check if post is boosted to show metrics icon
  React.useEffect(() => {
    async function checkBoost() {
      const boost = await getActiveBoost(post.id);
      setIsBoosted(boost !== null && boost.isActive);
    }
    if (showBoostIcon) {
      checkBoost();
      const interval = setInterval(checkBoost, 60000);
      return () => clearInterval(interval);
    }
  }, [post.id, showBoostIcon]);

  // Check if post is saved
  React.useEffect(() => {
    async function checkIfSaved() {
      if (user?.id) {
        try {
          const collections = await getCollectionsForPost(user.id, post.id);
          setIsSaved(collections.length > 0);
        } catch (error) {
          console.error('Error checking if post is saved:', error);
        }
      }
    }
    checkIfSaved();
  }, [user?.id, post.id]);

  // Listen for save events
  React.useEffect(() => {
    if (!user?.id) return;

    const handlePostSaved = () => {
      getCollectionsForPost(user.id, post.id)
        .then(collections => setIsSaved(collections.length > 0))
        .catch(console.error);
    };

    window.addEventListener(`postSaved-${post.id}`, handlePostSaved);
    return () => {
      window.removeEventListener(`postSaved-${post.id}`, handlePostSaved);
    };
  }, [post.id, user?.id]);

  // Track views when post comes into viewport (try/catch so mobile errors don't crash app)
  React.useEffect(() => {
    if (hasBeenViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenViewed) {
            setHasBeenViewed(true);
            observer.disconnect();
            try {
              onView();
            } catch (err) {
              console.warn('onView error:', err);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (articleRef.current) {
      try {
        observer.observe(articleRef.current);
      } catch (err) {
        console.warn('View observer observe error:', err);
      }
    }

    return () => observer.disconnect();
  }, [hasBeenViewed]);

  // Check if post has media
  const hasMedia = !!(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
  const isTextOnly = post.text && !post.mediaUrl && (!post.mediaItems || post.mediaItems.length === 0);

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="mx-0 mb-6 overflow-hidden border-0 border-b border-gray-200 dark:border-gray-700 animate-[cardBounce_0.6s_ease-out]" style={{ backgroundColor: '#030712' }}>
      {/* Show PostHeader normally for text-only posts */}
      {isTextOnly && <PostHeader post={post} onFollow={onFollow} isOverlaid={false} onMenuClick={() => setMenuOpen(true)} />}
      <TagRow tags={post.tags} />
      {post.isBoosted && (
        <div className="px-4 pt-2 pb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
            Sponsored
          </span>
          {post.boostFeedType && (
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">· {post.boostFeedType} boost</span>
          )}
        </div>
      )}
      <div className="relative w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* PostHeader overlaid on media for posts with media */}
        {hasMedia && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <PostHeader post={post} onFollow={onFollow} isOverlaid={true} onMenuClick={() => setMenuOpen(true)} />
            </div>
          </div>
        )}
        {isTextOnly ? (
          <TextCard
            text={post.text || ''}
            onDoubleLike={onLike}
            textStyle={post.textStyle}
            stickers={post.stickers}
            userHandle={post.userHandle}
            locationLabel={post.locationLabel}
            createdAt={post.createdAt?.toString()}
          />
        ) : (
          <Media
            url={post.mediaUrl}
            mediaType={post.mediaType}
            text={post.text}
            imageText={post.imageText}
            stickers={post.stickers}
            mediaItems={post.mediaItems}
            onDoubleLike={onLike}
            onOpenScenes={onOpenScenes}
            postId={post.id}
            onCarouselIndexChange={setCarouselIndex}
            onHeartAnimation={(clientX, clientY) => {
              // Small delay to ensure EngagementBar ref is set
              setTimeout(() => {
                setHeartAnimation({ startX: clientX, startY: clientY });
              }, 50);
            }}
            taggedUsers={post.taggedUsers}
            onShowTaggedUsers={() => setShowTaggedUsersModal(true)}
            templateId={post.templateId}
            videoCaptionsEnabled={post.videoCaptionsEnabled}
            videoCaptionText={post.videoCaptionText}
            subtitlesEnabled={post.subtitlesEnabled}
            subtitleText={post.subtitleText}
            postUserHandle={post.userHandle}
            postLocationLabel={post.locationLabel}
            postCreatedAt={post.createdAt?.toString()}
            priority={priority}
          />
        )}
        {/* Carousel Indicator - Overlaid on media with scrim */}
        {/* Show row if: multiple media items exist */}
        {post.mediaItems && post.mediaItems.length > 1 ? (
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            {/* Scrim effect - gradient overlay for better readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent pointer-events-none z-0" />

            {/* Content layer - above scrim */}
            <div className="relative z-10 px-4 py-3 pointer-events-auto">
              <div className="flex items-center justify-center">
                {/* Center - Carousel Display (Dots and Number) */}
                <div className="flex items-center gap-3">
                  {/* Baby Blue Dots */}
                  <div className="flex gap-1.5">
                    {post.mediaItems.map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full transition-all ${index === carouselIndex
                          ? 'w-6 bg-white'
                          : 'w-2 bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                  {/* Number Indicator */}
                  <span className="text-sm font-medium text-white drop-shadow-md">
                    {carouselIndex + 1} / {post.mediaItems.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {/* Caption and time for image/video posts */}
      {(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0)) && (
        <div className="px-4 py-3">
          {(post.caption || post.text) && (
            <CaptionText caption={post.caption || post.text || ''} />
          )}
          {post.createdAt && (
            <div className="mt-1 text-[10px] text-gray-500">
              {timeAgo(post.createdAt)}
            </div>
          )}
        </div>
      )}
      <EngagementBar
        post={post}
        onLike={onLike}
        onShare={onShare}
        onOpenComments={onOpenComments}
        onReclip={onReclip}
        currentUserHandle={user?.handle}
        currentUserId={user?.id}
        showMetricsIcon={showBoostIcon && isBoosted}
        onToggleMetrics={() => setIsMetricsOpen(!isMetricsOpen)}
        isMetricsOpen={isMetricsOpen}
        likeButtonRef={likeButtonRef}
      />
      {/* Heart animation from tap to like button - rendered after EngagementBar so ref is set */}
      {heartAnimation && likeButtonRef.current && (
        <HeartDropAnimation
          key={`heart-${post.id}-${heartAnimation.startX}-${heartAnimation.startY}`}
          startX={heartAnimation.startX}
          startY={heartAnimation.startY}
          targetElement={likeButtonRef.current}
          onComplete={() => setHeartAnimation(null)}
        />
      )}
      {/* News Ticker Banner */}
      {post.bannerText && (
        <div className="h-7 bg-black dark:bg-black overflow-hidden border-t border-gray-700 dark:border-gray-700">
          <div className="news-ticker-container h-full flex items-center">
            <div className="news-ticker-text text-white dark:text-white font-semibold text-xs whitespace-nowrap">
              {post.bannerText} • {post.bannerText} • {post.bannerText} • {post.bannerText}
            </div>
          </div>
        </div>
      )}
      {showBoostIcon && <BoostMetrics post={post} isOpen={isMetricsOpen} />}
      {user && (
        <>
          <PostMenuModal
            post={post}
            userId={user.id}
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            onCopyLink={() => { }}
            onShare={onShare}
            onReport={() => {
              // TODO: Implement report
              console.log('Report post:', post.id);
            }}
            onUnfollow={onFollow ? async () => { await onFollow(); } : undefined}
            onMute={async () => {
              // TODO: Implement mute
              console.log('Mute user:', post.userHandle);
            }}
            onBlock={async () => {
              // TODO: Implement block
              console.log('Block user:', post.userHandle);
            }}
            onHide={() => {
              // TODO: Implement hide
              console.log('Hide post:', post.id);
            }}
            onNotInterested={() => {
              // TODO: Implement not interested
              console.log('Not interested in post:', post.id);
            }}
            onDelete={onDelete}
            onEdit={() => {
              setMenuOpen(false);
              setEditModalOpen(true);
            }}
            onArchive={async () => {
              // TODO: Implement archive
              console.log('Archive post:', post.id);
            }}
            onBoost={onBoost}
            onReclip={onReclip}
            onTurnOnNotifications={() => {
              // TODO: Implement notifications
              console.log('Turn on notifications for post:', post.id);
            }}
            onTurnOffNotifications={() => {
              // TODO: Implement notifications
              console.log('Turn off notifications for post:', post.id);
            }}
            isCurrentUser={user.handle === post.userHandle}
            isFollowing={post.isFollowing === true}
            isSaved={isSaved}
            isMuted={false} // TODO: Check if muted
            isBlocked={false} // TODO: Check if blocked
            hasNotifications={false} // TODO: Check notifications
          />
          <SavePostModal
            post={post}
            userId={user.id}
            isOpen={saveModalOpen}
            onClose={() => setSaveModalOpen(false)}
          />
          <EditPostModal
            post={post}
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSave={async (text: string, location: string) => {
              try {
                // Try to update post via API
                await updatePost(post.id, { text, location });
              } catch (err: any) {
                // Check if it's a connection error (backend not running)
                const isConnectionError =
                  err?.message === 'CONNECTION_REFUSED' ||
                  err?.name === 'ConnectionRefused' ||
                  err?.message?.includes('Failed to fetch') ||
                  err?.message?.includes('ERR_CONNECTION_REFUSED') ||
                  err?.message?.includes('NetworkError');

                if (isConnectionError) {
                  // If backend isn't running, update locally as fallback
                  console.warn('Backend not available, updating post locally');
                  // Update the post in the feed directly
                  window.dispatchEvent(new CustomEvent(`updatePostInFeed-${post.id}`, {
                    detail: { text, location }
                  }));
                  // Don't throw - allow the modal to close
                  return;
                }
                // Re-throw other errors
                throw err;
              }
              // Notify parent to update the post in the feed
              window.dispatchEvent(new CustomEvent(`postUpdated-${post.id}`, {
                detail: { text, location }
              }));
            }}
          />
        </>
      )}
      {/* Tagged Users Bottom Sheet */}
      {post.taggedUsers && post.taggedUsers.length > 0 && (
        <TaggedUsersBottomSheet
          isOpen={showTaggedUsersModal}
          onClose={() => setShowTaggedUsersModal(false)}
          taggedUserHandles={post.taggedUsers}
        />
      )}
    </article>
  );
});

const AdCard = React.memo(function AdCard({ ad, onImpression, onClick }: {
  ad: Ad;
  onImpression: () => Promise<void>;
  onClick: () => Promise<void>;
}) {
  const titleId = `ad-title-${ad.id}`;
  const [hasBeenViewed, setHasBeenViewed] = React.useState(false);
  const articleRef = React.useRef<HTMLElement>(null);

  // Track impressions when ad comes into viewport (using epoch time)
  React.useEffect(() => {
    if (hasBeenViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenViewed) {
            setHasBeenViewed(true);
            observer.disconnect();
            onImpression();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (articleRef.current) {
      observer.observe(articleRef.current);
    }

    return () => observer.disconnect();
  }, [hasBeenViewed, onImpression]);

  const handleClick = async () => {
    await onClick();
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="mx-4 mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-[cardBounce_0.6s_ease-out]" style={{ backgroundColor: '#030712' }}>
      {/* Ad Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sponsored</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-600 dark:text-gray-300">{ad.advertiserHandle}</span>
        </div>
        {ad.createdAt && (
          <span className="text-xs text-gray-400">{timeAgo(ad.createdAt)}</span>
        )}
      </div>

      {/* Ad Content */}
      <div className="relative">
        <Media
          url={ad.mediaUrl}
          mediaType={ad.mediaType}
          onDoubleLike={async () => { }}
          onOpenScenes={() => { }}
        />
        <button
          onClick={handleClick}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-full font-semibold shadow-lg transition-colors"
        >
          {ad.callToAction || 'Learn More'}
        </button>
      </div>

      {/* Ad Description */}
      {ad.description && (
        <div className="px-4 py-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{ad.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">{ad.description}</p>
        </div>
      )}
    </article>
  );
});

function FeedPageWrapper() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const online = useOnline();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const requestTokenRef = React.useRef(0);

  // Initialize active tab based on user's national location, with fallback
  const defaultNational = user?.national || 'Ireland';
  const [active, setActive] = React.useState<Tab>(defaultNational);

  // Update active tab when user location changes
  React.useEffect(() => {
    if (user?.national) {
      // If current active tab is one of the old location tabs, update to new national
      const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
      if (oldTabs.includes(active)) {
        setActive(user.national);
      }
    }
  }, [user?.national, user?.regional, user?.local]);

  // Listen for location updates from profile page
  React.useEffect(() => {
    const handleLocationUpdate = (event: CustomEvent) => {
      const { national, regional, local } = event.detail;
      // Update active tab if it was one of the old location tabs
      const oldTabs = ['Finglas', 'Dublin', 'Ireland'];
      if (oldTabs.includes(active)) {
        setActive(national || 'Ireland');
      }
    };
    window.addEventListener('locationUpdated', handleLocationUpdate as EventListener);
    return () => window.removeEventListener('locationUpdated', handleLocationUpdate as EventListener);
  }, [active]);
  const [customLocation, setCustomLocation] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<Post[][]>([]);
  const [ads, setAds] = React.useState<Ad[]>([]);
  const [cursor, setCursor] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const locationBorderOverlayRef = React.useRef<HTMLDivElement>(null);
  const prevCustomLocationRef = React.useRef<string | null>(null);
  const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = React.useState<Post | null>(null);
  const [scenesOpen, setScenesOpen] = React.useState(false);
  const [selectedPostForScenes, setSelectedPostForScenes] = React.useState<Post | null>(null);
  const [initialVideoTime, setInitialVideoTime] = React.useState<number | null>(null);
  const [initialMutedState, setInitialMutedState] = React.useState<boolean | null>(null);
  const [boostModalOpen, setBoostModalOpen] = React.useState(false);
  const [selectedPostForBoost, setSelectedPostForBoost] = React.useState<Post | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [hasInbox, setHasInbox] = React.useState(false);

  // Internal state for Following feed (separate from tabs)
  const [showFollowingFeed, setShowFollowingFeed] = React.useState(false);

  // Listen for setFollowingTab event from TopBar
  React.useEffect(() => {
    const handleSetFollowingTab = () => {
      setShowFollowingFeed(true);
      setCustomLocation(null);
      // Don't change active tab, just show following feed
    };
    window.addEventListener('setFollowingTab', handleSetFollowingTab);
    return () => window.removeEventListener('setFollowingTab', handleSetFollowingTab);
  }, []);

  // Reset showFollowingFeed when clicking any tab (except Discover and Following)
  React.useEffect(() => {
    // When active tab changes to Following, set showFollowingFeed to true
    if (active === 'Following') {
      setShowFollowingFeed(true);
    } else {
      // Reset following feed for all other tabs
      setShowFollowingFeed(false);
    }
  }, [active]);

  // Listen for resetFeed event from Home button
  React.useEffect(() => {
    const handleResetFeed = () => {
      console.log('resetFeed event received, clearing customLocation and resetting feed');
      setShowFollowingFeed(false);
      setActive(user?.national || 'Ireland');
      setCustomLocation(null);
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);
      // Clear any pending location from sessionStorage
      sessionStorage.removeItem('pendingLocation');
    };
    window.addEventListener('resetFeed', handleResetFeed);
    return () => window.removeEventListener('resetFeed', handleResetFeed);
  }, [user?.national]);

  // Listen for unread messages count
  React.useEffect(() => {
    if (!user?.handle) return;

    const updateUnreadCount = async () => {
      try {
        const count = await getUnreadTotal(user.handle!);
        setUnreadCount(count);
        setHasInbox(count > 0);
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
        setHasInbox(unread > 0);
        setUnreadCount(unread);
      }
    };

    window.addEventListener('inboxUnreadChanged', handleUnreadChanged as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('inboxUnreadChanged', handleUnreadChanged as EventListener);
    };
  }, [user?.handle]);

  // Determine current filter - showFollowingFeed overrides everything, then custom location, then active tab
  const currentFilter = showFollowingFeed ? 'discover' : (customLocation || active);

  // Read location from URL query (?location=...) when arriving from Discover
  React.useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const q = params.get('location');
    console.log('URL params changed, location param:', q, 'current customLocation:', customLocation, 'pathname:', routerLocation.pathname);

    // Only process location changes when we're on the feed page
    if (routerLocation.pathname !== '/feed') {
      // If we're not on feed page and have a custom location, clear it
      if (customLocation) {
        console.log('Not on feed page, clearing customLocation...');
        setCustomLocation(null);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
      }
      return;
    }

    if (q) {
      console.log('URL provided location:', q, 'setting customLocation...');
      console.log('About to call setCustomLocation, will update from:', customLocation, 'to:', q);
      setCustomLocation(q);
      console.log('setCustomLocation called, customLocation should now be:', q);
      // Also reset pages immediately when changing location
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);
    } else if (customLocation) {
      // URL param was cleared AND we're on feed page, clear customLocation too
      console.log('URL param cleared on feed page, clearing customLocation...');
      setCustomLocation(null);
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);
    }
  }, [routerLocation.search, routerLocation.pathname]); // Don't include customLocation to avoid infinite loops

  // Load from cache on mount/tab change
  React.useEffect(() => {
    // Reset pages when changing tabs
    setPages([]);
    setCursor(0);
    setEnd(false);
    console.log('Location changed to:', currentFilter, 'customLocation:', customLocation, 'active:', active, 'computed currentFilter:', currentFilter);
    // Invalidate prior in-flight requests
    requestTokenRef.current++;

    // Don't load cached data for Discover tab - always fetch fresh
    if (currentFilter.toLowerCase() !== 'discover') {
      // Temporarily disable feed cache loading to avoid duplicates
      // loadFeed(userId, currentFilter).then(p => p.length && setPages(p));
    }
  }, [userId, currentFilter]);

  // Sync with TopBar dropdown and Discover page
  React.useEffect(() => {
    const handleLocationChange = (event: CustomEvent) => {
      const location = event.detail.location;
      console.log('Feed received location change:', location);
      setCustomLocation(location);
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);

      // If we're not on the feed page yet, navigate to it
      if (window.location.pathname !== '/feed') {
        console.log('Navigating to feed page...');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };

    window.addEventListener('locationChange', handleLocationChange as EventListener);

    // Check for pending location from Discover page
    const pendingLocation = sessionStorage.getItem('pendingLocation');
    console.log('Checking for pending location, found:', pendingLocation);
    if (pendingLocation) {
      console.log('Feed found pending location:', pendingLocation, 'setting customLocation...');
      sessionStorage.removeItem('pendingLocation');
      // Use a small delay to ensure the component is mounted before setting state
      setTimeout(() => {
        console.log('Actually setting customLocation to:', pendingLocation);
        setCustomLocation(pendingLocation);
        setPages([]);
        setCursor(0);
        setEnd(false);
        setError(null);
      }, 100);
    }

    return () => window.removeEventListener('locationChange', handleLocationChange as EventListener);
  }, []);

  // Drain mutations when back online
  React.useEffect(() => {
    if (!online) return;
    drain(async (m) => {
      if (m.type === 'like' && m.postId) await toggleLike(m.userId, m.postId);
      if (m.type === 'follow' && m.postId) await toggleFollowForPost(m.userId, m.postId);
      if (m.type === 'comment' && m.postId) await addComment(m.postId, m.userId, m.text!);
      if (m.type === 'view' && m.postId) await incrementViews(m.userId, m.postId);
      if (m.type === 'share' && m.postId) await incrementShares(m.userId, m.postId);
      if (m.type === 'reclip' && m.postId) await reclipPost(m.userId, m.postId, m.userHandle!);
    });
  }, [online]);

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentsModalOpen(true);
  };

  const handleCloseComments = () => {
    setCommentsModalOpen(false);
    setSelectedPostId(null);
  };

  async function loadMore() {
    if (loading || end || cursor === null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      requestTokenRef.current++;
      const filterForRequest = currentFilter;
      const page = await fetchPostsPage(filterForRequest, cursor, 5, userId, user?.local || '', user?.regional || '', user?.national || '', user?.handle || '');
      // Drop stale results if currentFilter changed since we started (i.e., user changed location)
      if (filterForRequest !== currentFilter) {
        console.warn('Dropping stale page for filter', filterForRequest, 'current filter is now:', currentFilter);
        return;
      }
      setPages(prev => {
        // If this is the first page (cursor === 0), replace; otherwise append for pagination
        const next = cursor === 0 ? [page.items] : [...prev, page.items];
        console.log('Setting pages:', {
          prevLength: prev.length,
          newLength: next.length,
          cursor,
          isFirstPage: cursor === 0,
          filterForRequest,
          currentFilter,
          pageItemsCount: page.items.length
        });
        // Temporarily disable feed cache to avoid duplicates
        // saveFeed(userId, currentFilter, next);
        return next;
      });
      setCursor(page.nextCursor);
      setEnd(page.nextCursor === null);
    } catch (e: any) {
      console.error('loadMore error:', e);
      setError(e?.message ?? 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }

  // Track most recent post ID for polling
  const latestPostIdRef = React.useRef<string | null>(null);

  // Listen for new posts and refresh feed
  React.useEffect(() => {
    console.log('Setting up postCreated event listener');
    const handlePostCreated = () => {
      console.log('PostCreated event received - refreshing feed');
      console.log('Current filter:', currentFilter);
      console.log('User data:', { userId, userLocal: user?.local, userRegional: user?.regional, userNational: user?.national });

      // Reset and reload feed to show new post
      setPages([]);
      setCursor(0);
      setEnd(false);
      setLoading(false);
      setError(null);
      latestPostIdRef.current = null; // Reset tracking

      // Load fresh data
      console.log('About to call loadMore from handlePostCreated');
      loadMore();
    };

    window.addEventListener('postCreated', handlePostCreated);
    console.log('postCreated event listener added');
    return () => {
      console.log('Removing postCreated event listener');
      window.removeEventListener('postCreated', handlePostCreated);
    };
  }, [currentFilter, userId, user]);

  // Poll for new posts every 10 seconds
  React.useEffect(() => {
    // Only poll if we have posts loaded and are on the feed page
    if (pages.length === 0 || loading) return;
    if (window.location.pathname !== '/feed') return;

    // Update latest post ID from current posts
    const allPosts = pages.flat();
    if (allPosts.length > 0) {
      // First post is the newest (posts are sorted newest first)
      const firstPostId = allPosts[0].id;
      if (latestPostIdRef.current === null || firstPostId !== latestPostIdRef.current) {
        latestPostIdRef.current = firstPostId;
      }
    }

    const pollInterval = setInterval(async () => {
      // Skip if already loading or not on feed page
      if (loading || end || window.location.pathname !== '/feed') return;

      try {
        // Fetch first page to check for new posts
        const page = await fetchPostsPage(currentFilter, 0, 5, userId, user?.local || '', user?.regional || '', user?.national || '', user?.handle || '');

        if (page.items.length > 0) {
          const newestPostId = page.items[0].id;

          // If we have a different first post ID, there are new posts
          if (latestPostIdRef.current === null || newestPostId !== latestPostIdRef.current) {
            console.log('New posts detected! Refreshing feed...', {
              newestPostId,
              currentLatest: latestPostIdRef.current
            });
            latestPostIdRef.current = newestPostId;

            // Reset and reload feed
            setPages([]);
            setCursor(0);
            setEnd(false);
            setLoading(false);
            setError(null);

            // Load fresh data using the same pattern as loadMore
            const filterForRequest = currentFilter;
            const pageFresh = await fetchPostsPage(filterForRequest, 0, 5, userId, user?.local || '', user?.regional || '', user?.national || '', user?.handle || '');
            setPages([pageFresh.items]);
            setCursor(pageFresh.nextCursor);
            setEnd(pageFresh.nextCursor === null);

            // Scroll to top smoothly to show new posts
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      } catch (e) {
        console.error('Error polling for new posts:', e);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [pages.length, loading, end, currentFilter, userId, user?.local, user?.regional, user?.national]);

  // Initial load
  React.useEffect(() => {
    console.log('Initial load effect triggered:', { cursor, pagesLength: pages.length, currentFilter });
    // If arriving with ?location=... from Discover, wait until customLocation is set
    const params = new URLSearchParams(routerLocation.search);
    const pendingUrlLocation = params.get('location');
    if (pendingUrlLocation && !customLocation) {
      console.log('Deferring initial load until customLocation is applied for URL location:', pendingUrlLocation);
      return;
    }

    if (cursor !== null && pages.length === 0) {
      console.log('Calling loadMore from initial load effect');
      loadMore();
    }
  }, [cursor, currentFilter, routerLocation.search, customLocation]);

  // Easing function for smooth animation (ease-out cubic)
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Animate border reveal when customLocation changes
  React.useEffect(() => {
    const currentLocation = customLocation;
    const prevLocation = prevCustomLocationRef.current;
    
    // Only animate if location actually changed and is not null
    if (currentLocation !== prevLocation && currentLocation) {
      const overlay = locationBorderOverlayRef.current;
      if (overlay) {
        // Reset overlay to start position
        overlay.style.maskImage = 'conic-gradient(from 0deg, black 360deg)';
        overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, black 360deg)';
        
        // Start animation
        const duration = 1800; // 1.8 seconds for smoother feel
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const rawProgress = Math.min(elapsed / duration, 1);
          // Apply easing for smoother animation
          const easedProgress = easeOutCubic(rawProgress);
          const angle = easedProgress * 360;
          
          // Create mask that reveals progressively going around
          const mask = `conic-gradient(from 0deg, transparent 0deg, transparent ${angle}deg, black ${angle}deg, black 360deg)`;
          overlay.style.maskImage = mask;
          overlay.style.webkitMaskImage = mask;
          
          if (rawProgress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Animation complete - make overlay fully transparent so border is fully visible
            overlay.style.maskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
            overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
          }
        };
        
        requestAnimationFrame(animate);
      }
    }
    
    prevCustomLocationRef.current = currentLocation;
  }, [customLocation]);

  // Listen for post updates from EditPostModal
  React.useEffect(() => {
    const listeners: Array<{ postId: string; handler: EventListener }> = [];

    // Create a listener for each post in the feed
    const setupListeners = () => {
      // Clean up old listeners
      listeners.forEach(({ postId, handler }) => {
        window.removeEventListener(`updatePostInFeed-${postId}`, handler);
      });
      listeners.length = 0;

      // Add listeners for all posts in the feed
      pages.flat().forEach(post => {
        const handler = ((e: CustomEvent) => {
          const { text, location } = e.detail;
          updateOne(post.id, p => ({
            ...p,
            text: text || p.text,
            text_content: text || p.text_content,
            locationLabel: location || p.locationLabel
          }));
        }) as EventListener;

        window.addEventListener(`updatePostInFeed-${post.id}`, handler);
        listeners.push({ postId: post.id, handler });
      });
    };

    setupListeners();

    return () => {
      listeners.forEach(({ postId, handler }) => {
        window.removeEventListener(`updatePostInFeed-${postId}`, handler);
      });
    };
  }, [pages]);

  function updateOne(id: string, updater: (p: Post) => Post) {
    console.log('updateOne called for post:', id);
    setPages(cur => {
      const updated = cur.map(group => group.map(p => {
        if (p.id === id) {
          const next = updater({ ...p });
          // Preserve boost label so it doesn't disappear after like/follow/view (API doesn't return these)
          const preserved = {
            ...next,
            isBoosted: next.isBoosted ?? p.isBoosted,
            boostFeedType: next.boostFeedType ?? p.boostFeedType
          };
          console.log('Updating post:', id, 'from likes:', p.stats.likes, 'to:', preserved.stats.likes);
          return preserved;
        }
        return p;
      }));

      // Check for duplicates after update
      const allPosts = updated.flat();
      const duplicates = allPosts.filter((p, i) => allPosts.findIndex(other => other.id === p.id) !== i);
      if (duplicates.length > 0) {
        console.error('DUPLICATES AFTER UPDATE:', duplicates.map(p => p.id));
      }

      return updated;
    });
  }

  // When returning from payment after boosting, mark the post so the Sponsored label shows (incl. text-only posts)
  React.useEffect(() => {
    const state = routerLocation.state as { boostSuccess?: boolean; postId?: string; feedType?: 'local' | 'regional' | 'national' } | null;
    if (routerLocation.pathname !== '/feed' || !state?.boostSuccess || !state.postId || !state.feedType) return;
    updateOne(state.postId, p => ({ ...p, isBoosted: true, boostFeedType: state.feedType! }));
    navigate('/feed', { replace: true, state: {} });
  }, [routerLocation.pathname, routerLocation.state]);

  // Fetch ads when filter changes
  React.useEffect(() => {
    async function loadAds() {
      try {
        const userLocation = user?.local || user?.regional || user?.national || '';
        const userTags: string[] = []; // Could be extracted from user interests
        const activeAds = await getActiveAds(userLocation, userTags);
        setAds(activeAds);
      } catch (err) {
        console.error('Error loading ads:', err);
      }
    }

    if (user) {
      loadAds();
    }
  }, [currentFilter, user]);

  // Merge posts and ads, sort by epoch time (createdAt)
  const flat = React.useMemo(() => {
    const flattened = pages.flat();

    // Always remove duplicates first, before any other processing
    const uniquePosts = flattened.filter((p, i) => flattened.findIndex(other => other.id === p.id) === i);

    const duplicateIDs = flattened.filter((p, i) => flattened.findIndex(other => other.id === p.id) !== i).map(p => p.id);

    console.log('Flattening pages:', {
      pagesCount: pages.length,
      totalPosts: flattened.length,
      uniquePosts: uniquePosts.length,
      postIDs: uniquePosts.map(p => p.id),
      duplicateIDs: duplicateIDs,
      textPosts: uniquePosts.filter(p => p.text && !p.mediaUrl).length
    });

    if (duplicateIDs.length > 0) {
      console.error('DUPLICATE POSTS DETECTED AND REMOVED:', duplicateIDs);
      console.log('Text posts after deduplication:', uniquePosts.filter(p => p.text && !p.mediaUrl).map(p => ({ id: p.id, text: p.text?.substring(0, 50) + '...' })));
    }

    // Merge posts and ads, sort by epoch time (createdAt) - newest first
    const feedItems: Array<{ type: 'post' | 'ad'; item: Post | Ad; createdAt: number }> = [
      ...uniquePosts.map(p => ({ type: 'post' as const, item: p, createdAt: p.createdAt || 0 })),
      ...ads.map(a => ({ type: 'ad' as const, item: a, createdAt: a.createdAt || 0 }))
    ];

    // Sort by epoch time (createdAt) - descending (newest first)
    feedItems.sort((a, b) => b.createdAt - a.createdAt);

    return feedItems;
  }, [pages, ads]);

  // Not logged in
  if (!user) {
    return (
      <div className="p-6">
        <a href="/login" className="text-brand-600 underline">Sign in</a> to view your feed.
      </div>
    );
  }

  return (
    <div key={`${currentFilter}-${customLocation || 'default'}`} id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="pb-2">
      <div className="h-4" />

      {/* Offline banner */}
      {!online && (
        <div className="mx-3 mt-2 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs">
          You're offline. Actions will sync when back online.
        </div>
      )}

      {/* Show location tabs only when not viewing a custom location */}
      {!customLocation ? (
        <PillTabs
          active={active}
          onChange={setActive}
          onClearCustom={() => setCustomLocation(null)}
          userLocal={user?.local}
          userRegional={user?.regional}
          userNational={user?.national}
          clipsCount={(() => {
            const userId = user?.id ?? 'anon';
            const userState = getState(userId);
            return pages.flat().filter(p => {
              const isFollowing = userState.follows[p.userHandle] === true;
              if (!isFollowing) return false;
              // Check if this post's media was from a story
              return p.mediaUrl && wasEverAStory(p.mediaUrl);
            }).length;
          })()}
        />
      ) : (
        /* Show location header only when viewing custom location */
        <div className="px-3 py-2">
          <div className="relative inline-flex items-center">
            <button
              className="relative px-3 py-1.5 text-sm font-medium text-white rounded-lg"
              onClick={() => setCustomLocation(null)}
            >
              {/* Gradient border wrapper */}
              <div
                className="absolute inset-0 rounded-lg p-0.5 overflow-hidden"
                style={{
                  background: 'conic-gradient(from 0deg, rgb(255, 140, 0), rgb(248, 0, 50), rgb(255, 0, 160), rgb(140, 40, 255), rgb(0, 35, 255), rgb(25, 160, 255), rgb(255, 140, 0))',
                }}
              >
                {/* Overlay that covers border initially, then rotates to reveal it */}
                <div
                  ref={locationBorderOverlayRef}
                  className="absolute inset-0 bg-[#030712] rounded-lg"
                  style={{
                    maskImage: 'conic-gradient(from 0deg, black 360deg)',
                    WebkitMaskImage: 'conic-gradient(from 0deg, black 360deg)',
                  }}
                />
                <div className="w-full h-full rounded-lg bg-[#030712] relative z-10" />
              </div>
              {/* Content */}
              <span className="relative z-10 flex items-center gap-2">
                <FiMapPin className="w-4 h-4" />
                {customLocation} Feed
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="h-4" />

      {error && (
        <div className="mx-4 my-3 p-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => { setError(null); loadMore(); }}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-500"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {flat.map((feedItem, index) => {
        if (feedItem.type === 'ad') {
          const ad = feedItem.item as Ad;
          return (
            <AdCard
              key={ad.id}
              ad={ad}
              onImpression={async () => {
                try {
                  await trackAdImpression(ad.id, userId);
                } catch (err) {
                  console.error('Error tracking ad impression:', err);
                }
              }}
              onClick={async () => {
                try {
                  await trackAdClick(ad.id, userId);
                } catch (err) {
                  console.error('Error tracking ad click:', err);
                }
              }}
            />
          );
        }

        const p = feedItem.item as Post;
        // Priority loading: first 1-3 posts with media get priority
        const hasMedia = !!(p.mediaUrl || (p.mediaItems && p.mediaItems.length > 0));
        const priorityPostsCount = flat.slice(0, index + 1).filter(item => {
          if (item.type === 'ad') return false;
          const post = item.item as Post;
          return !!(post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0));
        }).length;
        const isPriority = hasMedia && priorityPostsCount <= 3;

        return (
          <FeedCard
            key={p.id}
            post={p}
            priority={isPriority}
            onLike={async () => {
              console.log('Like button clicked for post:', p.id, 'userLiked:', p.userLiked);
              if (!online) {
                updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
              }
              const nextLiked = !p.userLiked;
              const nextLikes = p.stats.likes + (nextLiked ? 1 : -1);
              try {
                const updated = await toggleLike(userId, p.id);
                updateOne(p.id, _post => ({ ...updated }));
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: updated.userLiked, likes: updated.stats.likes }
                }));
              } catch (err) {
                console.warn('Like failed, updating UI optimistically:', err);
                updateOne(p.id, post => ({
                  ...post,
                  userLiked: nextLiked,
                  stats: { ...post.stats, likes: Math.max(0, nextLikes) }
                }));
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: nextLiked, likes: Math.max(0, nextLikes) }
                }));
              }
            }}
            onFollow={async () => {
          if (!online) {
            // Offline: optimistically toggle follow both in the post and in the shared follow state
            updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));
            setFollowState(userId, p.userHandle, !p.isFollowing);
            await enqueue({ type: 'follow', postId: p.id, userId });
                if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                  setPages([]);
                  setCursor(0);
                  setEnd(false);
                  setError(null);
                  requestTokenRef.current++;
                }
                return;
              }

              // Check if profile is private before following
              const { isProfilePrivate } = await import('./api/privacy');
              const { toggleFollow } = await import('./api/client');
              const { createFollowRequest, hasPendingFollowRequest, removeFollowRequest } = await import('./api/privacy');
              const { createNotification } = await import('./api/notifications');
              const { getFollowedUsers } = await import('./api/posts');
              
              const profilePrivate = isProfilePrivate(p.userHandle);

              // For private profiles, handle follow flow only on the profile page
              // so all the "request sent" / "pending" logic is in one place.
              // From the feed card, just take the user to the profile.
              if (profilePrivate) {
                navigate(`/user/${p.userHandle}`);
                return;
              }
              
              // Check actual follow status from the followed users list
              let isActuallyFollowing = p.isFollowing;
              if (user?.id) {
                try {
                  const followedUsers = await getFollowedUsers(user.id);
                  isActuallyFollowing = followedUsers.includes(p.userHandle);
                  // If actually following, remove any stale follow requests
                  if (isActuallyFollowing && user.handle) {
                    removeFollowRequest(user.handle, p.userHandle);
                  }
                } catch (error) {
                  console.warn('Error checking followed users:', error);
                }
              }
              
              // If already following, remove any stale follow requests and just unfollow
              if (isActuallyFollowing) {
                if (user?.handle) {
                  removeFollowRequest(user.handle, p.userHandle);
                }
                const updated = await toggleFollowForPost(userId, p.id);
                updateOne(p.id, _post => ({ ...updated }));
                return;
              }
              
              // Check for pending requests only if not already following
              let hasPending = hasPendingFollowRequest(user?.handle || '', p.userHandle);
              
              // If there's a pending request but user is not actually following, check if it's stale
              // (older than 1 hour) and clear it to allow a fresh request
              if (hasPending && !isActuallyFollowing && user?.handle) {
                const { getFollowRequests } = await import('./api/privacy');
                const requests = getFollowRequests();
                const matchingRequest = requests.find(
                  req => req.fromHandle === user.handle && req.toHandle === p.userHandle && req.status === 'pending'
                );
                
                if (matchingRequest && matchingRequest.timestamp) {
                  const oneHourAgo = Date.now() - (60 * 60 * 1000);
                  // If request is older than 1 hour, it's stale - clear it
                  if (matchingRequest.timestamp < oneHourAgo) {
                    console.log('Found stale follow request (older than 1 hour), clearing it:', {
                      fromHandle: user.handle,
                      toHandle: p.userHandle,
                      age: Math.floor((Date.now() - matchingRequest.timestamp) / (1000 * 60 * 60)) + ' hours'
                    });
                    removeFollowRequest(user.handle, p.userHandle);
                    hasPending = false; // Reset the flag
                  }
                }
              }
              
              // Debug logging
              console.log('+ icon clicked - Follow check:', {
                userHandle: user?.handle,
                postUserHandle: p.userHandle,
                profilePrivate,
                hasPending,
                isFollowing: p.isFollowing,
                isActuallyFollowing
              });
              
              // If private profile and has pending request, show message
              if (profilePrivate && hasPending && user?.handle) {
                // Already has a pending request - show message
                const Swal = (await import('sweetalert2')).default;
                Swal.fire({
                  title: 'Gazetteer says',
                  customClass: {
                    title: 'gazetteer-shimmer',
                    popup: '!rounded-2xl !shadow-xl !border-0',
                    container: '!p-0',
                    confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                  },
                  html: `
                    <div style="text-align: center; padding: 8px 0;">
                      <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                      <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Already Sent</h3>
                      <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">You have already sent a follow request to ${p.userHandle}. You will be notified when they respond.</p>
                    </div>
                  `,
                  showConfirmButton: true,
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#0095f6',
                  background: '#ffffff',
                  width: '400px',
                  padding: '0',
                  buttonsStyling: false
                });
                return;
              } else if (profilePrivate && !hasPending && user?.handle) {
                // Private profile - create follow request
                console.log('Private profile detected, creating follow request:', {
                  userHandle: user.handle,
                  targetHandle: p.userHandle,
                  hasPending
                });
                
                // Double-check that there's no pending request right before creating
                const doubleCheckPending = hasPendingFollowRequest(user?.handle || '', p.userHandle);
                if (doubleCheckPending) {
                  console.warn('Found pending request on double-check, showing pending message instead of creating new request');
                  const Swal = (await import('sweetalert2')).default;
                  Swal.fire({
                    title: 'Gazetteer says',
                    customClass: {
                      title: 'gazetteer-shimmer',
                      popup: '!rounded-2xl !shadow-xl !border-0',
                      container: '!p-0',
                      confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                    },
                    html: `
                      <div style="text-align: center; padding: 8px 0;">
                        <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </div>
                        <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Already Sent</h3>
                        <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">You have already sent a follow request to ${p.userHandle}. You will be notified when they respond.</p>
                      </div>
                    `,
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0095f6',
                    background: '#ffffff',
                    width: '400px',
                    padding: '0',
                    buttonsStyling: false
                  });
                  return;
                }
                
                try {
                  const encodedHandle = encodeURIComponent(p.userHandle);
                  console.log('Calling toggleFollow API for private profile:', encodedHandle);
                  const result = await toggleFollow(encodedHandle);
                  console.log('toggleFollow API result:', result);
                  
                  if (result.status === 'pending' && user?.handle) {
                    console.log('API returned pending status, creating follow request in localStorage');
                    createFollowRequest(user.handle, p.userHandle);
                    
                    // Create notification - show Follow Request Sent popup
                    try {
                      await createNotification({
                        type: 'follow_request',
                        fromHandle: user.handle,
                        toHandle: p.userHandle,
                        message: `${user.handle} wants to follow you`
                      });
                    } catch (error) {
                      console.warn('Failed to create follow request notification:', error);
                    }
                    
                    // Show Instagram-style popup
                    const Swal = (await import('sweetalert2')).default;
                    Swal.fire({
                      title: 'Gazetteer says',
                      customClass: {
                        title: 'gazetteer-shimmer',
                        popup: '!rounded-2xl !shadow-xl !border-0',
                        container: '!p-0',
                        confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                      },
                      html: `
                        <div style="text-align: center; padding: 8px 0;">
                          <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <line x1="20" y1="8" x2="20" y2="14"></line>
                              <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                          </div>
                          <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Sent</h3>
                          <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Your follow request has been sent. You will be notified when they accept.</p>
                        </div>
                      `,
                      showConfirmButton: true,
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#0095f6',
                      background: '#ffffff',
                      width: '400px',
                      padding: '0',
                      buttonsStyling: false
                    });
                    
                    // Don't update isFollowing to true - keep it false for pending request
                    updateOne(p.id, post => ({ ...post, isFollowing: false }));
                  } else if (result.status === 'accepted' || result.following === true) {
                    // Public profile - follow immediately (backend is authoritative)
                    const newFollowingState = true;
                    setFollowState(userId, p.userHandle, newFollowingState);
                    updateOne(p.id, post => ({ ...post, isFollowing: newFollowingState }));
                  }
                } catch (apiError: any) {
                  const isConnectionError = 
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');
                  
                  if (isConnectionError && profilePrivate && user?.handle) {
                    console.log('Connection error detected, using mock fallback for private profile');
                    // Check again if request was created between the initial check and now
                    const recheckPending = hasPendingFollowRequest(user.handle, p.userHandle);
                    if (recheckPending) {
                      console.log('Mock fallback: Found pending request on recheck, showing pending message');
                      const Swal = (await import('sweetalert2')).default;
                      Swal.fire({
                        title: 'Gazetteer says',
                        customClass: {
                          title: 'gazetteer-shimmer',
                          popup: '!rounded-2xl !shadow-xl !border-0',
                          container: '!p-0',
                          confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                        },
                        html: `
                          <div style="text-align: center; padding: 8px 0;">
                            <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                            </div>
                            <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Already Sent</h3>
                            <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">You have already sent a follow request to ${p.userHandle}. You will be notified when they respond.</p>
                          </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#0095f6',
                        background: '#ffffff',
                        width: '400px',
                        padding: '0',
                        buttonsStyling: false
                      });
                      return;
                    }
                    
                    // Mock fallback for private profile - create new request
                    console.log('Mock fallback: Creating new follow request for', p.userHandle);
                    if (user?.handle) {
                      try {
                        createFollowRequest(user.handle, p.userHandle);
                        console.log('Follow request created successfully in localStorage');
                      } catch (error) {
                        console.error('Error creating follow request:', error);
                      }
                      
                      try {
                        await createNotification({
                          type: 'follow_request',
                          fromHandle: user.handle,
                          toHandle: p.userHandle,
                          message: `${user.handle} wants to follow you`
                        });
                      } catch (error) {
                        console.warn('Failed to create follow request notification:', error);
                      }
                      
                      const Swal = (await import('sweetalert2')).default;
                      Swal.fire({
                        title: 'Gazetteer says',
                        customClass: {
                          title: 'gazetteer-shimmer',
                          popup: '!rounded-2xl !shadow-xl !border-0',
                          container: '!p-0',
                          confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                        },
                        html: `
                          <div style="text-align: center; padding: 8px 0;">
                            <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                              </svg>
                            </div>
                            <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Sent</h3>
                            <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Your follow request has been sent. You will be notified when they accept.</p>
                          </div>
                        `,
                        showConfirmButton: true,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#0095f6',
                        background: '#ffffff',
                        width: '400px',
                        padding: '0',
                        buttonsStyling: false
                      });
                      
                      updateOne(p.id, post => ({ ...post, isFollowing: false }));
                    }
                  } else {
                    // For other errors, fall back to normal follow
                    const updated = await toggleFollowForPost(userId, p.id);
                    updateOne(p.id, _post => ({ ...updated }));
                  }
                }
              } else {
                // Public profile - follow immediately
                try {
                  // First try the backend API so Laravel posts (which aren't in the mock posts array)
                  // correctly toggle follow state.
                  const result = await toggleFollow(p.userHandle);
                  const newFollowingState =
                    result?.status === 'accepted' || result?.following === true;

                  setFollowState(userId, p.userHandle, newFollowingState);
                  updateOne(p.id, post => ({ ...post, isFollowing: newFollowingState }));
                } catch (apiError: any) {
                  const isConnectionError =
                    apiError?.message === 'CONNECTION_REFUSED' ||
                    apiError?.name === 'ConnectionRefused' ||
                    apiError?.message?.includes('Failed to fetch');

                  if (isConnectionError) {
                    // Backend not available – fall back to mock follow toggling
                    const updated = await toggleFollowForPost(userId, p.id);
                    updateOne(p.id, _post => ({ ...updated }));
                  } else {
                    throw apiError;
                  }
                }
                // Do not clear/refetch here: it wipes the optimistic update and makes the green tick flash back to +.
              }
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
            onView={async () => {
              // Skip view tracking for frontend-only mock posts (mock-scenes-*) – they don't exist in the API
              if (p.id.startsWith('mock-scenes-')) return;
              if (!online) {
                await enqueue({ type: 'view', postId: p.id, userId });
                return;
              }
              try {
                const updated = await incrementViews(userId, p.id);
                // Don't overwrite feed state with dummy post when API/post not found (would break UI)
                if (updated.userHandle === 'Unknown') return;
                updateOne(p.id, _post => ({ ...updated }));
                window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
              } catch (err) {
                console.warn('incrementViews error:', err);
              }
            }}
            onReclip={async () => {
              // Prevent users from reclipping their own posts
              if (p.userHandle === user?.handle) {
                console.log('Cannot reclip your own post');
                return;
              }
              // Check if already reclipped - prevent multiple reclips
              if (p.userReclipped) {
                console.log('Post already reclipped by user, ignoring reclip request');
                return;
              }
              
              if (!online) {
                // Optimistically update userReclipped and reclip count
                updateOne(p.id, post => ({
                  ...post,
                  userReclipped: true,
                  stats: { ...post.stats, reclips: post.stats.reclips + 1 }
                }));
                await enqueue({ type: 'reclip', postId: p.id, userId, userHandle: user?.handle || 'Unknown@Unknown' });
                window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`));
                return;
              }
              const { originalPost: updatedOriginalPost, reclippedPost } = await reclipPost(userId, p.id, user?.handle || 'Unknown@Unknown');

              // Check if user already reclipped (reclippedPost will be null)
              if (!reclippedPost) {
                console.log('Post already reclipped by user, ignoring reclip request');
                // Still update the UI to reflect the current state
                updateOne(p.id, post => ({
                  ...post,
                  userReclipped: updatedOriginalPost.userReclipped,
                  stats: updatedOriginalPost.stats
                }));
                return;
              }

              // New reclip was created - update the original post
              // Note: Reclipped posts only appear in the Following feed for users who follow the reclipper
              // They should NOT be added to the current feed to avoid duplicates
              updateOne(p.id, post => ({
                ...post,
                userReclipped: updatedOriginalPost.userReclipped,
                stats: updatedOriginalPost.stats
              }));
              // Notify EngagementBar to update reclip count
              window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`));
            }}
            onOpenScenes={() => {
              // Get current video time from the videoTimesMap for seamless transition
              const currentTime = videoTimesMap.get(p.id);
              setInitialVideoTime(currentTime !== undefined ? currentTime : null);
              // Get current mute state from the videoMutedMap for seamless transition
              const currentMuted = videoMutedMap.get(p.id);
              setInitialMutedState(currentMuted !== undefined ? currentMuted : null);
              setSelectedPostForScenes(p);
              setScenesOpen(true);
              // Dispatch event to pause feed video smoothly
              window.dispatchEvent(new CustomEvent(`scenesOpening-${p.id}`));
            }}
            showBoostIcon={user?.handle === p.userHandle && !p.originalUserHandle}
            onBoost={user?.handle === p.userHandle && !p.originalUserHandle ? async () => {
              setSelectedPostForBoost(p);
              setBoostModalOpen(true);
            } : undefined}
            onDelete={user?.handle === p.userHandle && !p.originalUserHandle ? async () => {
              const result = await Swal.fire({
                title: 'Gazetteer says',
                html: `
                  <div style="text-align: center; padding: 8px 0;">
                    <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </div>
                    <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Delete post?</h3>
                    <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">This can't be undone.</p>
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                background: '#ffffff',
                width: '400px',
                padding: '0',
                customClass: {
                  popup: '!rounded-2xl !shadow-xl !border-0',
                  container: '!p-0',
                  confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#dc2626] !hover:bg-[#b91c1c] !text-white !transition-colors',
                  cancelButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#f3f4f6] !hover:bg-[#e5e7eb] !text-[#374151] !transition-colors'
                },
                buttonsStyling: false
              });
              if (!result.isConfirmed) return;
              try {
                await deletePost(userId, p.id, user?.handle);
                setPages(cur => cur.map(group => group.filter(x => x.id !== p.id)));
              } catch (err) {
                console.error('Delete post failed:', err);
                await Swal.fire({
                  title: 'Gazetteer says',
                  html: `
                    <div style="text-align: center; padding: 8px 0;">
                      <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0;">Could not delete post</h3>
                      <p style="font-size: 14px; color: #8e8e8e; margin: 0;">${err instanceof Error ? err.message : 'Please try again.'}</p>
                    </div>
                  `,
                  confirmButtonText: 'OK',
                  background: '#ffffff',
                  width: '400px',
                  customClass: { popup: '!rounded-2xl !shadow-xl !border-0', confirmButton: '!rounded-lg !px-6 !py-2 !bg-[#0095f6] !hover:bg-[#0084d4] !text-white' },
                  buttonsStyling: false
                });
              }
            } : undefined}
          />
        );
      })}

      {loading && (
        <div className="px-4 py-6 animate-pulse">
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
          <div className="w-full aspect-square bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      )}

      {end && flat.length === 0 && (
        <div className="p-8 text-center text-gray-600 dark:text-gray-300">
          {showFollowingFeed || currentFilter.toLowerCase() === 'discover' ? (
            <>
              <div className="text-lg font-semibold mb-1">Unlock Your Following News Feed</div>
              <div className="text-gray-600 text-sm">This feed only populates with the accounts you follow. Start tapping Follow to personalize your stream</div>
            </>
          ) : customLocation ? (
            <>
              <div className="text-lg font-semibold mb-1">No posts from {customLocation} yet</div>
              <div className="text-gray-600 text-sm">Try this feed soon to see when people from {customLocation} start posting</div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold mb-1">No posts yet</div>
              <div className="text-gray-600 text-sm">No posts available for this location</div>
            </>
          )}
        </div>
      )}

      {end && flat.length > 0 && (
        <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">You're all caught up.</div>
      )}

      {/* Comments Modal */}
      {selectedPostId && (
        <CommentsModal
          postId={selectedPostId}
          isOpen={commentsModalOpen}
          onClose={handleCloseComments}
        />
      )}

      {/* Share Modal */}
      {selectedPostForShare && (
        <ShareModal
          post={selectedPostForShare}
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedPostForShare(null);
          }}
        />
      )}

      {/* Boost Selection Modal */}
      {boostModalOpen && selectedPostForBoost && (
        <BoostSelectionModal
          post={selectedPostForBoost}
          isOpen={boostModalOpen}
          onClose={() => {
            setBoostModalOpen(false);
            setSelectedPostForBoost(null);
          }}
          onSelect={(feedType, price) => {
            // Navigate to payment page with full post (same as Boost page) so PaymentPage can boost
            navigate('/payment', {
              state: {
                post: selectedPostForBoost,
                feedType,
                price
              }
            });
            setBoostModalOpen(false);
            setSelectedPostForBoost(null);
          }}
        />
      )}

      {/* Scenes Modal (fullscreen) */}
      {selectedPostForScenes && (() => {
        const p = selectedPostForScenes;
        return (
          <ScenesModal
            post={p}
            isOpen={scenesOpen}
            initialVideoTime={initialVideoTime}
            initialMutedState={initialMutedState}
            onClose={(savedTime) => {
              // Save video time when closing Scenes
              if (savedTime !== null && savedTime !== undefined) {
                videoTimesMap.set(p.id, savedTime);
              }
              setScenesOpen(false);
              setSelectedPostForScenes(null);
              setInitialVideoTime(null);
              setInitialMutedState(null);
              // Dispatch event to resume video in feed
              window.dispatchEvent(new CustomEvent(`resumeVideo-${p.id}`, {
                detail: { time: savedTime }
              }));
            }}
            onLike={async () => {
              console.log('Like button clicked for post:', p.id, 'userLiked:', p.userLiked);
              if (!online) {
                const optimisticPost = { ...p, userLiked: !p.userLiked };
                updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(optimisticPost);
                }
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: optimisticPost.userLiked, likes: p.stats.likes }
                }));
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
              }
              const nextLiked = !p.userLiked;
              const nextLikes = p.stats.likes + (nextLiked ? 1 : -1);
              try {
                const updated = await toggleLike(userId, p.id);
                updateOne(p.id, _post => ({ ...updated }));
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(updated);
                }
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: updated.userLiked, likes: updated.stats.likes }
                }));
              } catch (err) {
                console.warn('Like failed, updating UI optimistically:', err);
                const optimistic = { ...p, userLiked: nextLiked, stats: { ...p.stats, likes: Math.max(0, nextLikes) } };
                updateOne(p.id, _ => optimistic);
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(optimistic);
                }
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: nextLiked, likes: Math.max(0, nextLikes) }
                }));
              }
            }}
            onFollow={async () => {
              const { isProfilePrivate, createFollowRequest, hasPendingFollowRequest } = await import('./api/privacy');
              const { toggleFollow } = await import('./api/client');
              const { createNotification } = await import('./api/notifications');

              const profilePrivate = isProfilePrivate(p.userHandle);

              // Private profile: create/request-only flow for this secondary feed as well
              if (profilePrivate && user?.handle) {
                const hasPending = hasPendingFollowRequest(user.handle, p.userHandle);
                if (hasPending) {
                  const Swal = (await import('sweetalert2')).default;
                  await Swal.fire({
                    title: 'Gazetteer says',
                    html: `
                      <div style="text-align: center; padding: 8px 0;">
                        <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </div>
                        <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Already Sent</h3>
                        <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">You have already sent a follow request to ${p.userHandle}. You will be notified when they respond.</p>
                      </div>
                    `,
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0095f6',
                    background: '#ffffff',
                    width: '400px',
                    padding: '0',
                    customClass: {
                      popup: '!rounded-2xl !shadow-xl !border-0',
                      container: '!p-0',
                      confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                    },
                    buttonsStyling: false
                  });
                  return false; // not following yet – request pending
                }

                // Create new follow request (local + optional notification)
                createFollowRequest(user.handle, p.userHandle);
                setFollowState(userId, p.userHandle, false);
                try {
                  await createNotification({
                    type: 'follow_request',
                    fromHandle: user.handle,
                    toHandle: p.userHandle,
                    message: `${user.handle} wants to follow you`
                  });
                } catch {
                  // non-fatal
                }
                try {
                  const Swal = (await import('sweetalert2')).default;
                  await Swal.fire({
                    title: 'Gazetteer says',
                    html: `
                    <div style="text-align: center; padding: 8px 0;">
                      <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="20" y1="8" x2="20" y2="14"></line>
                          <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                      </div>
                      <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Follow Request Sent</h3>
                      <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Your follow request has been sent. You will be notified when they accept.</p>
                    </div>
                  `,
                    showConfirmButton: true,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0095f6',
                    background: '#ffffff',
                    width: '400px',
                    padding: '0',
                    customClass: {
                      popup: '!rounded-2xl !shadow-xl !border-0',
                      container: '!p-0',
                      confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#0095f6] !hover:bg-[#0084d4] !transition-colors'
                    },
                    buttonsStyling: false
                  });
                } catch {
                  // ensure we still return false if Swal fails
                }
                return false; // not following yet – request sent, awaiting acceptance
              }

              // PUBLIC PROFILES
              if (!online) {
                // Pure offline: toggle in shared follow state and UI
                updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));
                setFollowState(userId, p.userHandle, !p.isFollowing);
                await enqueue({ type: 'follow', postId: p.id, userId });
                return;
              }

              try {
                // Use backend as source of truth
                const result = await toggleFollow(p.userHandle);
                const newFollowingState =
                  result?.status === 'accepted' || result?.following === true;

                setFollowState(userId, p.userHandle, newFollowingState);
                updateOne(p.id, post => ({ ...post, isFollowing: newFollowingState }));
              } catch (apiError: any) {
                const isConnectionError =
                  apiError?.message === 'CONNECTION_REFUSED' ||
                  apiError?.name === 'ConnectionRefused' ||
                  apiError?.message?.includes('Failed to fetch');

                if (isConnectionError) {
                  // Backend not available – fall back to mock follow toggling
                  const updated = await toggleFollowForPost(userId, p.id);
                  updateOne(p.id, _post => ({ ...updated }));
                } else {
                  throw apiError;
                }
              }

              if (showFollowingFeed || currentFilter.toLowerCase() === 'discover') {
                setPages([]);
                setCursor(0);
                setEnd(false);
                setError(null);
                requestTokenRef.current++;
              }
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
            onBoost={user?.handle === p.userHandle && !p.originalUserHandle ? () => { setSelectedPostForBoost(p); setBoostModalOpen(true); } : undefined}
            onReclip={async () => {
              // Prevent users from reclipping their own posts
              if (p.userHandle === user?.handle) {
                console.log('Cannot reclip your own post');
                return;
              }
              // Check if already reclipped - prevent multiple reclips
              if (p.userReclipped) {
                console.log('Post already reclipped by user, ignoring reclip request');
                return;
              }
              
              // Note: Confirmation modal is already shown in EngagementBar's reclipClick function
              // No need to show it again here
              
              const newReclipsCount = p.stats.reclips + 1;
              if (!online) {
                // Optimistically update userReclipped and reclip count
                const optimisticPost = { ...p, userReclipped: true, stats: { ...p.stats, reclips: newReclipsCount } };
                updateOne(p.id, post => ({
                  ...post,
                  userReclipped: true,
                  stats: { ...post.stats, reclips: newReclipsCount }
                }));
                // Update selectedPostForScenes if this post is currently open in Scenes
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(optimisticPost);
                }
                await enqueue({ type: 'reclip', postId: p.id, userId, userHandle: user?.handle || 'Unknown@Unknown' });
                window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`, {
                  detail: { reclips: newReclipsCount }
                }));
                return;
              }
              const { originalPost: updatedOriginalPost, reclippedPost } = await reclipPost(userId, p.id, user?.handle || 'Unknown@Unknown');

              // Check if user already reclipped (reclippedPost will be null)
              if (!reclippedPost) {
                console.log('Post already reclipped by user, ignoring reclip request');
                // Still update the UI to reflect the current state
                updateOne(p.id, post => ({
                  ...post,
                  userReclipped: updatedOriginalPost.userReclipped,
                  stats: updatedOriginalPost.stats
                }));
                // Update selectedPostForScenes if this post is currently open in Scenes
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(updatedOriginalPost);
                }
                return;
              }

              // New reclip was created - update the original post
              // Note: Reclipped posts only appear in the Following feed for users who follow the reclipper
              // They should NOT be added to the current feed to avoid duplicates
              updateOne(p.id, post => ({
                ...post,
                userReclipped: updatedOriginalPost.userReclipped,
                stats: updatedOriginalPost.stats
              }));
              // Update selectedPostForScenes if this post is currently open in Scenes
              if (selectedPostForScenes?.id === p.id) {
                setSelectedPostForScenes(updatedOriginalPost);
              }
              // Notify UI to update reclip count with the new value
              window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`, {
                detail: { reclips: updatedOriginalPost.stats.reclips }
              }));
            }}
          />
        );
      })()}
    </div>
  );
}

function BoostPageWrapper() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const online = useOnline();
  const navigate = useNavigate();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const locationBorderOverlayRef = React.useRef<HTMLDivElement>(null);
  const prevCustomLocationRef = React.useRef<string | null>(null);
  const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = React.useState<Post | null>(null);
  const [scenesOpen, setScenesOpen] = React.useState(false);
  const [selectedPostForScenes, setSelectedPostForScenes] = React.useState<Post | null>(null);
  const [boostModalOpen, setBoostModalOpen] = React.useState(false);
  const [selectedPostForBoost, setSelectedPostForBoost] = React.useState<Post | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [hasInbox, setHasInbox] = React.useState(false);

  // Load user's posts – only posts the user created (exclude reclipped posts)
  React.useEffect(() => {
    async function loadUserPosts() {
      if (!user?.handle) return;

      setLoading(true);
      setError(null);
      try {
        const userPosts = await fetchPostsByUser(user.handle, 50);
        // Boost page: only show posts the user created, not reclips (reclips have originalUserHandle set)
        const createdOnly = userPosts.filter(p => !p.originalUserHandle);
        const decorated = createdOnly.map(p => decorateForUser(userId, p));
        setPosts(decorated);
      } catch (err) {
        console.error('Error loading user posts:', err);
        setError('Failed to load your posts');
      } finally {
        setLoading(false);
      }
    }

    loadUserPosts();
  }, [user?.handle, userId]);

  // Refresh boost status when returning from payment or creating new post
  const location = useLocation();
  React.useEffect(() => {
    const handleBoostSuccess = () => {
      // Reload posts to update boost status (only posts the user created, not reclips)
      if (user?.handle) {
        fetchPostsByUser(user.handle, 50)
          .then(userPosts => {
            const createdOnly = userPosts.filter(p => !p.originalUserHandle);
            const decorated = createdOnly.map(p => decorateForUser(userId, p));
            setPosts(decorated);
          })
          .catch(console.error);
      }
    };

    // Check if we're returning from a successful boost
    const locationState = location.state as any;
    if (locationState?.boostSuccess) {
      handleBoostSuccess();
      // Clear the state to prevent re-triggering
      window.history.replaceState({ ...locationState, boostSuccess: false }, '');
    }

    // Check if we're coming from create page with a new post to boost
    if (locationState?.newPost && locationState?.showBoostModal) {
      // Set the new post for boost modal
      setSelectedPostForBoost(locationState.newPost);
      setBoostModalOpen(true);
      // Clear the state to prevent re-triggering
      window.history.replaceState({ ...locationState, showBoostModal: false }, '');
    }
  }, [location.state, user?.handle, userId]);

  const handleOpenComments = (postId: string) => {
    setSelectedPostId(postId);
    setCommentsModalOpen(true);
  };

  const handleCloseComments = () => {
    setCommentsModalOpen(false);
    setSelectedPostId(null);
  };

  function updateOne(id: string, updater: (p: Post) => Post) {
    setPosts(cur => cur.map(p => {
      if (p.id !== id) return p;
      const next = updater({ ...p });
      return { ...next, isBoosted: next.isBoosted ?? p.isBoosted, boostFeedType: next.boostFeedType ?? p.boostFeedType };
    }));
  }

  // Not logged in
  if (!user) {
    return (
      <div className="p-6">
        <a href="/login" className="text-brand-600 underline">Sign in</a> to view your posts.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="h-4" />

      {/* Header */}
      <div className="px-3 py-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Posts</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Boost your posts to reach more people</p>
      </div>

      <div className="h-4" />

      {posts.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">You haven't created any posts yet.</p>
        </div>
      ) : (
        posts.map(p => (
          <FeedCard
            key={p.id}
            post={p}
            showBoostIcon={true}
            onBoost={async () => {
              setSelectedPostForBoost(p);
              setBoostModalOpen(true);
            }}
            onLike={async () => {
              if (!online) {
                updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
              }
              const nextLiked = !p.userLiked;
              const nextLikes = p.stats.likes + (nextLiked ? 1 : -1);
              try {
                const updated = await toggleLike(userId, p.id);
                updateOne(p.id, _post => ({ ...updated }));
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: updated.userLiked, likes: updated.stats.likes }
                }));
              } catch (err) {
                console.warn('Like failed, updating UI optimistically:', err);
                updateOne(p.id, post => ({
                  ...post,
                  userLiked: nextLiked,
                  stats: { ...post.stats, likes: Math.max(0, nextLikes) }
                }));
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: nextLiked, likes: Math.max(0, nextLikes) }
                }));
              }
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
            onView={async () => {
              if (p.id.startsWith('mock-scenes-')) return;
              if (!online) {
                await enqueue({ type: 'view', postId: p.id, userId });
                return;
              }
              try {
                const updated = await incrementViews(userId, p.id);
                if (updated.userHandle === 'Unknown') return;
                updateOne(p.id, _post => ({ ...updated }));
                window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
              } catch (err) {
                console.warn('incrementViews error:', err);
              }
            }}
            onReclip={async () => {
              // Users can't reclip their own posts
              console.log('Cannot reclip your own post');
            }}
            onOpenScenes={() => {
              setSelectedPostForScenes(p);
              setScenesOpen(true);
            }}
            onDelete={async () => {
              const result = await Swal.fire({
                  title: 'Gazetteer says',
                  html: `
                  <div style="text-align: center; padding: 8px 0;">
                    <div style="width: 60px; height: 60px; margin: 0 auto 20px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </div>
                    <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Delete post?</h3>
                    <p style="font-size: 14px; color: #8e8e8e; margin: 0; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">This can't be undone.</p>
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                background: '#ffffff',
                width: '400px',
                padding: '0',
                customClass: {
                  popup: '!rounded-2xl !shadow-xl !border-0',
                  container: '!p-0',
                  confirmButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#dc2626] !hover:bg-[#b91c1c] !text-white !transition-colors',
                  cancelButton: '!rounded-lg !px-6 !py-2 !text-sm !font-semibold !mt-4 !mb-6 !bg-[#f3f4f6] !hover:bg-[#e5e7eb] !text-[#374151] !transition-colors'
                },
                buttonsStyling: false
              });
              if (!result.isConfirmed) return;
              try {
                await deletePost(userId, p.id, user?.handle);
                setPosts(cur => cur.filter(x => x.id !== p.id));
              } catch (err) {
                console.error('Delete post failed:', err);
                await Swal.fire({
                  title: 'Gazetteer says',
                  html: `
                    <div style="text-align: center; padding: 8px 0;">
                      <h3 style="font-size: 20px; font-weight: 600; color: #262626; margin: 0 0 8px 0;">Could not delete post</h3>
                      <p style="font-size: 14px; color: #8e8e8e; margin: 0;">${err instanceof Error ? err.message : 'Please try again.'}</p>
                    </div>
                  `,
                  confirmButtonText: 'OK',
                  background: '#ffffff',
                  width: '400px',
                  customClass: { popup: '!rounded-2xl !shadow-xl !border-0', confirmButton: '!rounded-lg !px-6 !py-2 !bg-[#0095f6] !hover:bg-[#0084d4] !text-white' },
                  buttonsStyling: false
                });
              }
            }}
          />
        ))
      )}

      {/* Modals */}
      {commentsModalOpen && selectedPostId && (
        <CommentsModal
          postId={selectedPostId}
          isOpen={commentsModalOpen}
          onClose={handleCloseComments}
        />
      )}

      {shareModalOpen && selectedPostForShare && (
        <ShareModal
          post={selectedPostForShare}
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedPostForShare(null);
          }}
        />
      )}

      {scenesOpen && selectedPostForScenes && (
        <ScenesModal
          post={selectedPostForScenes}
          isOpen={scenesOpen}
          onClose={() => {
            setScenesOpen(false);
            setSelectedPostForScenes(null);
          }}
          onLike={async () => {
            if (!online) {
              updateOne(selectedPostForScenes.id, post => ({ ...post, userLiked: !post.userLiked }));
              await enqueue({ type: 'like', postId: selectedPostForScenes.id, userId });
              return;
            }
            const nextLiked = !selectedPostForScenes.userLiked;
            const nextLikes = selectedPostForScenes.stats.likes + (nextLiked ? 1 : -1);
            try {
              const updated = await toggleLike(userId, selectedPostForScenes.id);
              updateOne(selectedPostForScenes.id, _post => ({ ...updated }));
              setSelectedPostForScenes(updated);
              window.dispatchEvent(new CustomEvent(`likeToggled-${selectedPostForScenes.id}`, {
                detail: { liked: updated.userLiked, likes: updated.stats.likes }
              }));
            } catch (err) {
              console.warn('Like failed, updating UI optimistically:', err);
              const optimistic = { ...selectedPostForScenes, userLiked: nextLiked, stats: { ...selectedPostForScenes.stats, likes: Math.max(0, nextLikes) } };
              updateOne(selectedPostForScenes.id, _ => optimistic);
              setSelectedPostForScenes(optimistic);
              window.dispatchEvent(new CustomEvent(`likeToggled-${selectedPostForScenes.id}`, {
                detail: { liked: nextLiked, likes: Math.max(0, nextLikes) }
              }));
            }
          }}
          onFollow={async () => {
            // User's own posts, so no follow action needed
          }}
          onShare={async () => {
            setSelectedPostForShare(selectedPostForScenes);
            setShareModalOpen(true);
          }}
          onOpenComments={() => handleOpenComments(selectedPostForScenes.id)}
          onBoost={() => { setSelectedPostForBoost(selectedPostForScenes); setBoostModalOpen(true); }}
          onReclip={async () => {
            // Users can't reclip their own posts
            console.log('Cannot reclip your own post');
          }}
        />
      )}

      {/* Boost Selection Modal */}
      {boostModalOpen && selectedPostForBoost && (
        <BoostSelectionModal
          isOpen={boostModalOpen}
          post={selectedPostForBoost}
          onClose={() => {
            setBoostModalOpen(false);
            setSelectedPostForBoost(null);
          }}
          onSelect={(feedType, price) => {
            setBoostModalOpen(false);
            // Navigate to payment page with post and boost details
            navigate('/payment', {
              state: {
                post: selectedPostForBoost,
                feedType,
                price
              }
            });
          }}
        />
      )}
    </div>
  );
}

// Expose to router
(App as any).FeedPage = FeedPageWrapper;
(App as any).BoostPage = BoostPageWrapper;

// Export for direct import
export { FeedPageWrapper, BoostPageWrapper };

