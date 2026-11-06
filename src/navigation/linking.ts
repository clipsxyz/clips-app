import { getNativeShareNavState, nativeShareLinkingPrefixes } from './shareLinking.native';

export const BOOST_STATUS_REFRESH_EVENT = 'boostStatusRefresh';

const BOOST_PREFIXES = ['gazetteer://', 'https://gazetteer.com'];

function splitLinkPath(path: string): { pathname: string; query: URLSearchParams } {
    const raw = path.replace(/^\//, '');
    const cut = raw.indexOf('?');
    const pathname = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\/$/, '');
    const query = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
    return { pathname, query };
}

function isBoostSuccessLink(url: string): boolean {
    return /boost\/success(?:[/?#]|$)/.test(url);
}

/** Same checkout return, whether it arrives as gazetteer:// or an Android intent URL. */
function boostSuccessKey(url: string): string | null {
    if (!isBoostSuccessLink(url)) return null;
    return `boost/success:${sessionIdFromLink(url) ?? ''}`;
}

let lastProcessedUrl: string | null = null;
let lastProcessedSuccessKey: string | null = null;

export function wasDeepLinkProcessed(url: string | null | undefined): boolean {
    if (!url) return true;
    if (url === lastProcessedUrl) return true;
    const key = boostSuccessKey(url);
    return !!key && key === lastProcessedSuccessKey;
}

function openBoostAfterPayment(sessionId?: string): void {
    const { rootNavigationRef } = require('./rootNavigationRef') as typeof import('./rootNavigationRef');
    const params = {
        initialAction: 'success',
        ...(sessionId ? { session_id: sessionId } : {}),
    };
    const go = () => {
        if (!rootNavigationRef.isReady()) return false;
        rootNavigationRef.navigate('MainTabs' as never, {
            screen: 'Boost',
            params: { screen: 'BoostMain', params },
        } as never);
        return true;
    };
    if (go()) return;
    const started = Date.now();
    const timer = setInterval(() => {
        if (go() || Date.now() - started > 3000) clearInterval(timer);
    }, 50);
}

/** Handle one incoming URL. Boost success is consumed so resume events cannot stack another screen. */
export function handleIncomingDeepLink(url: string | null | undefined): 'boost-success' | 'duplicate' | 'passthrough' {
    if (!url || url === lastProcessedUrl) return 'duplicate';
    const successKey = boostSuccessKey(url);
    if (successKey && successKey === lastProcessedSuccessKey) {
        lastProcessedUrl = url;
        return 'duplicate';
    }
    lastProcessedUrl = url;
    if (!successKey) return 'passthrough';
    lastProcessedSuccessKey = successKey;
    void import('../utils/stripeCheckoutNative').then((mod) => mod.dismissCheckoutBrowser());
    openBoostAfterPayment(sessionIdFromLink(url));
    return 'boost-success';
}

function sessionIdFromLink(url: string): string | undefined {
    const match = url.match(/[?&]session_id=([^&#]+)/);
    if (!match?.[1]) return undefined;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function screenState(name: string, params?: Record<string, string>) {
    return {
        routes: [params ? { name, params } : { name }],
    };
}

function boostReturnState(name: 'BoostSuccess' | 'BoostCancel', params?: Record<string, string>) {
    return {
        index: 1,
        routes: [
            { name: 'MainTabs' },
            params ? { name, params } : { name },
        ],
    };
}

/** Cold start from gazetteer://boost/success opens the Boost tab with the confirmation on top. */
function boostTabState(params?: Record<string, string>) {
    return {
        index: 0,
        routes: [
            {
                name: 'MainTabs',
                state: {
                    index: 1,
                    routes: [
                        { name: 'Home' },
                        {
                            name: 'Boost',
                            state: {
                                index: 0,
                                routes: [
                                    {
                                        name: 'BoostMain',
                                        params: params
                                            ? { initialAction: 'success', ...params }
                                            : { initialAction: 'success' },
                                    },
                                ],
                            },
                        },
                        { name: 'Create' },
                        { name: 'Search' },
                        { name: 'Inbox' },
                    ],
                },
            },
        ],
    };
}

/**
 * Deep links for boost checkout callbacks, posts, and stories.
 * Share-token and story-query links stay on the public viewer screens.
 */
export const linking = {
    prefixes: Array.from(new Set([...BOOST_PREFIXES, ...nativeShareLinkingPrefixes()])),
    config: {
        initialRouteName: 'MainTabs',
        screens: {
            MainTabs: {
                initialRouteName: 'Home',
                screens: {
                    Boost: {
                        initialRouteName: 'BoostMain',
                        screens: {
                            BoostMain: 'boost',
                            BoostSuccess: {
                                path: 'boost/success',
                                parse: {
                                    session_id: (sessionId: string) => sessionId,
                                },
                            },
                            BoostCancel: 'boost/cancel',
                        },
                    },
                },
            },
            PostDetail: 'post/:postId',
            StoryViewer: 'story/:storyId',
        },
    },
    async getInitialURL() {
        const Linking = require('react-native').Linking as {
            getInitialURL: () => Promise<string | null>;
        };
        const url = await Linking.getInitialURL();
        if (url && isBoostSuccessLink(url)) {
            lastProcessedUrl = url;
            lastProcessedSuccessKey = boostSuccessKey(url);
        }
        return url;
    },
    getStateFromPath(path: string) {
        const { pathname, query } = splitLinkPath(path);
        if (pathname.startsWith('p/') || pathname === 'stories' || pathname.startsWith('stories/')) {
            return getNativeShareNavState(path);
        }
        const normalized = pathname.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
        if (normalized === 'boost/success') {
            const sessionId = query.get('session_id') || '';
            return boostTabState(sessionId ? { session_id: sessionId } : undefined);
        }
        if (pathname === 'boost/cancel') {
            return boostReturnState('BoostCancel');
        }
        const post = pathname.match(/^post\/([^/]+)$/);
        if (post?.[1]) {
            return screenState('PostDetail', { postId: decodeURIComponent(post[1]) });
        }
        const story = pathname.match(/^story\/([^/]+)$/);
        if (story?.[1]) {
            return screenState('StoryViewer', { storyId: decodeURIComponent(story[1]) });
        }
        return undefined;
    },
    subscribe(listener: (url: string) => void) {
        const Linking = require('react-native').Linking as {
            addEventListener: (
                type: 'url',
                handler: (event: { url: string }) => void,
            ) => { remove: () => void };
        };
        const onUrl = ({ url }: { url: string }) => {
            if (!url || url === lastProcessedUrl) return;
            if (url.includes('://boost/') || url.includes('/boost/')) {
                void import('../utils/stripeCheckoutNative').then((mod) => mod.dismissCheckoutBrowser());
            }
            if (isBoostSuccessLink(url)) {
                handleIncomingDeepLink(url);
                return;
            }
            lastProcessedUrl = url;
            listener(url);
        };
        const subscription = Linking.addEventListener('url', onUrl);
        return () => subscription.remove();
    },
};
