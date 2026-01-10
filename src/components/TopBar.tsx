import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiCompass, FiX, FiSearch, FiMapPin, FiMenu, FiHome, FiSend, FiPlay, FiMessageSquare } from 'react-icons/fi';
import Avatar from './Avatar';
import { getUnreadTotal } from '../api/messages';
import { useAuth } from '../context/Auth';
import { fetchFollowedUsersStoryGroups } from '../api/stories';
import { getFollowedUsers } from '../api/posts';

type TopBarProps = {
  activeTab?: string;
  onLocationChange?: (location: string) => void;
};

export default function TopBar({ activeTab, onLocationChange }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showDiscoverCard, setShowDiscoverCard] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hasInbox, setHasInbox] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [lastSender, setLastSender] = React.useState<string | null>(null);
  const [hasNewStories, setHasNewStories] = React.useState(false);
  const localBorderOverlayRef = React.useRef<HTMLDivElement>(null);

  // Check for new stories from followed users
  const checkNewStories = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const followedUserHandles = await getFollowedUsers(user.id);
      const storyGroups = await fetchFollowedUsersStoryGroups(user.id, followedUserHandles);
      
      // Check if any story group has unviewed stories
      const hasUnviewed = storyGroups.some(group => 
        group.stories.some(story => !story.hasViewed && story.expiresAt > Date.now())
      );
      setHasNewStories(hasUnviewed);
    } catch (error) {
      console.error('Error checking new stories:', error);
    }
  }, [user?.id]);

  React.useEffect(() => {
    checkNewStories();
    // Check periodically for new stories
    const interval = setInterval(checkNewStories, 30000); // Check every 30 seconds
    
    // Listen for story events to update immediately
    const handleStoryCreated = () => {
      checkNewStories();
    };
    const handleStoriesViewed = () => {
      checkNewStories();
    };
    
    window.addEventListener('storyCreated', handleStoryCreated);
    window.addEventListener('storiesViewed', handleStoriesViewed);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storyCreated', handleStoryCreated);
      window.removeEventListener('storiesViewed', handleStoriesViewed);
    };
  }, [checkNewStories]);

  // Listen for new messages/replies and unread count
  React.useEffect(() => {
    // Initialize unread on mount
    if (user?.handle) {
      getUnreadTotal(user.handle).then((n) => {
        setUnreadCount(n);
        setHasInbox(n > 0);
      }).catch(() => { });
    }
    function onConversationUpdated(e: any) {
      const msg = e.detail?.message;
      const participants: string[] = e.detail?.participants || [];
      if (!user?.handle) return;
      if (!participants.includes(user.handle)) return;
      if (msg?.senderHandle && msg.senderHandle !== user.handle) {
        setHasInbox(true);
        setLastSender(msg.senderHandle);
      }
    }
    function onUnreadChanged(e: any) {
      const handle = e.detail?.handle;
      const unread = e.detail?.unread ?? 0;
      if (handle !== user?.handle) return;
      setHasInbox(unread > 0);
      setUnreadCount(unread);
    }
    window.addEventListener('conversationUpdated', onConversationUpdated as any);
    window.addEventListener('inboxUnreadChanged', onUnreadChanged as any);
    return () => {
      window.removeEventListener('conversationUpdated', onConversationUpdated as any);
      window.removeEventListener('inboxUnreadChanged', onUnreadChanged as any);
    };
  }, [user?.handle]);

  const suggestedLocations = [
    { name: 'London', flag: '🇬🇧', posts: 12 },
    { name: 'New York', flag: '🇺🇸', posts: 8 },
    { name: 'Paris', flag: '🇫🇷', posts: 15 },
    { name: 'Tokyo', flag: '🇯🇵', posts: 6 },
    { name: 'Sydney', flag: '🇦🇺', posts: 9 },
    { name: 'Berlin', flag: '🇩🇪', posts: 11 }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onLocationChange?.(searchQuery.trim());
      // Dispatch custom event for FeedPageWrapper
      window.dispatchEvent(new CustomEvent('locationChange', {
        detail: { location: searchQuery.trim() }
      }));
      setShowDiscoverCard(false);
      setSearchQuery('');
    }
  };

  const handleLocationSelect = (location: string) => {
    onLocationChange?.(location);
    // Dispatch custom event for FeedPageWrapper
    window.dispatchEvent(new CustomEvent('locationChange', {
      detail: { location }
    }));
    setShowDiscoverCard(false);
  };

  const handleDiscoverClick = () => {
    // Navigate to feed with Following tab active
    navigate('/feed');
    // Dispatch event to set Following tab
    window.dispatchEvent(new CustomEvent('setFollowingTab'));
  };

  // Animate border reveal on mount for Local button
  React.useEffect(() => {
    if (!localBorderOverlayRef.current) return;
    
    const overlay = localBorderOverlayRef.current;
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const angle = progress * 360;
      
      // Create mask that reveals progressively going around
      const mask = `conic-gradient(from 0deg, transparent 0deg, transparent ${angle}deg, black ${angle}deg, black 360deg)`;
      overlay.style.maskImage = mask;
      overlay.style.webkitMaskImage = mask;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - make overlay fully transparent so border is fully visible
        overlay.style.maskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
        overlay.style.webkitMaskImage = 'conic-gradient(from 0deg, transparent 0deg, transparent 360deg)';
      }
    };
    
    // Start animation
    requestAnimationFrame(animate);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        {location.pathname.startsWith('/discover') ? (
          <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
            <button
              onClick={() => navigate('/feed')}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Back to Feed"
              title="Back to Feed"
            >
              <FiHome className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>


            <div className="flex items-center gap-2">
              {/* Local Button */}
              <button
                onClick={() => {
                  const local = user?.local || 'Finglas';
                  // Use the same mechanism as Discover page: set sessionStorage, dispatch event, and navigate with query param
                  try {
                    sessionStorage.setItem('pendingLocation', local);
                    window.dispatchEvent(new CustomEvent('locationChange', { detail: { location: local } }));
                  } catch { }
                  // Navigate to feed with query parameter (same as Discover page does for Paris, London, etc.)
                  navigate(`/feed?location=${encodeURIComponent(local)}`);
                }}
                className="relative px-3 py-1.5 text-xs font-medium transition-all active:scale-[.98] text-gray-300 hover:text-white"
                title={`View ${user?.local || 'Local'} feed`}
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
                    ref={localBorderOverlayRef}
                    className="absolute inset-0 bg-[#030712] rounded-lg"
                    style={{
                      maskImage: 'conic-gradient(from 0deg, black 360deg)',
                      WebkitMaskImage: 'conic-gradient(from 0deg, black 360deg)',
                    }}
                  />
                  <div className="w-full h-full rounded-lg bg-[#030712] relative z-10" />
                </div>
                {/* Content */}
                <span className="relative z-10">{user?.local || 'Local'}</span>
              </button>
              <Avatar src={user?.avatarUrl} name={(user?.handle || 'User').split('@')[0]} size="sm" />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
            <div className="flex items-center gap-2">
            </div>

          </div>
        )}
      </div>

      {/* Discover overlay removed in favor of dedicated page */}
    </>
  );
}