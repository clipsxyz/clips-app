/**
 * @format
 * React Native entry point (iOS/Android)
 * This file is NOT used by Vite/web builds - only for React Native
 */

import { AppRegistry } from 'react-native';
import './global.css';
import App from './App.native';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
