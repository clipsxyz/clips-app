import React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function TopBar() {
  const { theme, toggle } = useTheme();
  
  return (
    <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
        <span className="font-semibold">Feed</span>
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
  );
}
