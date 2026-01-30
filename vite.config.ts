import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { noCache } from './vite-plugin-no-cache'
import { firebaseSwPlugin } from './vite-plugin-firebase-sw'
// import basicSsl from '@vitejs/plugin-basic-ssl' // Temporarily disabled to test if HTTPS is causing issues

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), noCache(), firebaseSwPlugin()], // Removed basicSsl() - using HTTP instead of HTTPS
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
    include: ['firebase/app', 'firebase/messaging'],
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
    host: '0.0.0.0', // Allow external connections (accessible from other devices on network)
    strictPort: false,
    fs: {
      allow: ['.', './src', './public'],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': '', // Disable ETag caching
    },
    hmr: {
      protocol: 'ws', // Using regular WebSocket (HTTP) instead of wss (HTTPS)
      // Use browser host (e.g. localhost) instead of 0.0.0.0 to avoid HMR websocket failures
      host: 'localhost',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
