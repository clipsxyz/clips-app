import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUser, FiPlusSquare, FiSearch, FiZap, FiHeart, FiEye, FiMessageSquare, FiShare2, FiBookmark, FiCamera, FiMapPin, FiVideo } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { BsBookmarkFill } from 'react-icons/bs';
import TopBar from './components/TopBar';
import { useAuth } from './context/Auth';
import { useOnline } from './hooks/useOnline';
import { fetchPostsPage, toggleBookmark, toggleFollowForPost, toggleLike } from './api/posts';
import { saveFeed, loadFeed } from './utils/feedCache';
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
        {item('/boost', 'Boost !', <FiZap size={22} />)}
        {item('/clip', 'Clip+', <FiPlusSquare size={22} />)}
        {item('/search', 'Search', <FiSearch size={22} />)}
        {item('/profile', 'Profile', <FiUser size={22} />)}
      </div>
    </nav>
  );
}

export default function App() {
  const location = useLocation();
  
  // Handle Clip+ route directly
  if (location.pathname === '/clip') {
    return (
      <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800 md:bg-white md:dark:bg-gray-950">
        <TopBar />
        <ClipPageContent />
        <BottomNav />
      </main>
    );
  }
  
  return (
    <main id="main" className="mx-auto max-w-md min-h-screen pb-[calc(64px+theme(spacing.safe))] md:shadow-card md:rounded-2xl md:border md:border-gray-200 md:dark:border-gray-800 md:bg-white md:dark:bg-gray-950">
      <TopBar />
      <Outlet />
      <BottomNav />
    </main>
  );
}

function PillTabs(props: { active: Tab; onChange: (t: Tab) => void }) {
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
            onClick={() => props.onChange(t)}
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

function DiscoverBanner() {
  return (
    <button 
      className="mx-3 mt-3 w-[calc(100%-1.5rem)] rounded-md border border-gray-300 py-2 text-center font-semibold bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 dark:border-gray-700 hover-lift"
      aria-label="Discover other locations"
    >
      Discover other locations
    </button>
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
        <div className="text-xs text-gray-600 dark:text-gray-300">{post.locationLabel}</div>
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
  const lastTap = React.useRef<number>(0);

  async function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setBurst(true);
      try { 
        await onDoubleLike(); 
      } finally {
        setTimeout(() => setBurst(false), 600);
      }
    }
    lastTap.current = now;
  }

  return (
    <div className="mx-4 mt-4 select-none">
      <h2 className="text-xl font-semibold text-center mb-2">Post</h2>
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
        onClick={handleTap}
        onTouchEnd={handleTap}
        className="relative w-full aspect-square rounded-2xl ring-1 ring-gray-200/60 dark:ring-gray-700/60 overflow-hidden bg-gray-50 dark:bg-gray-900"
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
          <svg className="w-24 h-24 text-red-500 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.35-9.4-8.86C1.4 8.92 3.49 6 6.6 6c1.72 0 3.23.93 4.08 2.33C11.17 6.93 12.68 6 14.4 6c3.11 0 5.2 2.92 4.99 6.14C19.5 16.65 12 21 12 21z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

function EngagementBar({
  post,
  onLike,
  onBookmark,
  onShare
}: {
  post: Post;
  onLike: () => Promise<void>;
  onBookmark: () => Promise<void>;
  onShare: () => Promise<void>;
}) {
  const [liked, setLiked] = React.useState(post.userLiked);
  const [likes, setLikes] = React.useState(post.stats.likes);
  const [bookmarked, setBookmarked] = React.useState(post.isBookmarked);
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

  return (
    <div className="px-4 mt-3">
      <div className="flex items-center gap-5 text-sm text-gray-700 dark:text-gray-200">
        <button 
          className="min-h-10 min-w-10 px-2 flex items-center gap-1 transition-transform active:scale-[.98]" 
          onClick={likeClick} 
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
          title={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <AiFillHeart className="text-red-500" /> : <FiHeart />} Like
        </button>
        <span className="flex items-center gap-1"><FiEye /> Views</span>
        <button className="min-h-10 min-w-10 px-2 flex items-center gap-1 transition-transform active:scale-[.98]" aria-label="Comments"><FiMessageSquare /> Comment</button>
        <button 
          className="min-h-10 min-w-10 px-2 flex items-center gap-1 transition-transform active:scale-[.98]" 
          onClick={onShare}
          aria-label="Share"
        >
          <FiShare2 /> Share
        </button>
        <button 
          className="ml-auto min-h-10 min-w-10 px-2 flex items-center gap-1 transition-transform active:scale-[.98]" 
          onClick={bookmarkClick} 
          aria-pressed={bookmarked}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          {bookmarked ? <BsBookmarkFill /> : <FiBookmark />} Reclip
        </button>
      </div>
      <div className="flex gap-8 mt-1 text-xs text-gray-500 dark:text-gray-400">
        <span>{likes}</span>
        <span>{post.stats.views}</span>
      </div>
    </div>
  );
}

const FeedCard = React.memo(function FeedCard({ post, onLike, onBookmark, onFollow, onShare }: {
  post: Post;
  onLike: () => Promise<void>;
  onBookmark: () => Promise<void>;
  onFollow: () => Promise<void>;
  onShare: () => Promise<void>;
}) {
  const titleId = `post-title-${post.id}`;
  
  return (
    <article aria-labelledby={titleId} className="pb-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover-lift">
      <PostHeader post={post} onFollow={onFollow} />
      <TagRow tags={post.tags} />
      <Media url={post.mediaUrl} liked={post.userLiked} onDoubleLike={onLike} />
      <EngagementBar post={post} onLike={onLike} onBookmark={onBookmark} onShare={onShare} />
    </article>
  );
});

function FeedPageWrapper() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const online = useOnline();
  const [active, setActive] = React.useState<Tab>('Dublin');
  const [pages, setPages] = React.useState<Post[][]>([]);
  const [cursor, setCursor] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [end, setEnd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      
      <PillTabs active={active} onChange={setActive} />
      <DiscoverBanner />
      
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
            if (!online) {
              await enqueue({ type: 'like', postId: p.id, userId });
              return;
            }
            updateOne(p.id, post => {
              const next = !post.userLiked;
              post.userLiked = next;
              post.stats.likes += next ? 1 : -1;
              return post;
            });
            await toggleLike(userId, p.id);
          }}
          onBookmark={async () => {
            if (!online) {
              await enqueue({ type: 'bookmark', postId: p.id, userId });
              return;
            }
            updateOne(p.id, post => ({ ...post, isBookmarked: !post.isBookmarked }));
            await toggleBookmark(userId, p.id);
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
            if (navigator.share) {
              try {
                await navigator.share({ url: window.location.href, title: 'Post', text: '' });
              } catch {}
            } else {
              await navigator.clipboard.writeText(window.location.href);
            }
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
          <div className="text-lg font-semibold mb-1">No posts yet</div>
          <div className="text-sm">Try another location or check back later.</div>
        </div>
      )}
      
      {end && flat.length > 0 && (
        <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">You're all caught up.</div>
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
(App as any).ClipPage = ClipPage;
export type {};
