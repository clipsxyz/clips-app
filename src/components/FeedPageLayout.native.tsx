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

/** Media column + loading frame (black letterbox). */
export const FEED_CARD_MEDIA_BG = '#000000';

/** Web post card bottom divider (dark:border-gray-700). */
export const FEED_CARD_BORDER_COLOR = 'rgba(55, 65, 81, 0.9)';

/** Web FeedCard article chrome (non-tile mode). */
export const FEED_POST_CARD_STYLE = {
    backgroundColor: FEED_CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: FEED_CARD_BORDER_COLOR,
    marginBottom: 8, // mb-2
    overflow: 'visible' as const,
};

/** Web FeedCard inner body: relative w-full overflow-visible. */
export const FEED_CARD_BODY = {
    position: 'relative' as const,
    width: '100%' as const,
    overflow: 'visible' as const,
};

/** Default media frame while sizing / for letterboxing. */
export const FEED_CARD_MEDIA_FRAME = {
    backgroundColor: FEED_CARD_MEDIA_BG,
};

/** Web FeedCard sponsored row: `px-4 pt-2 pb-1.5`. */
export const FEED_CARD_SPONSORED_PADDING = {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
} as const;

/** Web caption block under media: `px-3 py-2.5`. */
export const FEED_CARD_CAPTION_PADDING = {
    paddingHorizontal: 12,
    paddingVertical: 10,
} as const;

/** Web EngagementBar shell: `px-3 pt-2 pb-2.5 border-t` with borderColor #030712. */
export const FEED_CARD_ENGAGEMENT_BAR_PADDING = {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: FEED_PAGE_BG,
} as const;

/** Full-bleed media column (black, overlaid PostHeader). */
export const FEED_CARD_MEDIA_WRAP = {
    width: '100%' as const,
    backgroundColor: FEED_CARD_MEDIA_BG,
    position: 'relative' as const,
    overflow: 'hidden' as const,
};

/** Double-tap like burst overlay (YouTube Shorts thumbs-up at tap point). */
export const FEED_CARD_MEDIA_FX_LAYER = {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
} as const;

/** Transparent tap layer above media (below header + chrome controls). */
export const FEED_CARD_MEDIA_TAP_LAYER = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    elevation: Platform.OS === 'android' ? 16 : 0,
    // Android skips fully transparent views for hit-testing.
    backgroundColor: 'rgba(0,0,0,0.01)',
} as const;

/** Client upload / failure overlay on media. */
export const FEED_CARD_UPLOAD_OVERLAY = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    gap: 6,
};

export const FEED_CARD_UPLOAD_TITLE = {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
    marginTop: 4,
};

export const FEED_CARD_UPLOAD_SUBTITLE = {
    color: '#D1D5DB',
    fontSize: 12,
    textAlign: 'center' as const,
};

/** Web sponsored row container: flex + px-4 pt-2 pb-1.5. */
export const FEED_CARD_SPONSORED_ROW = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    ...FEED_CARD_SPONSORED_PADDING,
};

/** Web `inline-flex … px-2.5 py-0.5 rounded-full text-xs … bg-amber-500/20`. */
export const FEED_CARD_SPONSORED_PILL = {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
};

export const FEED_CARD_SPONSORED_TEXT = {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#FBBF24',
};

export const FEED_CARD_SPONSORED_FEED_TYPE = {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize' as const,
};

/** Web EngagementBar flex row + border-t padding. */
export const FEED_CARD_ENGAGEMENT_BAR = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    minWidth: 0,
    ...FEED_CARD_ENGAGEMENT_BAR_PADDING,
};

export const FEED_CARD_ENGAGEMENT_BAR_DIMMED = {
    opacity: 0.45,
};

/** Left cluster in engagement row (web: flex items-center min-w-0 flex-shrink). */
export const FEED_CARD_ENGAGEMENT_LEFT = {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
};

/** Web carousel thumb rail: px-3 py-2 bg-black/95 border-t border-white/10. */
export const FEED_CARD_CAROUSEL_WRAP = {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
};

export const FEED_CARD_CAROUSEL_HEADER = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
};

export const FEED_CARD_CAROUSEL_TITLE = {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.85)',
};

export const FEED_CARD_CAROUSEL_COUNT = {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
};

export const FEED_CARD_CAROUSEL_RAIL = {
    flexDirection: 'row' as const,
    gap: 8,
    paddingBottom: 4,
};

export const FEED_CARD_CAROUSEL_THUMB = {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
};

export const FEED_CARD_CAROUSEL_THUMB_ACTIVE = {
    borderColor: '#FFFFFF',
    borderWidth: 2,
};

/** Web banner ticker under engagement (news-ticker-container). */
export const FEED_CARD_TICKER_WRAP = {
    height: 28,
    overflow: 'hidden' as const,
    backgroundColor: FEED_CARD_MEDIA_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FEED_CARD_BORDER_COLOR,
    justifyContent: 'center' as const,
};

export const FEED_CARD_TICKER_TEXT = {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
    paddingHorizontal: 12,
};

/** Web empty-feed card: rounded-2xl border-gray-800 gradient shell. */
export const FEED_EMPTY_CARD = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(31, 41, 55, 0.95)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
    maxWidth: 448,
    width: '100%' as const,
};

