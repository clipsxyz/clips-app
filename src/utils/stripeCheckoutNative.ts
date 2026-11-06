import { Linking } from 'react-native';

const APP_SUCCESS_URL = 'gazetteer://boost/success';
const WEB_SUCCESS_URL = 'https://gazetteer.com/boost/success';
const APP_CANCEL_URL = 'gazetteer://boost/cancel';
const WEB_CANCEL_URL = 'https://gazetteer.com/boost/cancel';

function isBoostReturnPath(url: string, path: 'success' | 'cancel'): boolean {
    try {
        const parsed = new URL(url);
        return parsed.pathname === `/boost/${path}` || parsed.pathname.startsWith(`/boost/${path}/`);
    } catch {
        return false;
    }
}

export function isBoostSuccessUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.startsWith(APP_SUCCESS_URL) || url.startsWith(WEB_SUCCESS_URL) || isBoostReturnPath(url, 'success');
}

export function sessionIdFromBoostUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    const match = url.match(/[?&]session_id=([^&#]+)/);
    if (!match?.[1]) return undefined;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

export async function dismissCheckoutBrowser(): Promise<void> {
    try {
        const mod = await import('react-native-inappbrowser-reborn');
        const browser = (mod as { default?: { close?: () => void } }).default
            ?? (mod as { InAppBrowser?: { close?: () => void } }).InAppBrowser;
        browser?.close?.();
    } catch {
        /* Checkout browser is already closed, or the native module is not linked. */
    }
}

export function isBoostCancelUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return url.startsWith(APP_CANCEL_URL) || url.startsWith(WEB_CANCEL_URL) || isBoostReturnPath(url, 'cancel');
}

type BrowserResult = { type?: string; url?: string };
type InAppBrowserApi = {
    isAvailable: () => Promise<boolean>;
    openAuth: (url: string, redirectUrl: string, options?: object) => Promise<BrowserResult>;
    close: () => void;
};

async function loadInAppBrowser(): Promise<InAppBrowserApi | null> {
    try {
        const mod = await import('react-native-inappbrowser-reborn');
        const browser = (mod as { default?: InAppBrowserApi }).default
            ?? (mod as { InAppBrowser?: InAppBrowserApi }).InAppBrowser;
        if (!browser || typeof browser.isAvailable !== 'function') return null;
        if (!(await browser.isAvailable())) return null;
        return browser;
    } catch (error) {
        console.warn('[boost] InAppBrowser unavailable:', error);
        return null;
    }
}

/**
 * Open Stripe Checkout. The browser closes on the Stripe success page or
 * gazetteer://boost/success, then the caller can show the confirmation.
 */
export type StripeCheckoutResult = {
    outcome: 'success' | 'cancel' | 'dismiss';
    sessionId?: string;
};

export async function openStripeCheckout(url: string): Promise<StripeCheckoutResult> {
    const browser = await loadInAppBrowser();
    if (!browser) {
        await Linking.openURL(url);
        return { outcome: 'dismiss' };
    }

    const redirectUrl = APP_SUCCESS_URL;

    return await new Promise((resolve) => {
        let settled = false;
        const finish = (outcome: StripeCheckoutResult['outcome'], callbackUrl?: string) => {
            if (settled) return;
            settled = true;
            subscription.remove();
            resolve({
                outcome,
                sessionId: outcome === 'success' ? sessionIdFromBoostUrl(callbackUrl) : undefined,
            });
        };
        const subscription = Linking.addEventListener('url', ({ url: next }) => {
            if (isBoostCancelUrl(next)) {
                try {
                    browser.close();
                } catch {
                    /* browser may already be closed */
                }
                finish('cancel', next);
                return;
            }
            if (!isBoostSuccessUrl(next)) return;
            try {
                browser.close();
            } catch {
                /* browser may already be closed */
            }
            finish('success', next);
        });

        void browser.openAuth(url, redirectUrl, {
            ephemeralWebSession: false,
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
        }).then((result) => {
            if (isBoostCancelUrl(result?.url)) {
                finish('cancel', result?.url);
                return;
            }
            if (isBoostSuccessUrl(result?.url) || result?.type === 'success') {
                finish('success', result?.url);
                return;
            }
            if (result?.type === 'cancel') {
                finish('cancel', result?.url);
                return;
            }
            finish('dismiss');
        }).catch((error) => {
            console.warn('[boost] checkout browser failed:', error);
            finish('dismiss');
        });
    });
}
