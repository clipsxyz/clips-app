import { CommonActions } from '@react-navigation/native';
import { rootNavigationRef } from '../navigation/rootNavigationRef';

type Nav = {
    navigate?: (name: string, params?: Record<string, unknown>) => void;
    reset: (state: {
        index: number;
        routes: Array<{ name: string; params?: Record<string, unknown>; state?: unknown }>;
    }) => void;
};

function homeNavParams(params?: { forceRefreshAt?: number }): Record<string, unknown> {
    if (params && typeof params.forceRefreshAt === 'number') {
        return { screen: 'Home', params };
    }
    return { screen: 'Home' };
}

function resetState(params?: { forceRefreshAt?: number }) {
    const homeParams =
        params && typeof params.forceRefreshAt === 'number' ? params : undefined;
    return {
        index: 0,
        routes: [
            {
                name: 'MainTabs',
                state: {
                    index: 0,
                    routes: [{ name: 'Home', params: homeParams }],
                },
            },
        ],
    };
}

/** Land on the existing Home feed after posting. Prefer pop-to-MainTabs so the list does not remount. */
export function resetToHomeFeed(
    navigation: Nav,
    params?: { forceRefreshAt?: number },
): void {
    const navParams = homeNavParams(params);

    try {
        navigation.navigate?.('MainTabs', navParams);
        return;
    } catch (err) {
        console.warn('resetToHomeFeed: navigate failed, trying reset', err);
    }

    try {
        navigation.reset(resetState(params));
        return;
    } catch (err) {
        console.warn('resetToHomeFeed: screen reset failed, trying root ref', err);
    }

    if (!rootNavigationRef.isReady()) return;
    try {
        rootNavigationRef.navigate('MainTabs' as never, navParams as never);
        return;
    } catch {
        /* fall through */
    }
    rootNavigationRef.dispatch(CommonActions.reset(resetState(params)));
}
