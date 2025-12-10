import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { noCache } from './vite-plugin-no-cache'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), noCache()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Prevent Vite from processing React Native entry point
      './App': resolve(__dirname, './src/App.tsx'),
      '../App': resolve(__dirname, './src/App.tsx'),
    },
  },
  // Explicitly exclude React Native files from being processed
  publicDir: 'public',
  root: '.',
  optimizeDeps: {
    force: true, // Force re-optimization
    // Exclude React Native dependencies from optimization (not needed for web)
    exclude: [
      'react-native',
      'react-native-web',
      'react-native-vector-icons',
      'react-native-webrtc',
      'react-native-safe-area-context',
      'react-native-screens',
      'react-native-gesture-handler',
      'react-native-reanimated',
      '@react-navigation/native',
      '@react-navigation/native-stack',
      '@react-navigation/bottom-tabs',
    ],
  },
  // Ignore React Native dependencies in build
  build: {
    commonjsOptions: {
      ignore: [
        'react-native',
        'react-native-web',
        'react-native-vector-icons',
        'react-native-webrtc',
      ],
    },
  },
  // Exclude React Native files from being scanned
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: false,
    fs: {
      allow: ['.', './src', './public'],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
    },
  },
})
