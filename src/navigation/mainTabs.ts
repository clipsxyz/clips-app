export type MainTabName = 'Home' | 'Discover' | 'Create' | 'Search' | 'Inbox';

/** Navigate to a primary tab from stack or nested tab screens. */
export function navigateMainTab(
    navigation: { navigate: (name: string, params?: object) => void },
    screen: MainTabName,
    params?: Record<string, unknown>,
) {
    navigation.navigate('MainTabs', { screen, params });
}
