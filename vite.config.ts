import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react-native-web'],
  },
})
