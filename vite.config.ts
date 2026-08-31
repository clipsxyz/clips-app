import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { noCache } from './vite-plugin-no-cache'
import { firebaseSwPlugin } from './vite-plugin-firebase-sw'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), noCache(), firebaseSwPlugin()],
  // Node packages that read process.env must not crash in the browser.
  define: {
    'process.env': {},
  },
  // Expose both Vite and Expo-style public env keys to the client bundle.
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  resolve: {
    // Prefer *.web.* so shared imports do not pull Metro-only files.
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.mjs', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      '@': resolve(__dirname, './src'),
      // Prevent Vite from processing React Native entry point
      './App': resolve(__dirname, './src/App.tsx'),
      '../App': resolve(__dirname, './src/App.tsx'),
      // Shared modules (Auth, stories rail, etc.) import `react-native`; serve the web build
      // or the browser hits Flow `import typeof` and renders a blank page.
      'react-native': 'react-native-web',
    },
  },
  // Explicitly exclude React Native files from being processed
  publicDir: 'public',
  root: '.',
  optimizeDeps: {
    force: true, // Force re-optimization
    include: [
      'firebase/app',
      'firebase/messaging',
      'react-native-web',
      '@react-native-async-storage/async-storage',
    ],
    // Exclude native-only packages (not aliased to web)
    exclude: [
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
        'react-native-vector-icons',
        'react-native-webrtc',
      ],
    },
  },
  // Exclude React Native files from being scanned
  server: {
    port: 5173,
    host: true, // Listen on 0.0.0.0 so phones on Wi-Fi can reach Vite
    allowedHosts: true,
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
    // Don't force HMR to localhost — that blanks/breaks phone tabs on the LAN IP.
    // Vite will use the page hostname (e.g. 192.168.1.12) when opened from Oppo.
    hmr: {
      protocol: 'ws',
      clientPort: 5173,
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
