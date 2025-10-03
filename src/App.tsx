import React, { useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUser, FiPlusSquare, FiSearch, FiZap, FiHeart, FiEye, FiMessageSquare, FiShare2, FiBookmark, FiCamera, FiMapPin, FiVideo, FiRepeat, FiX } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { BsBookmarkFill } from 'react-icons/bs';
import TopBar from './components/TopBar';
import { useAuth } from './context/Auth';
import { useOnline } from './hooks/useOnline';
import { useOfflineMode } from './hooks/useOfflineMode';
import { useTouchGestures } from './hooks/useTouchGestures';
import { useViewTracking } from './hooks/useViewTracking';
import { fetchPostsPage, toggleBookmark, toggleFollowForPost, toggleLike, reclipPost, unreclipPost } from './api/posts';
import { saveFeed, loadFeed } from './utils/feedCache';
import { enqueue, drain } from './utils/mutationQueue';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import PullToRefresh from './components/PullToRefresh';
import TouchFeedback from './components/TouchFeedback';
import { ViewTrackingDebug } from './components/ViewTrackingDebug';
import CommentsModal from './components/CommentsModal';
import ShareModal from './components/ShareModal';
import { useToast } from './components/Toast';
import HealthStatus from './components/HealthStatus';
import { shareAnalytics } from './utils/shareAnalytics';
import { Button, IconButton } from './components/ui/Button';
import { Card, PostCard } from './components/ui/Card';
import { FeedSkeleton, InlineLoader } from './components/ui/LoadingState';
import { cn } from './utils/cn';
import type { Post } from './types';

type Tab = string;

function BottomNav() {
  const nav = useNavigate();
  const loc = useLocation();
  
  const item = (path: string, label: string, icon: React.ReactNode, badge?: number) => {
    const active = loc.pathname === path || loc.pathname.startsWith(path + '/');
    return (
      <TouchFeedback onTap={() => nav(path)}>
        <div className={cn(
          'flex flex-col items-center justify-center flex-1 py-3 relative transition-all duration-200',
          'hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-xl mx-1',
          active 
            ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        )}>
          <div className="relative">
            <div className={cn(
              'transition-all duration-200',
              active ? 'animate-bounce' : 'hover:scale-110'
            )}>
              {icon}
            </div>
            {badge && badge > 0 && (
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-pulse shadow-lg">
                {badge > 99 ? '99+' : badge}
              </div>
            )}
            {active && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-ping"></div>
            )}
          </div>
          <span className={cn(
            'text-xs mt-1 transition-all duration-200',
            active ? 'font-semibold' : 'font-medium'
          )}>
            {label}
          </span>
        </div>
      </TouchFeedback>
    );
  };

  return (
    <nav 
      aria-label="Primary navigation" 
      className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 z-40 pb-safe"
    >
      {/* Gradient Border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
      
      <div className="mx-auto max-w-md flex px-2 py-1">
        {item('/feed', 'Home', <FiHome size={22} />)}
        {item('/messages', 'Messages', <FiMessageSquare size={22} />, 3)}
        {item('/clip', 'Create', <FiPlusSquare size={22} />)}
        {item('/live', 'Live', <FiVideo size={22} />)}
        {item('/profile', 'Profile', <FiUser size={22} />)}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  const [showInstallPrompt, setShowInstallPrompt] = React.useState(false);
  
  // Handle Clip+ route directly
  if (location.pathname === '/clip') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        <main 
          id="main" 
          className={cn(
            'mx-auto max-w-md min-h-screen relative',
            'pb-[calc(80px+env(safe-area-inset-bottom))]',
            'md:shadow-2xl md:rounded-3xl md:border md:border-gray-200/50 md:dark:border-gray-800/50',
            'md:bg-white/80 md:dark:bg-gray-950/80 md:backdrop-blur-xl',
            'md:my-8 md:min-h-[calc(100vh-4rem)]',
            'animate-fade-in'
          )}
        >
          <TopBar />
          <div className="animate-fade-in-up">
            <ClipPageContent />
          </div>
          <BottomNav />
        </main>
        <OfflineIndicator />
        <InstallPrompt onDismiss={() => setShowInstallPrompt(false)} />
        <ViewTrackingDebug />
        <HealthStatus compact={true} className="fixed top-4 right-4 z-50" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <main 
        id="main" 
        className={cn(
          'mx-auto max-w-md min-h-screen relative',
          'pb-[calc(80px+env(safe-area-inset-bottom))]',
          'md:shadow-2xl md:rounded-3xl md:border md:border-gray-200/50 md:dark:border-gray-800/50',
          'md:bg-white/80 md:dark:bg-gray-950/80 md:backdrop-blur-xl',
          'md:my-8 md:min-h-[calc(100vh-4rem)]',
          'animate-fade-in'
        )}
      >
        <TopBar />
        <div className="animate-fade-in-up">
          <Outlet />
        </div>
        <BottomNav />
        
        {/* Floating Gradient Orbs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-40 h-40 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-1/4 -right-20 w-32 h-32 bg-gradient-to-r from-pink-400/20 to-rose-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 rounded-full blur-2xl animate-pulse"></div>
        </div>
      </main>
      <OfflineIndicator />
      <InstallPrompt onDismiss={() => setShowInstallPrompt(false)} />
      <ViewTrackingDebug />
      <HealthStatus compact={true} className="fixed top-4 right-4 z-50" />
    </div>
  );
}

function PillTabs(props: { active: Tab; onChange: (t: Tab) => void; tabs?: Tab[] }) {
  // Use provided tabs or get user's location preferences from localStorage
  const getUserTabs = (): Tab[] => {
    try {
      const locationPrefs = localStorage.getItem('userLocationPreferences');
      if (locationPrefs) {
        const prefs = JSON.parse(locationPrefs);
        return [prefs.local, prefs.regional, prefs.national, 'Following'];
      }
    } catch (error) {
      console.warn('Error loading user location preferences:', error);
    }
    // Fallback to default tabs
    return ['Finglas', 'Dublin', 'Ireland', 'Following'];
  };

  const tabs = props.tabs || getUserTabs();
  
  return (
    <div role="tablist" aria-label="Locations" className={`grid gap-2 px-4 py-2 ${tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
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
            onClick={() => props.onChange(t)}
            className={cn(
              'rounded-xl text-sm py-3 px-2 font-semibold transition-all duration-200 relative overflow-hidden',
              'hover:scale-105 active:scale-95',
              active 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl' 
                : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md'
            )}
          >
            {/* Active indicator */}
            {active && (
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 animate-pulse"></div>
            )}
            <span className="relative truncate">{t}</span>
          </button>
        );
      })}
    </div>
  );
}

