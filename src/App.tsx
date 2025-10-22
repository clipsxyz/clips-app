import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUser, FiPlusSquare, FiSearch, FiZap, FiHeart, FiEye, FiMessageSquare, FiShare2, FiCamera, FiMapPin, FiRepeat } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import TopBar from './components/TopBar';
import CommentsModal from './components/CommentsModal';
import { useAuth } from './context/Auth';
import { useOnline } from './hooks/useOnline';
import { fetchPostsPage, toggleFollowForPost, toggleLike, addComment, incrementViews, incrementShares, reclipPost } from './api/posts';
import { enqueue, drain } from './utils/mutationQueue';
import type { Post } from './types';

type Tab = 'Finglas' | 'Dublin' | 'Ireland' | 'Following';

function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();

  const item = (path: string, label: string, icon: React.ReactNode) => {
    const active = loc.pathname === path;
    return (
      <button
        onClick={() => nav(path)}
        className={`flex flex-col items-center justify-center flex-1 py-2 ${active ? 'text-brand-600 font-semibold' : 'text-gray-500'} transition-colors`}
        aria-current={active ? 'page' : undefined}
        title={label}
      >
        {icon}
        <span className="text-xs mt-1">{label}</span>
      </button>
    );
  };

  return (
    <nav aria-label="Primary navigation" className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 z-40 pb-safe">
      <div className="mx-auto max-w-md flex">
        {item('/feed', 'Home', <FiHome size={22} />)}
        {item('/create', 'Create', <FiPlusSquare size={22} />)}
        {item('/boost', 'Boost !', <FiZap size={22} />)}
        {item('/search', 'Search', <FiSearch size={22} />)}
        {item('/profile', 'Profile', <FiUser size={22} />)}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState<string>('Dublin');
  const [customLocation, setCustomLocation] = React.useState<string | null>(null);

  // Determine current filter - custom location overrides tabs
  const currentFilter = customLocation || activeTab;

  // Handle Clip+ route directly
  if (location.pathname === '/clip') {
    return (
      <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800 md:bg-white md:dark:bg-gray-950">
        <TopBar activeTab={currentFilter} onLocationChange={setCustomLocation} />
        <ClipPageContent />
        <BottomNav />
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800 md:bg-white md:dark:bg-gray-950">
      <TopBar activeTab={currentFilter} onLocationChange={setCustomLocation} />
      <Outlet context={{ activeTab, setActiveTab, customLocation, setCustomLocation }} />
      <BottomNav />
    </main>
  );
}

function PillTabs(props: { active: Tab; onChange: (t: Tab) => void; onClearCustom?: () => void }) {
  const tabs: Tab[] = ['Finglas', 'Dublin', 'Ireland', 'Following'];

  return (
    <div role="tablist" aria-label="Locations" className="grid grid-cols-4 gap-2 px-3">
      {tabs.map(t => {
        const active = props.active === t;
        const id = `tab-${t}`;
        const panelId = `panel-${t}`;

        return (
          <button
            key={t}
            id={id}
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              props.onChange(t);
              props.onClearCustom?.(); // Clear custom location when clicking tabs
            }}
            className={`rounded-md border text-sm py-2 font-medium transition-transform active:scale-[.98]
              ${active
                ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white shadow-sm'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'}`}
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
      className={`px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-60 transition-transform active:scale-[.98]
        ${following
          ? 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
          : 'bg-white border-gray-300 text-gray-800 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200'}`}
    >
      {following ? 'Following' : 'Follow +'}
    </button>
  );
}

function PostHeader({ post, onFollow }: { post: Post; onFollow: () => Promise<void> }) {
  const titleId = `post-title-${post.id}`;

  return (
    <div className="flex items-start justify-between px-4 mt-4">
      <div>
        <h3 id={titleId} className="font-semibold">{post.userHandle}</h3>
        <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
          <FiMapPin className="w-3 h-3" />
          {post.locationLabel || 'No location set'}
        </div>
      </div>
      <FollowButton initial={post.isFollowing} onToggle={onFollow} />
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex justify-between px-4 text-sm text-gray-600 dark:text-gray-300 mt-3">
      {tags.slice(0, 5).map((t, i) => <span key={i}>{t}</span>)}
    </div>
  );
}

function TextCard({ text, onDoubleLike }: { text: string; onDoubleLike: () => Promise<void> }) {
  const [burst, setBurst] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const lastTap = React.useRef<number>(0);
  const touchHandled = React.useRef<boolean>(false);

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

  // Select background based on text content (consistent for same text)
  const backgroundIndex = text.length % backgrounds.length;
  const selectedBackground = backgrounds[backgroundIndex];

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
    <div className="mx-4 mt-4 select-none">
      <div
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
        className="relative p-6 rounded-2xl min-h-[120px] flex items-center justify-center shadow-2xl hover:shadow-3xl transition-all duration-300"
        style={{
          background: selectedBackground,
          boxShadow: `0 0 30px ${selectedBackground}40, 0 0 60px ${selectedBackground}20`
        }}
      >
        <div className="text-center w-full">
          <div className="text-xl text-white leading-relaxed whitespace-pre-wrap font-bold drop-shadow-lg">
            {displayText}
          </div>
          {shouldTruncate && (
            <button
              onClick={handleMoreClick}
              className="mt-3 text-white text-sm font-medium hover:underline focus:outline-none focus:ring-0 focus:border-0 drop-shadow-sm px-3 py-1 rounded-full transition-all duration-200 hover:scale-105 border-0"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                outline: 'none'
              }}
              aria-label={isExpanded ? 'Show less' : 'Show more'}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

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
        className="mt-2 text-white text-sm font-medium hover:underline focus:outline-none focus:ring-0 focus:border-0"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

function Media({ url, mediaType, text, imageText, onDoubleLike }: { url: string; mediaType?: 'image' | 'video'; text?: string; imageText?: string; onDoubleLike: () => Promise<void> }) {
  const [burst, setBurst] = React.useState(false);
  const lastTap = React.useRef<number>(0);
  const touchHandled = React.useRef<boolean>(false);

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

  // If this is a text-only post, render TextCard
  if (text && !url) {
    return <TextCard text={text} onDoubleLike={onDoubleLike} />;
  }

  return (
    <div className="mx-4 mt-4 select-none">
      <div
        role="button"
        tabIndex={0}
        aria-label="Open media. Double tap or press to like"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDoubleLike();
          }
        }}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-square rounded-2xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 overflow-hidden bg-gray-50 dark:bg-gray-900"
      >
        {mediaType === 'video' ? (
          <video
            src={url}
            className="absolute inset-0 w-full h-full object-cover"
            controls
            preload="metadata"
            playsInline
          />
        ) : (
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        )}
        {/* Image Text Overlay */}
        {imageText && mediaType === 'image' && (
          <div className="absolute bottom-4 left-4 right-4">
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

function EngagementBar({
  post,
  onLike,
  onShare,
  onOpenComments,
  onReclip
}: {
  post: Post;
  onLike: () => Promise<void>;
  onShare: () => Promise<void>;
  onOpenComments: () => void;
  onReclip: () => Promise<void>;
}) {
  const [liked, setLiked] = React.useState(post.userLiked);
  const [likes, setLikes] = React.useState(post.stats.likes);
  const [views, setViews] = React.useState(post.stats.views);
  const [comments, setComments] = React.useState(post.stats.comments);
  const [shares, setShares] = React.useState(post.stats.shares);
  const [reclips, setReclips] = React.useState(post.stats.reclips);
  const [busy, setBusy] = React.useState(false);

  // Sync with post data changes
  React.useEffect(() => {
    setLiked(post.userLiked);
    setLikes(post.stats.likes);
    setViews(post.stats.views);
    setComments(post.stats.comments);
    setShares(post.stats.shares);
    setReclips(post.stats.reclips);
  }, [post.userLiked, post.stats.likes, post.stats.views, post.stats.comments, post.stats.shares, post.stats.reclips]);

  // Listen for engagement updates
  React.useEffect(() => {
    const handleCommentAdded = () => {
      setComments(prev => prev + 1);
    };

    const handleViewAdded = () => {
      setViews(prev => prev + 1);
    };

    const handleShareAdded = () => {
      setShares(prev => prev + 1);
    };

    const handleReclipAdded = () => {
      setReclips(prev => prev + 1);
    };

    const handleLikeToggled = (event: CustomEvent) => {
      setLiked(event.detail.liked);
      setLikes(event.detail.likes);
    };

    // Listen for all engagement events
    window.addEventListener(`commentAdded-${post.id}`, handleCommentAdded);
    window.addEventListener(`viewAdded-${post.id}`, handleViewAdded);
    window.addEventListener(`shareAdded-${post.id}`, handleShareAdded);
    window.addEventListener(`reclipAdded-${post.id}`, handleReclipAdded);
    window.addEventListener(`likeToggled-${post.id}`, handleLikeToggled as EventListener);

    return () => {
      window.removeEventListener(`commentAdded-${post.id}`, handleCommentAdded);
      window.removeEventListener(`viewAdded-${post.id}`, handleViewAdded);
      window.removeEventListener(`shareAdded-${post.id}`, handleShareAdded);
      window.removeEventListener(`reclipAdded-${post.id}`, handleReclipAdded);
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
    <div className="px-4 mt-3">
      <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={likeClick}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            title={liked ? 'Unlike' : 'Like'}
          >
            {liked ? <AiFillHeart className="text-red-500" /> : <FiHeart />}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{likes}</span>
        </div>

        {/* Views */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1">
            <FiEye />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{views}</span>
        </div>

        {/* Comments */}
        <div className="flex flex-col items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={onOpenComments}
            aria-label="Comments"
          >
            <FiMessageSquare />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{comments}</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={shareClick}
            aria-label="Share post"
            title="Share post"
          >
            <FiShare2 />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{shares}</span>
        </div>

        {/* Reclip */}
        <div className="flex flex-col items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={reclipClick}
            aria-label="Reclip post"
            title="Reclip post"
          >
            <FiRepeat />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{reclips}</span>
        </div>
      </div>
    </div>
  );
}

const FeedCard = React.memo(function FeedCard({ post, onLike, onFollow, onShare, onOpenComments, onView, onReclip }: {
  post: Post;
  onLike: () => Promise<void>;
  onFollow: () => Promise<void>;
  onShare: () => Promise<void>;
  onOpenComments: () => void;
  onView: () => Promise<void>;
  onReclip: () => Promise<void>;
}) {
  const titleId = `post-title-${post.id}`;
  const [hasBeenViewed, setHasBeenViewed] = React.useState(false);
  const articleRef = React.useRef<HTMLElement>(null);

  // Track views when post comes into viewport
  React.useEffect(() => {
    if (hasBeenViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenViewed) {
            setHasBeenViewed(true);
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
  }, [hasBeenViewed, onView]);

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="pb-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover-lift">
      <PostHeader post={post} onFollow={onFollow} />
      <TagRow tags={post.tags} />
      <Media url={post.mediaUrl} mediaType={post.mediaType} text={post.text} imageText={post.imageText} onDoubleLike={onLike} />
      {/* Caption for image/video posts */}
      {post.caption && post.mediaUrl && (
        <div className="px-4 py-3">
          <CaptionText caption={post.caption} />
        </div>
      )}
      <EngagementBar post={post} onLike={onLike} onShare={onShare} onOpenComments={onOpenComments} onReclip={onReclip} />
    </article>
  );
});

function FeedPageWrapper() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const online = useOnline();
  const [active, setActive] = React.useState<Tab>('Dublin');
  const [customLocation, setCustomLocation] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<Post[][]>([]);
  const [cursor, setCursor] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [commentsModalOpen, setCommentsModalOpen] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);

  // Determine current filter - custom location overrides tabs
  const currentFilter = customLocation || active;

  // Load from cache on mount/tab change
  React.useEffect(() => {
    // Reset pages when changing tabs
    setPages([]);
    setCursor(0);
    setEnd(false);

    // Don't load cached data for Following tab - always fetch fresh
    if (currentFilter.toLowerCase() !== 'following') {
      // Temporarily disable feed cache loading to avoid duplicates
      // loadFeed(userId, currentFilter).then(p => p.length && setPages(p));
    }
  }, [userId, currentFilter]);

  // Sync with TopBar dropdown
  React.useEffect(() => {
    const handleLocationChange = (event: CustomEvent) => {
      const location = event.detail.location;
      setCustomLocation(location);
      setPages([]);
      setCursor(0);
      setEnd(false);
      setError(null);
    };

    window.addEventListener('locationChange', handleLocationChange as EventListener);
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
    console.log('loadMore called with:', { loading, end, cursor, currentFilter });
    if (loading || end || cursor === null) {
      console.log('loadMore early return:', { loading, end, cursor });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('Calling fetchPostsPage with:', { currentFilter, cursor, userId });
      const page = await fetchPostsPage(currentFilter, cursor, 5, userId, user?.local || '', user?.regional || '', user?.national || '');
      console.log('fetchPostsPage returned:', { itemsCount: page.items.length, nextCursor: page.nextCursor });
      setPages(prev => {
        const next = [...prev, page.items];
        console.log('Setting pages:', { prevLength: prev.length, newLength: next.length });
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

  // Initial load
  React.useEffect(() => {
    if (cursor !== null && pages.length === 0) loadMore();
  }, [cursor, currentFilter]);

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

    return uniquePosts;
  }, [pages]);

  // Not logged in
  if (!user) {
    return (
      <div className="p-6">
        <a href="/login" className="text-brand-600 underline">Sign in</a> to view your feed.
      </div>
    );
  }

  return (
    <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="pb-2">
      <div className="h-2" />

      {/* Offline banner */}
      {!online && (
        <div className="mx-3 mt-2 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs">
          You're offline. Actions will sync when back online.
        </div>
      )}

      <PillTabs active={active} onChange={setActive} onClearCustom={() => setCustomLocation(null)} />

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

      {flat.map(p => (
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
            if (!online) {
              await enqueue({ type: 'share', postId: p.id, userId });
              return;
            }
            updateOne(p.id, post => {
              post.stats.shares += 1;
              return post;
            });
            await incrementShares(userId, p.id);

            // Notify EngagementBar to update share count
            window.dispatchEvent(new CustomEvent(`shareAdded-${p.id}`));

            if (navigator.share) {
              try {
                await navigator.share({ url: window.location.href, title: 'Post', text: '' });
              } catch { }
            } else {
              await navigator.clipboard.writeText(window.location.href);
            }
          }}
          onOpenComments={() => handleOpenComments(p.id)}
          onView={async () => {
            if (!online) {
              await enqueue({ type: 'view', postId: p.id, userId });
              return;
            }
            updateOne(p.id, post => {
              post.stats.views += 1;
              return post;
            });
            await incrementViews(userId, p.id);

            // Notify EngagementBar to update view count
            window.dispatchEvent(new CustomEvent(`viewAdded-${p.id}`));
          }}
          onReclip={async () => {
            if (!online) {
              await enqueue({ type: 'reclip', postId: p.id, userId, userHandle: user?.handle || 'Unknown@Unknown' });
              return;
            }
            const reclippedPost = await reclipPost(userId, p.id, user?.handle || 'Unknown@Unknown');
            // Add the reclipped post to the current feed
            setPages(prev => [[reclippedPost], ...prev]);

            // Notify EngagementBar to update reclip count
            window.dispatchEvent(new CustomEvent(`reclipAdded-${p.id}`));
          }}
        />
      ))}

      {loading && (
        <div className="px-4 py-6 animate-pulse">
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
          <div className="w-full aspect-square bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      )}

      {end && flat.length === 0 && (
        <div className="p-8 text-center text-gray-600 dark:text-gray-300">
          <div className="text-lg font-semibold mb-1">Unlock Your Following News Feed</div>
          <div className="text-gray-600 text-sm">This feed only populates with the accounts you follow. Start tapping Follow to personalize your stream</div>
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
    </div>
  );
}

function ClipPageContent() {
  const { user } = useAuth();
  const [text, setText] = React.useState('');
  const [location, setLocation] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Story shared! Text: ' + text + ', Location: ' + location);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Create Story</h1>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium"
        >
          Post
        </button>
      </div>

      {/* Username */}
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {user?.name || 'darraghdublin'}
      </div>

      {/* Media Upload Area */}
      <div className="relative">
        <div className="w-full aspect-square rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <FiCamera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Tap to add photo or video</p>
          </div>
        </div>
      </div>

      {/* Text Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Story Text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Input Story Text"
          className="w-full h-32 p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Location Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Location
        </label>
        <div className="relative">
          <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add Story Location"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="w-full py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
      >
        Share Story
      </button>
    </div>
  );
}

// Expose to router
(App as any).FeedPage = FeedPageWrapper;
(App as any).ClipPageContent = ClipPageContent;

// Export for direct import
export { FeedPageWrapper };
