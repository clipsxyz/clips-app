import { CommonActions } from '@react-navigation/native';
import { rootNavigationRef } from '../navigation/rootNavigationRef';

type Nav = {
    reset: (state: {
        index: number;
        routes: Array<{ name: string; params?: Record<string, unknown>; state?: unknown }>;
    }) => void;
};

/** Clear create stack and land on Home feed after posting (Story24 / gallery parity). */
export function resetToHomeFeed(
    navigation: Nav,
    params?: { forceRefreshAt?: number },
): void {
    const homeParams = params ?? { forceRefreshAt: Date.now() };
    const resetState = {
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

    try {
        navigation.reset(resetState);
        return;
    } catch (err) {
        console.warn('resetToHomeFeed: screen reset failed, trying root ref', err);
    }

    if (rootNavigationRef.isReady()) {
        rootNavigationRef.dispatch(CommonActions.reset(resetState));
    }
}
