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

            <button
              onClick={() => navigate('/feed')}
              className="font-light text-lg tracking-tight flex items-center gap-1.5"
              aria-label="Go to Home Feed"
              title="Gazetteer"
              style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              <FiMapPin className="w-4 h-4 text-gray-700 dark:text-gray-200" />
              <span
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
                Gazetteer
              </span>
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
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-[.98] border-2 border-dashed border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                title={`View ${user?.local || 'Local'} feed`}
              >
                {user?.local || 'Local'}
              </button>
              <Avatar src={user?.avatarUrl} name={(user?.handle || 'User').split('@')[0]} size="sm" />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/feed')}
                className="font-light text-lg tracking-tight flex items-center gap-1.5"
                aria-label="Go to Home Feed"
                title="Gazetteer"
                style={{ 
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <FiMapPin className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                <span
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
                  Gazetteer
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Messages Icon */}
              <button
                onClick={() => navigate('/inbox')}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Open messages"
                title={hasInbox ? 'New messages' : 'Messages'}
              >
                <div className={`relative w-6 h-6 ${hasInbox ? '' : ''}`}>
                  <FiMessageSquare className={`relative w-6 h-6 ${hasInbox ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`} />
                  {hasInbox && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[10px] leading-4 rounded-full text-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discover overlay removed in favor of dedicated page */}
    </>
  );
}