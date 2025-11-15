import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiCompass, FiX, FiSearch, FiMapPin, FiMenu, FiHome, FiSend, FiPlay } from 'react-icons/fi';
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
              className="font-light text-lg tracking-tight"
              aria-label="Go to Home Feed"
              title="Gazetteer"
              style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
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

            <div className="flex items-center">
              <Avatar src={user?.avatarUrl} name={(user?.handle || 'User').split('@')[0]} size="sm" />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/feed')}
                className="font-light text-lg tracking-tight"
                aria-label="Go to Home Feed"
                title="Gazetteer"
                style={{ 
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
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

              <button
                onClick={() => navigate('/stories')}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 relative overflow-hidden"
                aria-label="View Stories"
                title="Stories"
                style={{
                  outline: 'none',
                  boxShadow: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Shimmer border effect */}
                <div 
                  className="absolute inset-0 rounded pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s linear infinite',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    margin: '-1px'
                  }}
                />
                <div className="relative w-4 h-4 z-10">
                  {/* Gradient border ring when there are new stories (Gazetteer-style) */}
                  {hasNewStories ? (
                    <div className="absolute -inset-0.5 rounded p-[2px]" style={{
                      background: 'linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%)',
                    }}>
                      <div className="w-full h-full rounded bg-white dark:bg-gray-950 flex items-center justify-center relative overflow-hidden">
                        <FiPlay className="w-2.5 h-2.5 text-gray-900 dark:text-gray-100 relative z-10" />
                        <div 
                          className="absolute inset-0 rounded"
                          style={{
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 3s linear infinite',
                            mixBlendMode: 'overlay',
                            pointerEvents: 'none',
                            zIndex: 11
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Play button with gray border when no new stories */
                    <div className="w-4 h-4 rounded overflow-hidden ring-2 ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-950 flex items-center justify-center relative">
                      <FiPlay className="w-2.5 h-2.5 text-gray-900 dark:text-gray-100 relative z-10" />
                      <div 
                        className="absolute inset-0 rounded"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 3s linear infinite',
                          mixBlendMode: 'overlay',
                          pointerEvents: 'none',
                          zIndex: 11
                        }}
                      />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium relative z-10">
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
                    Clips 24
                  </span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscoverClick}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative overflow-hidden"
                aria-label="View Following feed"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {/* Shimmer border effect */}
                <div 
                  className="absolute inset-0 rounded pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s linear infinite',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    margin: '-1px'
                  }}
                />
                <div className="relative w-4 h-4 z-10">
                  <div className="absolute inset-0 rounded bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-75 blur-sm animate-pulse"></div>
                  <div className="absolute inset-[1px] rounded bg-gray-950 dark:bg-gray-950">
                    <div className="absolute inset-0 rounded" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s linear infinite',
                    }}></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <FiCompass className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium relative z-10">
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
                    Following
                  </span>
                </span>
              </button>

              {/* Notifications Paper Airplane Icon */}
              <button
                onClick={() => navigate('/inbox')}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Open notifications"
                title={hasInbox ? 'New notifications' : 'Notifications'}
              >
                <div className={`relative w-6 h-6 ${hasInbox ? '' : ''}`}>
                  <FiSend className={`relative w-6 h-6 ${hasInbox ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'}`} />
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