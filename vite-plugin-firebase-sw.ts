import { Plugin, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

const PLACEHOLDERS = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',
} as const;

/**
 * Injects Firebase config from .env into the service worker at dev/build time.
 * Only the template is committed; public/firebase-messaging-sw.js is gitignored.
 */
export function firebaseSwPlugin(): Plugin {
  const templatePath = path.resolve(process.cwd(), 'public/firebase-messaging-sw.template.js');
  const swPath = path.resolve(process.cwd(), 'public/firebase-messaging-sw.js');

  function writeServiceWorker(mode: string) {
    if (!fs.existsSync(templatePath)) {
      console.warn('[firebase-sw] Missing public/firebase-messaging-sw.template.js');
      return;
    }

    const env = loadEnv(mode, process.cwd(), '');
    let swContent = fs.readFileSync(templatePath, 'utf-8');

    const values = {
      apiKey: env.VITE_FIREBASE_API_KEY || PLACEHOLDERS.apiKey,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || PLACEHOLDERS.authDomain,
      projectId: env.VITE_FIREBASE_PROJECT_ID || PLACEHOLDERS.projectId,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || PLACEHOLDERS.storageBucket,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || PLACEHOLDERS.messagingSenderId,
      appId: env.VITE_FIREBASE_APP_ID || PLACEHOLDERS.appId,
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || PLACEHOLDERS.measurementId,
    };

    for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
      const value = values[key as keyof typeof values];
      swContent = swContent.replace(JSON.stringify(placeholder), JSON.stringify(value));
    }

    fs.writeFileSync(swPath, swContent);
  }

  return {
    name: 'firebase-sw',
    config(_, { mode }) {
      writeServiceWorker(mode);
    },
  };
}
