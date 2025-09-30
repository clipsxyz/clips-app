import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [name, setName] = React.useState('');
  
  function submit(e: React.FormEvent) {
    e.preventDefault();
    login(name);
    nav('/feed', { replace: true });
  }
  
  return (
    <div className="mx-auto max-w-md min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h1 className="text-lg font-semibold mb-3">Sign in</h1>
        <label className="block text-sm mb-1">Name</label>
        <input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 mb-3" 
          placeholder="Your name" 
        />
        <button className="w-full px-3 py-2 rounded bg-brand-600 text-white">Continue</button>
      </form>
    </div>
  );
}
