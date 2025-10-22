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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
