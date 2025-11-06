/**
 * Web entry point (Vite)
 * Uses React Native Web for cross-platform compatibility
 */
import React from 'react';
import { AppRegistry } from 'react-native';
import '../global.css';
import './index.css';
import App from '../App';
import { initSentry } from './sentry';

// Initialize Sentry early
initSentry();

// Initialize Web Vitals in production
if (import.meta.env.PROD) {
  import('./utils/vitals').then(m => m.initVitals());
}

// Register app for web
AppRegistry.registerComponent('ClipsApp', () => App);

// Get the root component and render it
const { getApplication } = AppRegistry.getApplication('ClipsApp', {});
const root = document.getElementById('root');

if (root) {
  const { element } = getApplication();
  const ReactDOM = require('react-dom/client');
  ReactDOM.createRoot(root).render(
    React.createElement(React.StrictMode, null, element)
  );
}
