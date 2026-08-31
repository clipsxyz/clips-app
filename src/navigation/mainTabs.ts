export type MainTabName = 'Home' | 'Boost' | 'Create' | 'Search' | 'Inbox';

/** Navigate to a primary tab from stack or nested tab screens. */
export function navigateMainTab(
    navigation: { navigate: (name: string, params?: object) => void },
    screen: MainTabName,
    params?: Record<string, unknown>,
) {
    navigation.navigate('MainTabs', { screen, params });
}

/** Open own Passport with bottom tab bar visible (web /profile parity). */
export function navigatePassport(
    navigation: { navigate: (name: string, params?: object) => void },
    fromTab: MainTabName = 'Home',
) {
    navigation.navigate('MainTabs', {
        screen: fromTab,
        params: { screen: 'Profile' },
    });
}
