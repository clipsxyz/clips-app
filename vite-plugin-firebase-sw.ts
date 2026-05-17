import { Plugin, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin to inject Firebase config into service worker
 */
export function firebaseSwPlugin(): Plugin {
  return {
    name: 'firebase-sw',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      const swPath = path.resolve(process.cwd(), 'public/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) {
        return;
      }

      let swContent = fs.readFileSync(swPath, 'utf-8');

      const firebaseConfig = {
        apiKey: env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
        projectId: env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
        appId: env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'YOUR_MEASUREMENT_ID',
      };

      swContent = swContent.replace('"YOUR_API_KEY"', JSON.stringify(firebaseConfig.apiKey));
      swContent = swContent.replace('"YOUR_AUTH_DOMAIN"', JSON.stringify(firebaseConfig.authDomain));
      swContent = swContent.replace('"YOUR_PROJECT_ID"', JSON.stringify(firebaseConfig.projectId));
      swContent = swContent.replace('"YOUR_STORAGE_BUCKET"', JSON.stringify(firebaseConfig.storageBucket));
      swContent = swContent.replace('"YOUR_MESSAGING_SENDER_ID"', JSON.stringify(firebaseConfig.messagingSenderId));
      swContent = swContent.replace('"YOUR_APP_ID"', JSON.stringify(firebaseConfig.appId));
      swContent = swContent.replace('"YOUR_MEASUREMENT_ID"', JSON.stringify(firebaseConfig.measurementId));

      fs.writeFileSync(swPath, swContent);
    },
  };
}
