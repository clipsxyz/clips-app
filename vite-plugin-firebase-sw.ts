import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin to inject Firebase config into service worker
 */
export function firebaseSwPlugin(): Plugin {
  return {
    name: 'firebase-sw',
    buildStart() {
      // Read the service worker template
      const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
      if (!fs.existsSync(swPath)) {
        return;
      }

      let swContent = fs.readFileSync(swPath, 'utf-8');

      // Replace placeholders with environment variables
      const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
        appId: process.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
        measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'YOUR_MEASUREMENT_ID',
      };

      // Replace placeholders
      swContent = swContent.replace('"YOUR_API_KEY"', JSON.stringify(firebaseConfig.apiKey));
      swContent = swContent.replace('"YOUR_AUTH_DOMAIN"', JSON.stringify(firebaseConfig.authDomain));
      swContent = swContent.replace('"YOUR_PROJECT_ID"', JSON.stringify(firebaseConfig.projectId));
      swContent = swContent.replace('"YOUR_STORAGE_BUCKET"', JSON.stringify(firebaseConfig.storageBucket));
      swContent = swContent.replace('"YOUR_MESSAGING_SENDER_ID"', JSON.stringify(firebaseConfig.messagingSenderId));
      swContent = swContent.replace('"YOUR_APP_ID"', JSON.stringify(firebaseConfig.appId));
      swContent = swContent.replace('"YOUR_MEASUREMENT_ID"', JSON.stringify(firebaseConfig.measurementId));

      // Write the updated service worker
      fs.writeFileSync(swPath, swContent);
    },
  };
}
