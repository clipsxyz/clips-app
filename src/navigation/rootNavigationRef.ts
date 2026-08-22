import { createNavigationContainerRef } from '@react-navigation/native';

/** Root stack navigator — use for reset/navigate from modals (gallery post, story24, etc.). */
export const rootNavigationRef = createNavigationContainerRef();

export function resetRootToScreen(
    name: 'Login' | 'Landing' | 'MainTabs',
    params?: Record<string, unknown>,
): void {
    if (!rootNavigationRef.isReady()) return;
    rootNavigationRef.reset({
        index: 0,
        routes: [params ? { name, params } : { name }],
    });
}