export const FEED_EMPTY_BADGE = {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center' as const,
};

export const FEED_EMPTY_TITLE = {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: 8,
};

export const FEED_EMPTY_SUBTITLE = {
    fontSize: 14,
    lineHeight: 20,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginBottom: 16,
};

export const FEED_EMPTY_FOLLOWING_TITLE = {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: 4,
};

export const FEED_EMPTY_FOLLOWING_SUBTITLE = {
    fontSize: 14,
    lineHeight: 20,
    color: '#9CA3AF',
    textAlign: 'center' as const,
};

export const FEED_EMPTY_GRADIENT_BTN = {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 200,
};

export const FEED_EMPTY_GRADIENT_BTN_TEXT = {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600' as const,
};

export const FEED_EMPTY_NOTIFY_GRADIENT = ['#0EA5E9', '#6366F1', '#A855F7'] as const;
export const FEED_EMPTY_CREATE_GRADIENT = ['#EF4444', '#FACC15', '#EF4444'] as const;

/** Web PillTabs container: `bg-black py-1`. */
export const FEED_PILL_TABS_BG = '#000000';

/** Web location pill: `bg-[#36454F]`. */
export const FEED_LOCATION_PILL_BG = '#36454F';

/** Web header title typography (PillTabs location label) — optically bumped for phone. */
export const FEED_HEADER_TITLE = {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 22,
    color: '#E5E7EB',
};

/** Web PillTabs grid row: grid-cols-[auto_1fr_auto] gap-2 px-3 — taller for IG weight. */
export const FEED_HEADER_PICKER_ROW = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    minHeight: 52,
    gap: 8,
    zIndex: 30,
};

export const FEED_HEADER_SIDE_ACTION = {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 2,
};

export const FEED_HEADER_SIDE_LABEL = {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
};

export const FEED_HEADER_CENTER = {
    flex: 1,
    minWidth: 0,
    alignItems: 'center' as const,
    position: 'relative' as const,
};

/** Web location pill: rounded-lg bg-[#36454F] — padded for Instagram chrome weight. */
export const FEED_HEADER_LOCATION_PILL = {
    position: 'relative' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    maxWidth: '100%' as const,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: FEED_LOCATION_PILL_BG,
    overflow: 'visible' as const,
};

export const FEED_HEADER_ACTIVE_DOT = {
    width: 11,
    height: 11,
    borderRadius: 999,
};

export const FEED_HEADER_LOCATION_TITLE = {
    flexShrink: 1,
    maxWidth: 160,
    ...FEED_HEADER_TITLE,
};

/** Web dropdown: rounded-[22px] border-white/10 bg-[#272b35]/92. */
export const FEED_HEADER_DROPDOWN_MENU = {
    position: 'absolute' as const,
    top: '100%' as const,
    marginTop: 6,
    alignSelf: 'center' as const,
    width: 220,
    backgroundColor: 'rgba(39, 43, 53, 0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    zIndex: 60,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 36,
};

export const FEED_HEADER_DROPDOWN_SEARCH_WRAP = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
};

export const FEED_HEADER_DROPDOWN_SEARCH_INPUT = {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 0,
    borderWidth: 0,
};

export const FEED_HEADER_DROPDOWN_SEARCH_HINT = {
    marginTop: 4,
    marginBottom: 4,
    marginHorizontal: 14,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
};

export const FEED_HEADER_DROPDOWN_SUGGESTIONS_WRAP = {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden' as const,
};

export const FEED_HEADER_DROPDOWN_SUGGESTION_ITEM = {
    paddingHorizontal: 14,
    paddingVertical: 12,
};

export const FEED_HEADER_DROPDOWN_SUGGESTION_TEXT = {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
};

export const FEED_HEADER_DROPDOWN_META = {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
};

export const FEED_HEADER_DROPDOWN_MENU_ITEM = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
};

export const FEED_HEADER_DROPDOWN_MENU_TEXT = {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600' as const,
};

export const FEED_HEADER_PASSPORT_AVATAR = {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden' as const,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

export const FEED_HEADER_PASSPORT_INITIALS = {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
};

export const FEED_HEADER_ICON_BUTTON = {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

export const FEED_HEADER_RIGHT_ACTIONS = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 2,
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
            <View style={styles.opaqueBackdrop} pointerEvents="none" />
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
    opaqueBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: FEED_PAGE_BG,
        zIndex: 0,
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
        position: 'relative',
        zIndex: 140,
    },
    scrollHost: {
        flex: 1,
        minHeight: 0,
        paddingBottom: 8, // web pb-2
        backgroundColor: FEED_PAGE_BG,
        zIndex: 1,
    },
    offlineBanner: {
        marginHorizontal: 12, // mx-3
        marginTop: 8, // mt-2
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#92400E', // amber-800
        backgroundColor: '#451A03', // amber-950
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    offlineBannerText: {
        fontSize: 12,
        color: '#FDE68A', // amber-200
    },
    errorBanner: {
        marginHorizontal: 16,
        marginVertical: 12,
        padding: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#991B1B', // red-800
        backgroundColor: '#450A0A', // red-950
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        color: '#FECACA', // red-200
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
