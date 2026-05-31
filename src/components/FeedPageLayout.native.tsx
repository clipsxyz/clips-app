/**
 * Feed page shell — mirrors web FeedPageWrapper + App `/feed` layout (src/App.tsx).
 *
 * Web source of truth:
 * - App shell: bg #030712, h-[100dvh], overflow-hidden, flex-col, bottom tab padding
 * - FeedPageWrapper: flex-col h-full min-h-0
 * - Pinned chrome (non-scrolling): safe-area + 16px spacer + offline + PillTabs + 16px + error
 * - Scroll region: flex-1 min-h-0 overflow-y-auto pb-2
 *
 * Note: Web main feed is flat #030712 — ambient canvas only appears inside cards (Stories 24, etc.),
 * not as a full-screen feed background.
 */

import React, { type ReactNode } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Web `main` / feed shell background (App.tsx style={{ backgroundColor: '#030712' }}). */
export const FEED_PAGE_BG = '#030712';

/** Web post card / article background (FeedCard style). */
export const FEED_CARD_BG = '#030712';

/** Web PillTabs container: `bg-black py-1`. */
export const FEED_PILL_TABS_BG = '#000000';

/** Web location pill: `bg-[#36454F]`. */
export const FEED_LOCATION_PILL_BG = '#36454F';

/** Web header title typography (PillTabs location label). */
export const FEED_HEADER_TITLE = {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 20,
    color: '#E5E7EB',
};

/** Web FeedCard article chrome (non-tile mode). */
export const FEED_POST_CARD_STYLE = {
    backgroundColor: FEED_CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55, 65, 81, 0.9)', // gray-700
    marginBottom: 8, // mb-2
    overflow: 'visible' as const,
};

export type FeedPageLayoutProps = {
    /** PillTabs row (Stories · location pill · Passport). */
    header: ReactNode;
    /** Scrollable feed body — pass a FlatList with style={{ flex: 1 }}. */
    children: ReactNode;
    online?: boolean;
    error?: string | null;
    onRetry?: () => void;
    style?: StyleProp<ViewStyle>;
};

export default function FeedPageLayout({
    header,
    children,
    online = true,
    error = null,
    onRetry,
    style,
}: FeedPageLayoutProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.root, style]}>
            {/* Pinned chrome — web: shrink-0 pt-[safe-area] (FeedPageWrapper) */}
            <View style={[styles.pinnedChrome, { paddingTop: insets.top }]}>
                <View style={styles.spacer16} />

                {!online ? (
                    <View style={styles.offlineBanner} accessibilityRole="alert">
                        <Text style={styles.offlineBannerText}>
                            You're offline. Actions will sync when back online.
                        </Text>
                    </View>
                ) : null}

                <View style={styles.pillTabsHost}>{header}</View>

                <View style={styles.spacer16} />

                {error ? (
                    <View style={styles.errorBanner} accessibilityRole="alert">
                        <Text style={styles.errorText} numberOfLines={4}>
                            {error}
                        </Text>
                        {onRetry ? (
                            <TouchableOpacity
                                style={styles.errorRetryBtn}
                                onPress={onRetry}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Retry loading feed"
                            >
                                <Text style={styles.errorRetryText}>Retry</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}
            </View>

            {/* Inner scroll host — web: flex-1 min-h-0 overflow-y-auto pb-2 */}
            <View style={styles.scrollHost}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
        overflow: 'hidden',
    },
    pinnedChrome: {
        flexShrink: 0,
        zIndex: 140,
        backgroundColor: FEED_PAGE_BG,
        ...Platform.select({
            android: { elevation: 0 },
            ios: {},
        }),
    },
    spacer16: {
        height: 16, // web h-4
    },
    pillTabsHost: {
        backgroundColor: FEED_PILL_TABS_BG,
        paddingVertical: 4, // web py-1
    },
    scrollHost: {
        flex: 1,
        minHeight: 0,
        paddingBottom: 8, // web pb-2
        backgroundColor: FEED_PAGE_BG,
    },
    offlineBanner: {
        marginHorizontal: 12, // mx-3
        marginTop: 8, // mt-2
        borderRadius: 6, // rounded-md
        borderWidth: 1,
        borderColor: '#FDE68A', // amber-200 dark: amber-800 approx
        backgroundColor: '#FFFBEB', // amber-50 — readable on dark via text color
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    offlineBannerText: {
        fontSize: 12, // text-xs
        color: '#78350F', // amber-900
    },
    errorBanner: {
        marginHorizontal: 16, // mx-4
        marginVertical: 12, // my-3
        padding: 12, // p-3
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5', // red-300
        backgroundColor: '#FEF2F2', // red-50
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 14, // text-sm
        color: '#991B1B', // red-800
    },
    errorRetryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#DC2626', // red-600
    },
    errorRetryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
