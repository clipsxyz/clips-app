/**
 * Web entry point (Vite)
 * Using React Router for now - React Native migration in progress
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './components/Root';
import { initSentry } from './sentry';
import './index.css';

// Initialize Sentry early
initSentry();

// Initialize Web Vitals in production
if (import.meta.env.PROD) {
  import('./utils/vitals').then(m => m.initVitals());
}

// StrictMode disabled: it double-invokes components in dev, which can trigger
// "Rendered more hooks than during the previous render" when auth/user loads
// asynchronously and a component conditionally returns before all hooks run.
ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