function DiscoverBanner({ onDiscover }: { onDiscover: () => void }) {
  return (
    <Button 
      variant="outline"
      fullWidth
      className="mx-4 mt-4 hover-lift animate-fade-in-up"
      aria-label="Discover other locations"
      onClick={onDiscover}
    >
      <FiSearch className="mr-2" size={16} />
      Discover other locations
    </Button>
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
        <h3 id={titleId} className="font-semibold">{post.userHandle}@{post.locationLabel.toLowerCase().replace(/\s+/g, '')}</h3>
        <div className="text-xs text-gray-600 dark:text-gray-300">{post.storyLocation}</div>
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

function Media({ url, liked, onDoubleLike }: { url: string; liked: boolean; onDoubleLike: () => Promise<void> }) {
  const [burst, setBurst] = React.useState(false);

  const handleDoubleTap = async () => {
    setBurst(true);
    try { 
      await onDoubleLike(); 
    } finally {
      setTimeout(() => setBurst(false), 600);
    }
  };

  return (
    <div className="mx-4 mt-4 select-none">
      <h2 className="text-xl font-semibold text-center mb-2">Post</h2>
      <TouchFeedback
        onDoubleTap={handleDoubleTap}
        className="relative w-full aspect-square rounded-2xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 overflow-hidden bg-gray-50 dark:bg-gray-900"
        hapticFeedback={true}
        rippleEffect={true}
        scaleEffect={true}
      >
        <img 
          src={url} 
          alt="" 
          loading="lazy" 
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover" 
          draggable={false} 
        />
        {/* heart burst */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${burst ? 'opacity-100' : 'opacity-0'}`}>
          <svg className="w-24 h-24 text-red-500 drop-shadow animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"/>
          </svg>
        </div>
      </TouchFeedback>
    </div>
  );
}

function EngagementBar({
  post,
  onLike,
  onBookmark,
  onShare,
  onComment,
  onReclip
}: {
  post: Post;
  onLike: () => Promise<void>;
  onBookmark: () => Promise<void>;
  onShare: () => void;
  onComment: () => void;
  onReclip: () => void;
}) {
  const [liked, setLiked] = React.useState(post.userLiked);
  const [likes, setLikes] = React.useState(post.stats.likes);
  const [bookmarked, setBookmarked] = React.useState(post.isBookmarked);
  const [reclipped, setReclipped] = React.useState(post.userReclipped);
  const [reclips, setReclips] = React.useState(post.stats.reclips);
  const [busy, setBusy] = React.useState(false);

  async function likeClick() {
    if (busy) return;
    setBusy(true);
    setLiked(v => !v);
    setLikes(n => (liked ? n - 1 : n + 1));
    try { 
      await onLike(); 
    } finally { 
      setBusy(false); 
    }
  }

  async function bookmarkClick() {
    if (busy) return;
    setBusy(true);
    setBookmarked(v => !v);
    try { 
      await onBookmark(); 
    } finally { 
      setBusy(false); 
    }
  }

  async function reclipClick() {
    if (busy) return;
    setBusy(true);
    setReclipped(v => !v);
    setReclips(n => (reclipped ? n - 1 : n + 1));
    try { 
      await onReclip(); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={likeClick}
            disabled={busy}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            className={cn(
              'hover-scale transition-all duration-200',
              liked ? 'text-red-500 animate-heart-beat' : 'hover:text-red-500'
            )}
          >
            {liked ? <AiFillHeart size={18} /> : <FiHeart size={18} />}
          </IconButton>
          
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onComment}
            aria-label="Comments"
            className="hover-scale hover:text-blue-500"
          >
            <FiMessageSquare size={18} />
          </IconButton>
          
          <IconButton
            variant="ghost"
            size="sm"
            onClick={reclipClick}
            disabled={busy || post.isOwnPost}
            aria-label={post.isOwnPost ? "Cannot reclip your own post" : (reclipped ? "Unreclip" : "Reclip")}
            className={cn(
              "hover-scale transition-all duration-200",
              post.isOwnPost 
                ? "opacity-50 cursor-not-allowed" 
                : reclipped 
                  ? "text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20" 
                  : "hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            )}
          >
            <FiRepeat size={18} className={cn(reclipped && "rotate-180 transition-transform duration-200")} />
          </IconButton>
          
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onShare}
            aria-label="Share"
            className="hover-scale hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200"
          >
            <FiShare2 size={18} className="hover:rotate-12 transition-transform duration-200" />
          </IconButton>
        </div>

        <IconButton
          variant="ghost"
          size="sm"
          onClick={bookmarkClick}
          disabled={busy}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          className={cn(
            'hover-scale transition-all duration-200',
            bookmarked ? 'text-indigo-500' : 'hover:text-indigo-500'
          )}
        >
          {bookmarked ? <BsBookmarkFill size={18} /> : <FiBookmark size={18} />}
        </IconButton>
      </div>
      
      <div className="flex items-center gap-6 mt-3 text-sm text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{likes.toLocaleString()}</span>
          <span>likes</span>
        </span>
        <span className="flex items-center gap-1">
          <FiEye size={14} />
          <span>{post.stats.views.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1">
          <FiMessageSquare size={14} />
          <span>{post.stats.comments.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1">
          <FiRepeat size={14} />
          <span>{reclips.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

const FeedCard = React.memo(function FeedCard({ post, onLike, onBookmark, onFollow, onShare, onComment, onReclip }: {
  post: Post;
  onLike: () => Promise<void>;
  onBookmark: () => Promise<void>;
  onFollow: () => Promise<void>;
  onShare: () => void;
  onComment: () => void;
  onReclip: () => Promise<void>;
}) {
  const titleId = `post-title-${post.id}`;
  const { observePost, unobservePost, hasViewedPost } = useViewTracking();
  const cardRef = useRef<HTMLDivElement>(null);
  const isViewed = hasViewedPost(post.id);
  
  // Set up intersection observer for automatic view tracking
  React.useEffect(() => {
    const element = cardRef.current;
    if (element) {
      observePost(element, post.id);
      
      return () => {
        unobservePost(element);
      };
    }
  }, [post.id, observePost, unobservePost]);
  
  return (
    <PostCard 
      ref={cardRef}
      aria-labelledby={titleId} 
      className={cn(
        "mx-4 mb-6 animate-fade-in-up overflow-hidden",
        isViewed && "opacity-90" // Slightly dim viewed posts
      )}
    >
      <PostHeader post={post} onFollow={onFollow} />
      <TagRow tags={post.tags} />
      <Media url={post.mediaUrl} liked={post.userLiked} onDoubleLike={onLike} />
      <EngagementBar post={post} onLike={onLike} onBookmark={onBookmark} onShare={onShare} onComment={onComment} onReclip={onReclip} />
      
      {/* View indicator */}
      {isViewed && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full opacity-60" 
             title="Post viewed" />
      )}
    </PostCard>
  );
});

export function FeedPageWrapper() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const online = useOnline();
  const { queueAction, isOnline } = useOfflineMode();
  
  // Get initial active tab from user preferences
  const getInitialTab = (): Tab => {
    try {
      const locationPrefs = localStorage.getItem('userLocationPreferences');
      if (locationPrefs) {
        const prefs = JSON.parse(locationPrefs);
        return prefs.regional; // Default to regional (Dublin-equivalent)
      }
    } catch (error) {
      console.warn('Error loading initial tab:', error);
    }
    return 'Dublin'; // Fallback
  };

  const [active, setActive] = React.useState<Tab>(getInitialTab());
  const [pages, setPages] = React.useState<Post[][]>([]);
  const [cursor, setCursor] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
  const [showComments, setShowComments] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [sharePost, setSharePost] = React.useState<Post | null>(null);
  const [showDiscover, setShowDiscover] = React.useState(false);
  const [discoveredLocation, setDiscoveredLocation] = React.useState<string | null>(null);
  const { ToastContainer, success, error: showError } = useToast();

  // Load from cache on mount/tab change
  React.useEffect(() => {
    loadFeed(userId, active).then(p => p.length && setPages(p));
  }, [userId, active]);

  // Drain mutations when back online
  React.useEffect(() => {
    if (!online) return;
    drain(async (m) => {
      if (m.type === 'like') await toggleLike(m.userId, m.postId);
      if (m.type === 'bookmark') await toggleBookmark(m.userId, m.postId);
      if (m.type === 'follow') await toggleFollowForPost(m.userId, m.postId);
    });
  }, [online]);

  async function loadMore() {
    if (loading || end || cursor === null) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPostsPage(active, cursor, 5, userId);
      setPages(prev => {
        const next = [...prev, page.items];
        saveFeed(userId, active, next);
        return next;
      });
      setCursor(page.nextCursor);
      setEnd(page.nextCursor === null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  React.useEffect(() => {
    if (cursor !== null && pages.length === 0) loadMore();
  }, [cursor, active]);

  function updateOne(id: string, updater: (p: Post) => Post) {
    setPages(cur =>
      cur.map(group => group.map(p => (p.id === id ? updater({ ...p }) : p)))
    );
  }

  const flat = React.useMemo(() => pages.flat(), [pages]);

  // Comment handler
  const handleComment = (post: Post) => {
    setSelectedPost(post);
    setShowComments(true);
  };

  // Update comment count
  const handleCommentCountUpdate = (newCount: number) => {
    if (selectedPost) {
      updateOne(selectedPost.id, post => ({
        ...post,
        stats: { ...post.stats, comments: newCount }
      }));
    }
  };

  // Share handler
  const handleShare = (post: Post) => {
    setSharePost(post);
    setShowShare(true);
  };

  // Handle share analytics
  const handleShareAnalytics = (platform: string) => {
    if (sharePost) {
      shareAnalytics.trackShare(sharePost.id, platform, user?.id);
      
      // Show success message
      switch (platform) {
        case 'copy':
          success('Link copied to clipboard!');
          break;
        case 'native':
          success('Shared successfully!');
          break;
        default:
          success(`Shared to ${platform}!`);
      }
    }
  };

  // Reclip handler
  const handleReclip = async (post: Post) => {
    if (post.isOwnPost) {
      showError('You cannot reclip your own posts');
      return;
    }

    try {
      if (post.userReclipped) {
        await unreclipPost(post.id);
        success('Post unreclipped successfully!');
      } else {
        await reclipPost(post.id);
        success('Post reclipped! Your followers will see this.');
      }
    } catch (error) {
      console.error('Failed to reclip post:', error);
      showError('Failed to reclip post. Please try again.');
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Reset pagination and fetch fresh data
      setCursor(0);
      setEnd(false);
      const page = await fetchPostsPage(active, 0, 5, userId);
      setPages([page.items]);
      setCursor(page.nextCursor);
      setEnd(page.nextCursor === null);
      saveFeed(userId, active, [page.items]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to refresh feed.');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle discover location
  const handleDiscover = () => {
    setShowDiscover(true);
  };

  const handleLocationDiscover = (location: string) => {
    setDiscoveredLocation(location);
    setActive(location as Tab);
    setShowDiscover(false);
    // Clear existing pages to load new location
    setPages([]);
    setCursor(0);
    setEnd(false);
    success(`Switched to ${location} feed!`);
  };

  const handleResetLocation = () => {
    setDiscoveredLocation(null);
    setActive(getInitialTab());
    setPages([]);
    setCursor(0);
    setEnd(false);
    success('Reset to your default locations!');
  };

  // Get current tabs based on discovered location
  const getCurrentTabs = (): Tab[] => {
    if (discoveredLocation) {
      return [discoveredLocation as Tab, 'Following'];
    }
    return ['Finglas', 'Dublin', 'Ireland', 'Following'];
  };

  // Touch gesture handlers for tab switching
  const feedContainerRef = useTouchGestures<HTMLDivElement>({
    onSwipeLeft: () => {
      const tabs = getCurrentTabs();
      const currentIndex = tabs.indexOf(active);
      if (currentIndex < tabs.length - 1) {
        setActive(tabs[currentIndex + 1]);
      }
    },
    onSwipeRight: () => {
      const tabs = getCurrentTabs();
      const currentIndex = tabs.indexOf(active);
      if (currentIndex > 0) {
        setActive(tabs[currentIndex - 1]);
      }
    }
  });

  // Not logged in
  if (!user) {
    return (
      <div className="p-6">
        <a href="/login" className="text-brand-600 underline">Sign in</a> to view your feed.
      </div>
    );
  }

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh} disabled={loading || refreshing}>
      <div 
        ref={feedContainerRef}
        id={`panel-${active}`} 
        role="tabpanel" 
        aria-labelledby={`tab-${active}`} 
        className="pb-2"
      >
        <div className="h-2" />
        
        <PillTabs active={active} onChange={setActive} tabs={getCurrentTabs()} />
        {discoveredLocation && (
          <div className="mx-4 mt-2 mb-2">
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-blue-600 dark:text-blue-400" size={16} />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Exploring: {discoveredLocation}
                </span>
              </div>
              <button
                onClick={handleResetLocation}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
              >
                Reset
              </button>
            </div>
          </div>
        )}
        <DiscoverBanner onDiscover={handleDiscover} />
      
            {error && (
              <Card className="mx-4 my-4 p-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                      Something went wrong
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                      {error}
                    </p>
                    <Button 
                      variant="danger"
                      size="sm"
                      onClick={() => { setError(null); loadMore(); }}
                      className="hover-scale"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </Card>
            )}

      {flat.map(p => (
        <FeedCard
          key={p.id}
          post={p}
          onLike={async () => {
            // Optimistic update
            updateOne(p.id, post => {
              const next = !post.userLiked;
              post.userLiked = next;
              post.stats.likes += next ? 1 : -1;
              return post;
            });

            if (!isOnline) {
              await queueAction({ 
                type: 'like', 
                data: { postId: p.id }, 
                userId 
              });
              return;
            }
            
            try {
              await toggleLike(userId, p.id);
            } catch (error) {
              // Revert optimistic update on error
              updateOne(p.id, post => {
                const next = !post.userLiked;
                post.userLiked = next;
                post.stats.likes += next ? 1 : -1;
                return post;
              });
            }
          }}
          onBookmark={async () => {
            // Optimistic update
            updateOne(p.id, post => ({ ...post, isBookmarked: !post.isBookmarked }));

            if (!isOnline) {
              await queueAction({ 
                type: 'bookmark', 
                data: { postId: p.id }, 
                userId 
              });
              return;
            }
            
            try {
              await toggleBookmark(userId, p.id);
            } catch (error) {
              // Revert optimistic update on error
              updateOne(p.id, post => ({ ...post, isBookmarked: !post.isBookmarked }));
            }
          }}
          onFollow={async () => {
            // Optimistic update
            updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));

            if (!isOnline) {
              await queueAction({ 
                type: 'follow', 
                data: { postId: p.id }, 
                userId 
              });
              return;
            }
            
            try {
              await toggleFollowForPost(userId, p.id);
            } catch (error) {
              // Revert optimistic update on error
              updateOne(p.id, post => ({ ...post, isFollowing: !post.isFollowing }));
            }
          }}
          onShare={() => handleShare(p)}
          onComment={() => handleComment(p)}
          onReclip={() => handleReclip(p)}
        />
      ))}

            {loading && <FeedSkeleton count={2} />}

      {end && flat.length === 0 && (
        <Card className="mx-4 my-8 p-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiZap size={24} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            No posts yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Be the first to share something amazing in {active}!
          </p>
          <Button 
            size="sm"
            className="hover-scale bg-brand-600 text-white hover:bg-brand-700"
            onClick={() => window.location.href = '/clip'}
          >
            Create Post
          </Button>
        </Card>
      )}
      
      {end && flat.length > 0 && (
        <div className="p-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            You're all caught up!
          </div>
        </div>
      )}
      </div>
    </PullToRefresh>
    
    {/* Comments Modal */}
    {selectedPost && (
      <CommentsModal
        post={selectedPost}
        isOpen={showComments}
        onClose={() => {
          setShowComments(false);
          setSelectedPost(null);
        }}
        onCommentCountUpdate={handleCommentCountUpdate}
      />
    )}
    
    {/* Share Modal */}
    {sharePost && (
      <ShareModal
        post={sharePost}
        isOpen={showShare}
        onClose={() => {
          setShowShare(false);
          setSharePost(null);
        }}
        onShare={handleShareAnalytics}
      />
    )}
    
    {/* Discover Location Modal */}
    {showDiscover && (
      <DiscoverLocationModal 
        onClose={() => setShowDiscover(false)}
        onDiscover={handleLocationDiscover}
      />
    )}

    {/* Toast Container */}
    <ToastContainer />
    </>
  );
}

function DiscoverLocationModal({ onClose, onDiscover }: { 
  onClose: () => void; 
  onDiscover: (location: string) => void; 
}) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);

  // Popular locations for suggestions
  const popularLocations = [
    'New York', 'London', 'Paris', 'Tokyo', 'Sydney', 'Toronto', 'Berlin', 'Madrid',
    'Rome', 'Amsterdam', 'Barcelona', 'Vienna', 'Prague', 'Stockholm', 'Copenhagen',
    'Los Angeles', 'Chicago', 'Boston', 'San Francisco', 'Seattle', 'Miami', 'Austin'
  ];

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      // Simulate API call to validate location
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, just use the search term as the location
      onDiscover(searchTerm.trim());
    } catch (error) {
      console.error('Failed to search location:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location: string) => {
    onDiscover(location);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md max-h-[80vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Discover Location
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <FiX size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a city or location..."
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <button
            onClick={handleSearch}
            disabled={!searchTerm.trim() || isSearching}
            className="w-full mt-3 px-4 py-3 bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search Location'}
          </button>
        </div>

        {/* Popular Locations */}
        <div className="px-4 pb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Popular Locations
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {popularLocations.map((location) => (
              <button
                key={location}
                onClick={() => handleLocationSelect(location)}
                className="p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiMapPin size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {location}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClipPageContent() {
  const { user } = useAuth();
  const [text, setText] = React.useState('');
  const [storyLocation, setStoryLocation] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Import the addPost function
      const { addPost } = await import('./api/posts');
      
      // Create the new post
      await addPost({
        userHandle: user?.name || 'darraghdublin',
        locationLabel: user?.location || user?.regional_location || 'Unknown Location', // User's regional location
        storyLocation: storyLocation || 'Unknown Location', // Specific post location
        mediaUrl: 'https://picsum.photos/400/400?random=' + Math.random(),
        tags: text.split(' ').filter(word => word.startsWith('#')).slice(0, 5),
        userLiked: false,
        isBookmarked: false,
        isFollowing: false
      });
      
      // Show success message
      alert('Story shared successfully!');
      
      // Clear form
      setText('');
      setStoryLocation('');
      
      // Navigate back to feed
      window.location.href = '/feed';
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to share story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Create Story</h1>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || !text.trim()}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Posting...' : 'Post'}
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

      {/* Story Location Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Story Location
        </label>
        <div className="relative">
          <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={storyLocation}
            onChange={(e) => setStoryLocation(e.target.value)}
            placeholder="Add Story Location (e.g., Central Park, NYC)"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !text.trim()}
        className="w-full py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Sharing...' : 'Share Story'}
      </button>
    </div>
  );
}

// Expose to router
(App as any).FeedPage = FeedPageWrapper;
(App as any).ClipPageContent = ClipPageContent;
export type {};
