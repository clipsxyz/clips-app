import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    release: import.meta.env.VITE_RELEASE_VERSION as string | undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration()
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE
  });
}

