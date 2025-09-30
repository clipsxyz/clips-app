import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return (
      <div className="p-6">
        <p className="mb-3">You're signed out.</p>
        <button 
          onClick={() => nav('/login')} 
          className="px-3 py-2 rounded bg-brand-600 text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-semibold">
          {user.name.slice(0,1).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold text-lg">{user.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300">@{user.id}</div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="font-semibold mb-2">Account</h3>
        <button
          onClick={() => { logout(); nav('/login', { replace: true }); }}
          className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition-transform active:scale-[.98]"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
