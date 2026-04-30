type FacebookLoginResult = {
  accessToken: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { accessToken?: string } }) => void,
        options?: { scope?: string; return_scopes?: boolean }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      const interval = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(interval);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(interval);
        if (!window.FB) reject(new Error('Facebook SDK failed to initialize.'));
      }, 5000);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v20.0',
      });
      resolve();
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('Could not load Facebook SDK.'));
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

export async function loginWithFacebookWeb(): Promise<FacebookLoginResult> {
  const appId = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;
  if (!appId) throw new Error('Missing VITE_FACEBOOK_APP_ID for Facebook login.');

  await loadFacebookSdk(appId);
  return new Promise((resolve, reject) => {
    window.FB?.login(
      (response) => {
        const token = response?.authResponse?.accessToken;
        if (!token) {
          reject(new Error('Facebook login cancelled or no token returned.'));
          return;
        }
        resolve({ accessToken: token });
      },
      { scope: 'public_profile,user_friends', return_scopes: true }
    );
  });
}

