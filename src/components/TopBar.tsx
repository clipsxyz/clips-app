import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiCompass, FiX, FiSearch, FiMapPin, FiMenu, FiHome, FiHeart } from 'react-icons/fi';
import Avatar from './Avatar';
import { getUnreadTotal } from '../api/messages';
import { useAuth } from '../context/Auth';

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
    navigate('/discover');
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
              className="font-bold text-lg bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 bg-clip-text text-transparent"
              aria-label="Go to Home Feed"
              title="Gazetteer"
            >
              Gazetteer
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
                className="font-bold text-lg bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 bg-clip-text text-transparent"
                aria-label="Go to Home Feed"
                title="Gazetteer"
              >
                Gazetteer
              </button>

              <button
                onClick={handleDiscoverClick}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Discover new locations"
              >
                <div className="relative w-6 h-6">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-75 blur-sm animate-pulse"></div>
                  <div className="absolute inset-[1px] rounded-md bg-gray-950 dark:bg-gray-950">
                    <div className="absolute inset-0 rounded-md" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s linear infinite',
                    }}></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <FiCompass className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Discover
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/stories')}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="View Stories"
                title="Stories"
              >
                <div className="relative w-6 h-6">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 opacity-75 blur-sm animate-pulse"></div>
                  <div className="absolute inset-[1px] rounded-md bg-gray-950 dark:bg-gray-950">
                    <div className="absolute inset-0 rounded-md" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s linear infinite',
                    }}></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <FiMapPin className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Clips
                </span>
              </button>

              {/* Notifications Heart Icon */}
              <button
                onClick={() => navigate('/inbox')}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Open notifications"
                title={hasInbox ? 'New notifications' : 'Notifications'}
              >
                <div className={`relative w-6 h-6 ${hasInbox ? '' : ''}`}>
                  {hasInbox && (
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-green-500 via-blue-500 to-blue-600 opacity-80 blur-sm animate-pulse"></div>
                  )}
                  <FiHeart className={`relative w-6 h-6 ${hasInbox ? 'text-pink-500 animate-[pulseGlow_2s_ease-in-out_infinite]' : 'text-gray-600 dark:text-gray-300'}`} />
                  {hasInbox && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-pink-500 text-white text-[10px] leading-4 rounded-full text-center">
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