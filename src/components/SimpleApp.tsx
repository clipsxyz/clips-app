import React from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../theme/ThemeProvider';

export function SimpleTopBar() {
    const { theme, toggle } = useTheme();

    return (
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
            <div className="mx-auto max-w-md px-4 h-11 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-brand-600 dark:text-brand-400">Gazetteer</span>
                </div>
                <button
                    onClick={toggle}
                    className="p-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </div>
        </div>
    );
}

export function SimpleApp() {
    return (
        <main className="mx-auto max-w-md min-h-screen pb-16">
            <SimpleTopBar />
            <div className="p-6 text-blue-600 dark:text-blue-400">Simple App component with ThemeProvider works!</div>
            <Outlet />
        </main>
    );
}
