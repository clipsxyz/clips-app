import React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { FiSun, FiMoon, FiCompass, FiX, FiSearch } from 'react-icons/fi';

type TopBarProps = {
  activeTab?: string;
  onLocationChange?: (location: string) => void;
};

export default function TopBar({ activeTab, onLocationChange }: TopBarProps) {
  const { theme, toggle } = useTheme();
  const [showDiscoverCard, setShowDiscoverCard] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

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
    setShowDiscoverCard(true);
  };

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-brand-600 dark:text-brand-400">Gazetteer</span>

            <button
              onClick={handleDiscoverClick}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Discover new locations"
            >
              <div className="relative">
                <FiCompass className="w-4 h-4 text-brand-500 animate-pulse" />
                <div className="absolute inset-0 w-4 h-4 border-2 border-brand-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Discover
              </span>
            </button>
          </div>

          <button
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggle}
            className="p-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
        </div>
      </div>

      {/* Discover Card Overlay */}
      {showDiscoverCard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowDiscoverCard(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-700 p-6 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Discover Locations</h2>
              <button
                onClick={() => setShowDiscoverCard(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for any location..."
                  className="w-full pl-10 pr-4 py-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus
                />
              </div>
            </form>

            {/* Suggested Locations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Popular Locations</h3>
              <div className="grid grid-cols-2 gap-3">
                {suggestedLocations.map((location) => (
                  <button
                    key={location.name}
                    onClick={() => handleLocationSelect(location.name)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <span className="text-2xl">{location.flag}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{location.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{location.posts} posts</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}