
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUser, FiPlusSquare, FiSearch, FiZap, FiHeart, FiMessageSquare, FiShare2, FiMapPin, FiRepeat, FiMaximize, FiBookmark, FiEye, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
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
import { fetchPostsPage, fetchPostsByUser, toggleFollowForPost, toggleLike, addComment, incrementViews, incrementShares, reclipPost, decorateForUser } from './api/posts';
import { userHasUnviewedStoriesByHandle, userHasStoriesByHandle } from './api/stories';
import { enqueue, drain } from './utils/mutationQueue';
import { timeAgo } from './utils/timeAgo';
import { getActiveAds, trackAdImpression, trackAdClick } from './api/ads';
import { getActiveBoost, getBoostTimeRemaining } from './api/boost';
import BoostSelectionModal from './components/BoostSelectionModal';
import SavePostModal from './components/SavePostModal';
import { getCollectionsForPost } from './api/collections';
import type { Post, Ad, StickerOverlay } from './types';
import StickerOverlayComponent from './components/StickerOverlay';
import EffectWrapper from './components/EffectWrapper';
import type { EffectConfig } from './utils/effects';

type Tab = string; // Dynamic based on user location

function BottomNav({ onCreateClick }: { onCreateClick: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();

  const item = (path: string, label: string, icon: React.ReactNode, onClick?: () => void) => {
    const active = loc.pathname === path;
    return (
      <button
        onClick={onClick || (() => nav(path))}
        className={`flex flex-col items-center justify-center flex-1 py-2 ${active ? 'text-brand-600 font-semibold' : 'text-gray-500'} transition-colors`}
        aria-current={active ? 'page' : undefined}
        title={label}
      >
        {icon}
        <span className="text-xs mt-1">{label}</span>
      </button>
    );
  };

  const handleHomeClick = () => {
    nav('/feed');
    // Dispatch event to reset feed state
    window.dispatchEvent(new CustomEvent('resetFeed'));
  };

  return (
    <nav aria-label="Primary navigation" className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 z-40 pb-safe">
      <div className="mx-auto max-w-md flex">
        {item('/feed', 'Home', <FiHome size={22} />, handleHomeClick)}
        {item('/boost', 'Boost', <FiZap size={22} />)}
        {item('/create', 'Create', <FiPlusSquare size={22} />, onCreateClick)}
        {item('/search', 'Search', <FiSearch size={22} />)}
        {item('/profile', 'Profile', <FiUser size={22} />)}
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
      <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800" style={{ backgroundColor: '#000000' }}>
        {loc.pathname !== '/login' && <TopBar activeTab={currentFilter} onLocationChange={setCustomLocation} />}
        <Outlet context={{ activeTab, setActiveTab, customLocation, setCustomLocation }} />
        {loc.pathname !== '/discover' && loc.pathname !== '/create/filters' && loc.pathname !== '/create/instant' && loc.pathname !== '/payment' && loc.pathname !== '/clip' && loc.pathname !== '/create' && loc.pathname !== '/template-editor' && loc.pathname !== '/login' && (
          <BottomNav onCreateClick={() => setShowCreateModal(true)} />
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

function PillTabs(props: { active: Tab; onChange: (t: Tab) => void; onClearCustom?: () => void; userLocal?: string; userRegional?: string; userNational?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Use user location from props or context, with fallback to defaults
  const local = props.userLocal || user?.local || 'Finglas';
  const regional = props.userRegional || user?.regional || 'Dublin';
  const national = props.userNational || user?.national || 'Ireland';
  
  const tabs: Tab[] = [local, regional, national, 'Discover'];

  return (
    <div role="tablist" aria-label="Locations" className="grid grid-cols-4 gap-2 px-3">
      {tabs.map(t => {
        const active = props.active === t;
        const id = `tab-${t}`;
        const panelId = `panel-${t}`;

        // Special handling for Discover tab - navigate to discover page
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (t === 'Discover') {
            navigate('/discover');
          } else {
            props.onChange(t);
            props.onClearCustom?.();
          }
        };

        if (active) {
          return (
            <button
              key={t}
              id={id}
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={handleClick}
              className="rounded-lg p-[2px] animate-[shimmerGradient_3s_linear_infinite] transition-transform active:scale-[.98] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              style={{
                background: 'linear-gradient(to right, #2A1FC2, #1FC2C2, #000000, #2A1FC2, #1FC2C2, #000000)',
                backgroundSize: '400% 100%',
                outline: 'none',
                boxShadow: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span className="block rounded-md bg-gray-900 text-white text-sm py-2 font-medium">
                {t}
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
            className={`rounded-md border text-sm py-2 font-medium transition-transform active:scale-[.98] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0
              ${active
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            style={{
              outline: 'none',
              boxShadow: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {t}
          </button>
        );
      })}
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
      className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition-all duration-200 active:scale-[.98]
        ${following
          ? 'bg-gray-100 border border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
          : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
    >
      {following ? 'Following' : 'Follow +'}
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

function PostHeader({ post, onFollow, showBoostIcon, onBoost }: {
  post: Post;
  onFollow?: () => Promise<void>;
  showBoostIcon?: boolean;
  onBoost?: () => Promise<void>;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasStory, setHasStory] = React.useState(false);
  const titleId = `post-title-${post.id}`;

  // Check if this is the current user's post
  const isCurrentUser = user?.handle === post.userHandle;
  const avatarSrc = isCurrentUser ? user?.avatarUrl : undefined;

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

  // Check if this is a reclipped post
  const isReclippedPost = post.isReclipped && post.originalUserHandle;

  return (
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="relative">
          <Avatar
            src={avatarSrc}
            name={post.userHandle.split('@')[0]} // Extract name from handle like "John@Dublin"
            size="sm"
            hasStory={hasStory}
            onClick={hasStory ? handleAvatarClick : undefined}
          />
        </div>
        <div className="flex-1" onClick={(e) => e.stopPropagation()}>
          {/* Show reclip indicator if this is a reclipped post */}
          {isReclippedPost && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
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
            className="text-left hover:opacity-70 transition-opacity w-full"
          >
            <h3 id={titleId} className="font-semibold flex items-center gap-1.5 text-gray-900 dark:text-gray-100">
              <span>{isReclippedPost ? post.originalUserHandle : post.userHandle}</span>
              <Flag
                value={isCurrentUser ? (user?.countryFlag || '') : (getFlagForHandle(isReclippedPost ? post.originalUserHandle! : post.userHandle) || '')}
                size={16}
              />
            </h3>
            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1">
                <FiMapPin className="w-3 h-3" />
                {post.locationLabel || 'No location set'}
              </span>
              {post.createdAt && (
                <>
                  <span className="text-gray-400">·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>
      {showBoostIcon && isCurrentUser && onBoost ? (
        <BoostButton postId={post.id} onBoost={onBoost} />
      ) : !isCurrentUser && onFollow ? (
        <FollowButton initial={post.isFollowing} onToggle={onFollow} />
      ) : null}
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

function TextCard({ text, onDoubleLike, textStyle, stickers }: { text: string; onDoubleLike: () => Promise<void>; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string }; stickers?: StickerOverlay[] }) {
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
    <div className="mx-4 mt-4 select-none max-w-full">
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
        className="relative p-4 rounded-lg min-h-[80px] flex items-start shadow-sm hover:shadow-md transition-all duration-300 w-full overflow-hidden"
        style={{
          background: '#000000', // Black background like in the reference image
          boxShadow: 'none',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* No fullscreen/scenes for text-only posts - they're read directly in feed */}

        <div className="w-full relative z-10 overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className={`${getTextSizeClass()} leading-relaxed whitespace-pre-wrap font-normal break-words`} style={{ color: '#ffffff', wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}>
            {displayText}
          </div>
          {shouldTruncate && (
            <div className="mt-3 flex justify-start">
              <button
                onClick={handleMoreClick}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors focus:outline-none focus:ring-0"
                style={{ outline: 'none', border: 'none' }}
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}
        </div>

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
            {/* Main heart */}
            <svg className="w-20 h-20 text-red-500 drop-shadow-lg animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
            </svg>

            {/* Floating hearts */}
            <div className="absolute inset-0">
              <div className={`absolute top-2 left-2 w-4 h-4 text-red-400 transition-all duration-500 ${burst ? 'opacity-100 translate-y-[-20px]' : 'opacity-0 translate-y-0'}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                </svg>
              </div>
              <div className={`absolute top-4 right-2 w-3 h-3 text-red-300 transition-all duration-700 delay-100 ${burst ? 'opacity-100 translate-y-[-25px] translate-x-[10px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                </svg>
              </div>
              <div className={`absolute bottom-2 left-4 w-2 h-2 text-red-200 transition-all duration-600 delay-200 ${burst ? 'opacity-100 translate-y-[-15px] translate-x-[-8px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                </svg>
              </div>
              <div className={`absolute bottom-4 right-4 w-3 h-3 text-red-400 transition-all duration-500 delay-150 ${burst ? 'opacity-100 translate-y-[-20px] translate-x-[5px]' : 'opacity-0 translate-y-0 translate-x-0'}`}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
                </svg>
              </div>
            </div>

            {/* Pulse rings */}
            <div className={`absolute inset-0 border-2 border-red-400 rounded-full transition-all duration-1000 ${burst ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}`}></div>
            <div className={`absolute inset-0 border border-red-300 rounded-full transition-all duration-1200 delay-100 ${burst ? 'opacity-0 scale-200' : 'opacity-100 scale-100'}`}></div>
          </div>
        </div>
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

function Media({ url, mediaType, text, imageText, stickers, mediaItems, onDoubleLike, onOpenScenes, onCarouselIndexChange, onHeartAnimation, taggedUsers, onShowTaggedUsers, templateId: _templateId, videoCaptionsEnabled, videoCaptionText, subtitlesEnabled, subtitleText, postUserHandle, postLocationLabel, postCreatedAt }: { url?: string; mediaType?: 'image' | 'video'; text?: string; imageText?: string; stickers?: StickerOverlay[]; mediaItems?: Array<{ url: string; type: 'image' | 'video' | 'text'; duration?: number; effects?: Array<any>; text?: string; textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string } }>; onDoubleLike: () => Promise<void>; onOpenScenes?: () => void; onCarouselIndexChange?: (index: number) => void; onHeartAnimation?: (tapX: number, tapY: number) => void; taggedUsers?: string[]; onShowTaggedUsers?: () => void; templateId?: string; videoCaptionsEnabled?: boolean; videoCaptionText?: string; subtitlesEnabled?: boolean; subtitleText?: string; postUserHandle?: string; postLocationLabel?: string; postCreatedAt?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [burst, setBurst] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showControls, setShowControls] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
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

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Intersection Observer for auto-play
  React.useEffect(() => {
    if (currentItem?.type === 'video' && videoRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Video is in view - play it
              if (videoRef.current) {
                // Regular videos play muted
                videoRef.current.play().catch((error) => {
                  console.error('Error playing video:', error);
                });
                setIsPlaying(true);
              }
            } else {
              // Video is out of view - pause it
              if (videoRef.current) {
                videoRef.current.pause();
                setIsPlaying(false);
                setShowControls(false); // Don't show controls when auto-paused by scrolling
              }
            }
          });
        },
        { threshold: 0.5 } // Play when 50% of video is visible
      );

      observerRef.current.observe(videoRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [currentItem?.type]);

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

  // Image load handler to detect aspect ratio
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(false);
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    setShowControls(false);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
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
        // Only open scenes if no second tap came within threshold
        if (!isProcessingDoubleTap.current && onOpenScenes) {
          // Check if the click was on an interactive element (button, link, etc.)
          // We want to open scenes unless clicking on a real button/link
          const target = e?.target as HTMLElement;
          const mediaContainer = mediaContainerRef.current;
          
          // Check if target is within the media container
          if (mediaContainer && (target === mediaContainer || mediaContainer.contains(target))) {
            // Check if clicking on a real interactive element (button or link)
            // Exclude the media container itself (which has role="button" for accessibility)
            const clickedButton = target.closest('button');
            const clickedLink = target.closest('a');
            const isRealButton = clickedButton && clickedButton !== mediaContainer;
            const isRealLink = clickedLink && clickedLink !== mediaContainer;
            
            // Only open scenes if NOT clicking on a real button or link
            if (!isRealButton && !isRealLink) {
              onOpenScenes();
            }
          }
        }
        singleTapTimer.current = null;
      }, DOUBLE_TAP_THRESHOLD);
    }

    // Always update lastTap for next potential double-tap
    lastTap.current = now;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.preventDefault(); // Prevent default touch behavior
    touchHandled.current = true;
    handleTap(e);
    // Prevent click event from firing after touch
    setTimeout(() => {
      touchHandled.current = false;
    }, 400);
  }

  function handleClick(e: React.MouseEvent) {
    // Prevent click if touch was already handled
    if (touchHandled.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleTap(e);
  }

  // Cleanup timers and reset state on unmount or media change
  React.useEffect(() => {
    return () => {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      // Reset double tap processing state
      isProcessingDoubleTap.current = false;
      // Clear tap position
      setTapPosition(null);
      setBurst(false);
    };
  }, [currentIndex]); // Reset when switching media items

  // Reset video state when switching items
  React.useEffect(() => {
    // Reset aspect ratio when switching items
    setAspectRatio(null);
    if (currentItem?.type === 'video' && videoRef.current) {
      setIsLoading(true);
      setIsPlaying(false);
      setShowControls(false);
      setProgress(0);
      videoRef.current.load();
    } else if (currentItem?.type === 'image') {
      setIsLoading(true);
      setIsPlaying(false);
      setShowControls(false);
      setProgress(0);
    }
  }, [currentIndex, currentItem?.type]);

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

  // Match create post page exactly - fixed aspect ratio container
  const containerStyle: React.CSSProperties = {
    aspectRatio: '9/16',
    maxHeight: '55vh',
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  };

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
        onTouchEnd={handleTouchEnd}
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
                          {postLocationLabel && (
                            <>
                              <span className="flex items-center gap-1">
                                <FiMapPin className="w-3 h-3" />
                                {postLocationLabel}
                              </span>
                              {postCreatedAt && <span className="text-gray-400">·</span>}
                            </>
                          )}
                          {postCreatedAt && (
                            <span>{timeAgo(postCreatedAt)}</span>
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
              className="w-full h-full object-cover pointer-events-none"
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
            <img
              ref={imageRef}
              src={currentItem.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              draggable={false}
              onLoad={handleImageLoad}
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
              {mediaElement}

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

              {/* Mute/Unmute Button - Bottom of video */}
              {!isLoading && !hasError && currentItem.type === 'video' && (
                <div className="absolute bottom-4 right-4 z-40">
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 bg-black bg-opacity-70 rounded-full flex items-center justify-center hover:bg-opacity-90 transition-all duration-200 shadow-lg"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  >
                    {isMuted ? (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              {/* Gradient progress bar */}
              {!isLoading && !hasError && currentItem.type === 'video' && (
                <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-black/30">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                      background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                      boxShadow: '0 0 12px rgba(139,92,246,0.45)'
                    }}
                  />
                </div>
              )}

              {/* Video Captions - Display when enabled */}
              {!isLoading && !hasError && currentItem.type === 'video' && videoCaptionsEnabled && videoCaptionText && (
                <div className="absolute bottom-16 left-0 right-0 px-4 z-30 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-sm rounded-lg px-4 py-3 max-w-[90%] mx-auto">
                    <p className="text-white text-base font-medium text-center break-words leading-relaxed">
                      {videoCaptionText}
                    </p>
                  </div>
                </div>
              )}

              {/* Video Subtitles - Display when enabled */}
              {!isLoading && !hasError && currentItem.type === 'video' && subtitlesEnabled && subtitleText && (
                <div className="absolute bottom-24 left-0 right-0 px-4 z-30 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-sm rounded-lg px-4 py-3 max-w-[90%] mx-auto">
                    <p className="text-white text-base font-medium text-center break-words leading-relaxed">
                      {subtitleText}
                    </p>
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
              className="w-10 h-10 rounded-full bg-black bg-opacity-70 flex items-center justify-center hover:bg-opacity-90 transition-all shadow-lg"
              aria-label="View tagged users"
              title={`View ${taggedUsers?.length || 0} tagged ${(taggedUsers?.length || 0) === 1 ? 'person' : 'people'}`}
            >
              <svg
                width="20"
                height="20"
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
        {/* Heart pop-up animation at tap position */}
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
            <svg className="w-20 h-20 text-red-500 drop-shadow-2xl" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
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
        className="w-20 h-20 text-red-500 drop-shadow-lg"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z" />
      </svg>
    </div>
  );
}

function EngagementBar({
  post,
  onLike,
  onShare,
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

    return () => {
      window.removeEventListener(`commentAdded-${post.id}`, handleCommentAdded);
      window.removeEventListener(`shareAdded-${post.id}`, handleShareAdded);
      window.removeEventListener(`reclipAdded-${post.id}`, handleReclipAdded);
      window.removeEventListener(`viewAdded-${post.id}`, handleViewAdded);
      window.removeEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);
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
    setBusy(true);
    try {
      await onReclip();
    } finally {
      setBusy(false);
    }
  }

  async function shareClick() {
    if (busy) return;
    setBusy(true);
    try {
      await onShare();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
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
              <AiFillHeart className="text-red-500 w-5 h-5" />
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

          {/* Share */}
          <button
            className="flex items-center gap-2 transition-opacity hover:opacity-70 active:opacity-50"
            onClick={shareClick}
            aria-label="Share post"
            title="Share post"
          >
            <FiShare2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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

        {/* Save */}
        {onSave && (
          <button
            className="transition-opacity hover:opacity-70 active:opacity-50"
            onClick={onSave}
            aria-label={isSaved ? 'Unsave post' : 'Save post'}
            title={isSaved ? 'Unsave post' : 'Save post'}
          >
            <FiBookmark className={`w-5 h-5 ${isSaved ? 'text-white fill-white' : 'text-gray-600 dark:text-gray-400'}`} />
          </button>
        )}
      </div>
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

export const FeedCard = React.memo(function FeedCard({ post, onLike, onFollow, onShare, onOpenComments, onView, onReclip, onOpenScenes, showBoostIcon, onBoost }: {
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
}) {
  const { user } = useAuth();
  const titleId = `post-title-${post.id}`;
  const [hasBeenViewed, setHasBeenViewed] = React.useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = React.useState(false);
  const [isBoosted, setIsBoosted] = React.useState(false);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
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

  // Track views when post comes into viewport
  React.useEffect(() => {
    if (hasBeenViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenViewed) {
            setHasBeenViewed(true);
            observer.disconnect(); // Disconnect immediately after first view
            onView();
          }
        });
      },
      { threshold: 0.5 } // Trigger when 50% of post is visible
    );

    if (articleRef.current) {
      observer.observe(articleRef.current);
    }

    return () => observer.disconnect();
  }, [hasBeenViewed]);

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="mx-0 mb-6 overflow-hidden border-0 border-b border-gray-200 dark:border-gray-700 animate-[cardBounce_0.6s_ease-out]" style={{ backgroundColor: '#000000' }}>
      <PostHeader post={post} onFollow={onFollow} showBoostIcon={showBoostIcon} onBoost={onBoost} />
      <TagRow tags={post.tags} />
      <div className="relative w-full overflow-hidden" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        {post.text && !post.mediaUrl && (!post.mediaItems || post.mediaItems.length === 0) ? (
          <TextCard text={post.text} onDoubleLike={onLike} textStyle={post.textStyle} stickers={post.stickers} />
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
            postCreatedAt={post.createdAt}
          />
        )}
        {/* Carousel Indicator - Underneath the image/media */}
        {/* Show row if: multiple media items exist */}
        {post.mediaItems && post.mediaItems.length > 1 ? (
          <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center">
              {/* Center - Carousel Display (Dots and Number) */}
              <div className="flex items-center gap-3">
                {/* Baby Blue Dots */}
                <div className="flex gap-1.5">
                  {post.mediaItems.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${index === carouselIndex
                        ? 'w-6'
                        : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      style={index === carouselIndex ? { backgroundColor: '#2563eb' } : {}}
                    />
                  ))}
                </div>
                {/* Number Indicator */}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {carouselIndex + 1} / {post.mediaItems.length}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {/* Caption for image/video posts */}
      {((post.caption || post.text) && (post.mediaUrl || (post.mediaItems && post.mediaItems.length > 0))) && (
        <div className="px-4 py-3">
          <CaptionText caption={post.caption || post.text || ''} />
        </div>
      )}
      <EngagementBar
        post={post}
        onLike={onLike}
        onShare={onShare}
        onOpenComments={onOpenComments}
        onReclip={onReclip}
        onSave={user ? () => setSaveModalOpen(true) : undefined}
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
        <SavePostModal
          post={post}
          userId={user.id}
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
        />
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
    <article ref={articleRef} aria-labelledby={titleId} className="mx-4 mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 animate-[cardBounce_0.6s_ease-out]" style={{ backgroundColor: '#000000' }}>
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
  const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = React.useState<Post | null>(null);
  const [scenesOpen, setScenesOpen] = React.useState(false);
  const [selectedPostForScenes, setSelectedPostForScenes] = React.useState<Post | null>(null);

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

  // Reset showFollowingFeed when clicking any tab (except Discover which navigates away)
  React.useEffect(() => {
    // When active tab changes, reset following feed
    // (Discover tab navigates to /discover page, so it won't trigger this)
    setShowFollowingFeed(false);
  }, [active]);

  // Listen for resetFeed event from Home button
  React.useEffect(() => {
    const handleResetFeed = () => {
      setShowFollowingFeed(false);
      setActive(user?.national || 'Ireland');
      setCustomLocation(null);
    };
    window.addEventListener('resetFeed', handleResetFeed);
    return () => window.removeEventListener('resetFeed', handleResetFeed);
  }, [user?.national]);

  // Determine current filter - showFollowingFeed overrides everything, then custom location, then active tab
  const currentFilter = showFollowingFeed ? 'discover' : (customLocation || active);

  // Read location from URL query (?location=...) when arriving from Discover
  React.useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const q = params.get('location');
    console.log('URL params changed, location param:', q, 'current customLocation:', customLocation);

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
      // URL param was cleared, clear customLocation too
      console.log('URL param cleared, clearing customLocation...');
      setCustomLocation(null);
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);
    }
  }, [routerLocation.search, customLocation]);

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
      if (m.type === 'like') await toggleLike(m.userId, m.postId);
      if (m.type === 'follow') await toggleFollowForPost(m.userId, m.postId);
      if (m.type === 'comment') await addComment(m.postId, m.userId, m.text!);
      if (m.type === 'view') await incrementViews(m.userId, m.postId);
      if (m.type === 'share') await incrementShares(m.userId, m.postId);
      if (m.type === 'reclip') await reclipPost(m.userId, m.postId, m.userHandle!);
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
    console.log('loadMore called with:', { loading, end, cursor, currentFilter, customLocation, active });
    if (loading || end || cursor === null) {
      console.log('loadMore early return:', { loading, end, cursor });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      requestTokenRef.current++; // Invalidate any pending requests
      const filterForRequest = currentFilter; // capture
      console.log('=== ABOUT TO FETCH POSTS ===');
      console.log('currentFilter:', currentFilter);
      console.log('customLocation:', customLocation);
      console.log('active:', active);
      console.log('Calling fetchPostsPage with filter:', currentFilter);
      const page = await fetchPostsPage(filterForRequest, cursor, 5, userId, user?.local || '', user?.regional || '', user?.national || '');
      console.log('fetchPostsPage returned:', { itemsCount: page.items.length, nextCursor: page.nextCursor });
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
        const page = await fetchPostsPage(currentFilter, 0, 5, userId, user?.local || '', user?.regional || '', user?.national || '');

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
            const pageFresh = await fetchPostsPage(filterForRequest, 0, 5, userId, user?.local || '', user?.regional || '', user?.national || '');
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

  function updateOne(id: string, updater: (p: Post) => Post) {
    console.log('updateOne called for post:', id);
    setPages(cur => {
      const updated = cur.map(group => group.map(p => {
        if (p.id === id) {
          console.log('Updating post:', id, 'from likes:', p.stats.likes, 'to:', updater({ ...p }).stats.likes);
          return updater({ ...p });
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
        />
      ) : (
        /* Show location header only when viewing custom location */
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <FiMapPin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {customLocation} Feed
            </span>
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

      {flat.map((feedItem) => {
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
        return (
          <FeedCard
            key={p.id}
            post={p}
            onLike={async () => {
              console.log('Like button clicked for post:', p.id, 'userLiked:', p.userLiked);
              if (!online) {
                // Optimistically toggle icon only when offline; don't change counts
                updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
              }
              // Use server as source of truth to avoid double increments
              const updated = await toggleLike(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));
              // Notify EngagementBar with authoritative values
              window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                detail: { liked: updated.userLiked, likes: updated.stats.likes }
              }));
              console.log('Like event dispatched for post:', p.id, 'with', { liked: updated.userLiked, likes: updated.stats.likes });
            }}
            onFollow={async () => {
              if (!online) {
                await enqueue({ type: 'follow', postId: p.id, userId });
                return;
              }
              updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));
              await toggleFollowForPost(userId, p.id);
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
            onView={async () => {
              if (!online) {
                await enqueue({ type: 'view', postId: p.id, userId });
                return;
              }
              // Use server as source of truth to avoid double increments
              const updated = await incrementViews(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));

              // Notify EngagementBar to update view count
              window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
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

              // New reclip was created - update the original post and add reclipped post to feed
              updateOne(p.id, post => ({
                ...post,
                userReclipped: updatedOriginalPost.userReclipped,
                stats: updatedOriginalPost.stats
              }));
              // Add the reclipped post to the current feed
              setPages(prev => [[reclippedPost], ...prev]);
              // Notify EngagementBar to update reclip count
              window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`));
            }}
            onOpenScenes={() => {
              setSelectedPostForScenes(p);
              setScenesOpen(true);
            }}
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
              <div className="text-gray-600 text-sm">Be the first to share something from {customLocation}!</div>
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

      {/* Scenes Modal (fullscreen) */}
      {selectedPostForScenes && (() => {
        const p = selectedPostForScenes;
        return (
          <ScenesModal
            post={p}
            isOpen={scenesOpen}
            onClose={() => {
              setScenesOpen(false);
              setSelectedPostForScenes(null);
            }}
            onLike={async () => {
              console.log('Like button clicked for post:', p.id, 'userLiked:', p.userLiked);
              if (!online) {
                const optimisticPost = { ...p, userLiked: !p.userLiked };
                updateOne(p.id, post => ({ ...post, userLiked: !post.userLiked }));
                // Update selectedPostForScenes if this post is currently open in Scenes
                if (selectedPostForScenes?.id === p.id) {
                  setSelectedPostForScenes(optimisticPost);
                }
                // Dispatch event for ScenesModal to update state
                window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                  detail: { liked: optimisticPost.userLiked, likes: p.stats.likes }
                }));
                await enqueue({ type: 'like', postId: p.id, userId });
                return;
              }
              const updated = await toggleLike(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));
              // Update selectedPostForScenes if this post is currently open in Scenes
              if (selectedPostForScenes?.id === p.id) {
                setSelectedPostForScenes(updated);
              }
              window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                detail: { liked: updated.userLiked, likes: updated.stats.likes }
              }));
            }}
            onFollow={async () => {
              if (!online) {
                updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));
                await enqueue({ type: 'follow', postId: p.id, userId });
                return;
              }
              const updated = await toggleFollowForPost(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
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

              // New reclip was created - update the original post and add reclipped post to feed
              updateOne(p.id, post => ({
                ...post,
                userReclipped: updatedOriginalPost.userReclipped,
                stats: updatedOriginalPost.stats
              }));
              // Update selectedPostForScenes if this post is currently open in Scenes
              if (selectedPostForScenes?.id === p.id) {
                setSelectedPostForScenes(updatedOriginalPost);
              }
              // Add the reclipped post to the feed
              setPages(prev => [[reclippedPost], ...prev]);
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
  const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = React.useState<Post | null>(null);
  const [scenesOpen, setScenesOpen] = React.useState(false);
  const [selectedPostForScenes, setSelectedPostForScenes] = React.useState<Post | null>(null);
  const [boostModalOpen, setBoostModalOpen] = React.useState(false);
  const [selectedPostForBoost, setSelectedPostForBoost] = React.useState<Post | null>(null);

  // Load user's posts
  React.useEffect(() => {
    async function loadUserPosts() {
      if (!user?.handle) return;

      setLoading(true);
      setError(null);
      try {
        const userPosts = await fetchPostsByUser(user.handle, 50);
        // Decorate posts for the current user
        const decorated = userPosts.map(p => decorateForUser(userId, p));
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
      // Reload posts to update boost status
      if (user?.handle) {
        fetchPostsByUser(user.handle, 50)
          .then(userPosts => {
            const decorated = userPosts.map(p => decorateForUser(userId, p));
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
    setPosts(cur => cur.map(p => p.id === id ? updater({ ...p }) : p));
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
              const updated = await toggleLike(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));
              window.dispatchEvent(new CustomEvent(`likeToggled-${p.id}`, {
                detail: { liked: updated.userLiked, likes: updated.stats.likes }
              }));
            }}
            onShare={async () => {
              setSelectedPostForShare(p);
              setShareModalOpen(true);
            }}
            onOpenComments={() => handleOpenComments(p.id)}
            onView={async () => {
              if (!online) {
                await enqueue({ type: 'view', postId: p.id, userId });
                return;
              }
              // Use server as source of truth to avoid double increments
              const updated = await incrementViews(userId, p.id);
              updateOne(p.id, _post => ({ ...updated }));

              // Notify EngagementBar to update view count
              window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
            }}
            onReclip={async () => {
              // Users can't reclip their own posts
              console.log('Cannot reclip your own post');
            }}
            onOpenScenes={() => {
              setSelectedPostForScenes(p);
              setScenesOpen(true);
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
            const updated = await toggleLike(userId, selectedPostForScenes.id);
            updateOne(selectedPostForScenes.id, _post => ({ ...updated }));
            window.dispatchEvent(new CustomEvent(`likeToggled-${selectedPostForScenes.id}`, {
              detail: { liked: updated.userLiked, likes: updated.stats.likes }
            }));
          }}
          onFollow={async () => {
            // User's own posts, so no follow action needed
          }}
          onShare={async () => {
            setSelectedPostForShare(selectedPostForScenes);
            setShareModalOpen(true);
          }}
          onOpenComments={() => handleOpenComments(selectedPostForScenes.id)}
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

