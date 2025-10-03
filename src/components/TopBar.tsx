import React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { FiSun, FiMoon, FiBell, FiSearch, FiMenu, FiActivity } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { IconButton } from './ui/Button';
import { cn } from '../utils/cn';
import { useHealthCheck } from '../hooks/useHealthCheck';

export default function TopBar() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { healthStatus, alerts } = useHealthCheck();
  
  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/feed')) return 'Feed';
    if (path.startsWith('/messages')) return 'Messages';
    if (path.startsWith('/clip')) return 'Create';
    if (path.startsWith('/live')) return 'Live';
    if (path.startsWith('/groups')) return 'Groups';
    if (path.startsWith('/profile')) return 'Profile';
    if (path.startsWith('/health')) return 'System Health';
    return 'Gossapp';
  };

  const isHomePage = location.pathname === '/feed' || location.pathname === '/';
  
  return (
    <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 pt-safe">
      <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {isHomePage ? (
            <Logo size="sm" className="animate-fade-in" />
          ) : (
            <div className="flex items-center gap-3">
              <IconButton 
                variant="ghost" 
                size="sm"
                className="hover-scale"
                onClick={() => window.history.back()}
              >
                <FiMenu size={18} />
              </IconButton>
              <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100 animate-fade-in-left">
                {getPageTitle()}
              </h1>
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Health Status Button */}
          <IconButton 
            variant="ghost" 
            size="sm"
            className={cn(
              "hover-scale relative",
              healthStatus?.status === 'unhealthy' && "text-red-500",
              healthStatus?.status === 'degraded' && "text-yellow-500",
              healthStatus?.status === 'healthy' && "text-green-500"
            )}
            aria-label="System Health"
            onClick={() => navigate('/health')}
            title={`System Health: ${healthStatus?.status || 'Unknown'}`}
          >
            <FiActivity size={18} />
            {alerts.filter(alert => !alert.resolved && (alert.level === 'critical' || alert.level === 'error')).length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            )}
          </IconButton>

          {/* Search Button */}
          <IconButton 
            variant="ghost" 
            size="sm"
            className="hover-scale relative"
            aria-label="Search"
          >
            <FiSearch size={18} />
          </IconButton>

          {/* Notifications Button */}
          <IconButton 
            variant="ghost" 
            size="sm"
            className="hover-scale relative"
            aria-label="Notifications"
          >
            <FiBell size={18} />
            {/* Notification Badge */}
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </IconButton>

          {/* Theme Toggle */}
          <IconButton
            variant="ghost"
            size="sm"
            className={cn(
              'hover-scale transition-all duration-300',
              theme === 'dark' ? 'hover-glow' : ''
            )}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggle}
          >
            <div className="relative">
              {theme === 'dark' ? (
                <FiSun size={18} className="animate-fade-in text-yellow-500" />
              ) : (
                <FiMoon size={18} className="animate-fade-in text-indigo-600" />
              )}
            </div>
          </IconButton>
        </div>
      </div>

      {/* Gradient Border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
    </div>
  );
}