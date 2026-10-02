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
import { ox } from '../constants/nativeOpticalScale';

/** News feed shell / ambient canvas floor. */
export const FEED_PAGE_BG = '#161E2E';

/** Web post card / article background — Gazetteer Swal sheet (`#060d16`). */
export const FEED_CARD_BG = '#060d16';

/**
 * Header (username) + engagement (like) chrome — same Swal Gazetteer sheet colour.
 */
export const FEED_CARD_CHROME_BG = '#060d16';

/**
 * Header + footer chrome fill — same floor as the feed ambient canvas.
 */
export const FEED_CHROME_GLASS = '#161E2E';

/**
 * Height of the MainTabBar content above the home-indicator / nav inset.
 * Kept in sync with FeedScreen `TAB_BAR_CLEARANCE` so the in-feed bottom glass
 * band lines up with the absolute tab icons.
 */
export const FEED_TAB_BAR_CLEARANCE = 64;

/** Media column + loading frame (black letterbox). */
export const FEED_CARD_MEDIA_BG = '#000000';

/** Web post card bottom divider (dark:border-gray-700). */
export const FEED_CARD_BORDER_COLOR = 'rgba(55, 65, 81, 0.9)';

/** Web FeedCard article chrome (non-tile mode). */
export const FEED_POST_CARD_STYLE = {
    backgroundColor: FEED_CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: FEED_CARD_BORDER_COLOR,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    flexDirection: 'column' as const,
};

/**
 * NOW TV-style floating card shell.
 *
 * Deliberately a NEW wrapper instead of a restyle of `FEED_POST_CARD_STYLE`. The card
 * keeps its own opaque background and its own 1px separator; insetting the shell is what
 * exposes the ambient canvas in the margins between cards. The canvas has to be visible in
 * the gap to be worth animating, so that separation is the whole effect.
 */
export const FEED_CARD_FLOAT_WRAP = {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: FEED_CARD_BG,
    position: 'relative' as const,
} as const;

/**
 * Bottom 35% of the media frame.
 *
 * Anchored to the MEDIA wrapper, not the card, so it tints only the image/video. Captions
 * and the engagement bar render below that wrapper in the card body and are unaffected.
 */
export const FEED_CARD_MEDIA_SCRIM = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: '35%' as const,
} as const;

/** Header → media → footer. Clip media so TextureView cannot bleed. */
export const FEED_CARD_BODY = {
    position: 'relative' as const,
    width: '100%' as const,
    overflow: 'hidden' as const,
    flexDirection: 'column' as const,
};

/** Reserved chrome above media so the player cannot collapse into the next card. */
export const FEED_CARD_HEADER_WRAP = {
    position: 'relative' as const,
    width: '100%' as const,
    minHeight: 56,
    zIndex: 2,
    backgroundColor: FEED_CARD_CHROME_BG,
} as const;

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

/** Web EngagementBar shell: `px-3 pt-2 pb-2.5`. No hairline — the glass scrim owns the edge. */
export const FEED_CARD_ENGAGEMENT_BAR_PADDING = {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
} as const;

/** Full-bleed media column below the stacked post header. */
export const FEED_CARD_MEDIA_WRAP = {
    width: '100%' as const,
    backgroundColor: FEED_CARD_MEDIA_BG,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    // Android only clips TextureView children when overflow:hidden is paired with a radius.
    borderRadius: 1,
};

/** Double-tap like burst overlay (YouTube Shorts thumbs-up at tap point). */
export const FEED_CARD_MEDIA_FX_LAYER = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 45,
    elevation: Platform.OS === 'android' ? 45 : 0,
} as const;

/** Transparent tap layer above media (header is stacked above this frame). */
export const FEED_CARD_MEDIA_TAP_LAYER = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    // Leave bottom chrome clear for Scenes CTA + mute (external tap layer sits above media).
    bottom: 56,
    zIndex: 15,
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
    position: 'relative' as const,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    minWidth: 0,
    ...FEED_CARD_ENGAGEMENT_BAR_PADDING,
};

/**
 * Soft scrim seated behind the action controls. Keeps Like/Comment/Boost/Save reading as
 * frosted chrome over the card body rather than a flat dark panel, without reducing the
 * opacity of the card itself (text legibility over arbitrary footage is preserved).
 */
export const FEED_CARD_ENGAGEMENT_SCRIM = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
};

export const FEED_CARD_ENGAGEMENT_BAR_DIMMED = {
    opacity: 0.45,
};

/** Left cluster in engagement row (web: flex items-center min-w-0 flex-shrink). */
export const FEED_CARD_ENGAGEMENT_LEFT = {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginRight: 8,
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

/** Header pill-tabs row — same floor as feed chrome. */
export const FEED_PILL_TABS_BG = '#161E2E';

/** Web location pill: `bg-[#36454F]`. */
export const FEED_LOCATION_PILL_BG = '#36454F';

/** Web header title typography (PillTabs location label — 18px / 700). */
export const FEED_HEADER_TITLE = {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 20,
    color: '#E5E7EB',
};

/** Web PillTabs grid row: grid-cols-[auto_1fr_auto] gap-2 px-3. */
export const FEED_HEADER_PICKER_ROW = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    minHeight: 44,
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
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500' as const,
    color: '#FFFFFF',
};

export const FEED_HEADER_CENTER = {
    flex: 1,
    minWidth: 0,
    alignItems: 'center' as const,
    position: 'relative' as const,
};

/** Web location pill: rounded-lg bg-[#36454F] px-3 py-1.5 gap-2. */
export const FEED_HEADER_LOCATION_PILL = {
    position: 'relative' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    maxWidth: '100%' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: FEED_LOCATION_PILL_BG,
    overflow: 'hidden' as const,
};

export const FEED_HEADER_ACTIVE_DOT = {
    width: 8,
    height: 8,
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
    top: 48,
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
    width: ox(36),
    height: ox(36),
    borderRadius: 10,
    overflow: 'hidden' as const,
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

export const FEED_HEADER_PASSPORT_INITIALS = {
    fontSize: ox(12),
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
    /**
     * Ambient canvas mounted at layout root so it paints behind the pinned chrome as
     * well as the scroll body. When supplied, the scroll body drops its opaque page
     * colour and both the header and the scroll area read as frosted glass.
     */
    backdrop?: ReactNode;
    online?: boolean;
    error?: string | null;
    onRetry?: () => void;
    style?: StyleProp<ViewStyle>;
};

export default function FeedPageLayout({
    header,
    children,
    backdrop,
    online = true,
    error = null,
    onRetry,
    style,
}: FeedPageLayoutProps) {
    const insets = useSafeAreaInsets();
    const glassScrollHost = backdrop ? styles.scrollHostGlass : null;

    return (
        <View style={[styles.root, backdrop ? styles.rootGlass : null, style]}>
            {/* Ambient is the only full-bleed plane when present. Opaque floor only when
                there is no canvas — otherwise Android paints the solid sibling over the
                transparent list and the tint never reads in the card margins. */}
            {backdrop ? (
                <View style={styles.ambientHost} pointerEvents="none" collapsable={false}>
                    {backdrop}
                </View>
            ) : (
                <View style={styles.opaqueBackdrop} pointerEvents="none" />
            )}
            {/*
              IMPORTANT: chrome + scroll must be DIRECT siblings of the ambient host.
              Wrapping them in a zIndex'd column creates an Android offscreen layer that
              composites rgba glass against black — looking like solid #000 bars.
            */}
            <View
                style={[styles.pinnedChrome, backdrop ? styles.pinnedChromeGlass : null, { paddingTop: insets.top }]}
                collapsable={false}
            >
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
            <View style={[styles.scrollHost, glassScrollHost]}>{children}</View>

            {/*
              Bottom glass band — same sibling compositing trick as pinnedChrome.
              React Navigation's tab scene uses zIndex, so a translucent MainTabBar
              would alpha-blend against black instead of this canvas. Paint the glass
              here (under transparent tab icons) so the glow reaches the gesture area.
            */}
            {backdrop ? (
                <View
                    pointerEvents="none"
                    collapsable={false}
                    style={[styles.bottomChromeGlass, { height: FEED_TAB_BAR_CLEARANCE + insets.bottom }]}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: FEED_PAGE_BG,
        overflow: 'hidden',
    },
    /** Drop the solid page fill so the ambient canvas owns the full-bleed plane. */
    rootGlass: {
        backgroundColor: 'transparent',
    },
    opaqueBackdrop: {
          // Spelled out rather than `...StyleSheet.absoluteFillObject`: that property is
          // absent from this RN version's StyleSheet type (it only exists on some versions),
          // and `absoluteFill` is a registered style ID, so it cannot be spread here.
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: FEED_PAGE_BG,
          zIndex: 0,
      },
    ambientHost: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 0,
        elevation: 0,
    },
    /** Ambient canvas mounts as a root sibling under this frosted band. */
    pinnedChrome: {
        flexShrink: 0,
        backgroundColor: FEED_PAGE_BG,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
        overflow: 'visible',
        zIndex: 50,
        ...Platform.select({
            android: { elevation: 0 },
            ios: {},
        }),
    },
    pinnedChromeGlass: {
        backgroundColor: FEED_CHROME_GLASS,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
        overflow: 'visible',
    },
    bottomChromeGlass: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: FEED_CHROME_GLASS,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
        ...Platform.select({
            android: { elevation: 0 },
            ios: {},
        }),
    },
    spacer16: {
        height: 16, // web h-4
    },
    pillTabsHost: {
        // Transparent so it does not double-darken the frosted chrome behind it.
        backgroundColor: 'transparent',
        paddingVertical: 4, // web py-1
        position: 'relative',
        // Let the "Switch feed" cue sit above the pill without being clipped.
        overflow: 'visible',
        zIndex: 50,
    },
    scrollHost: {
        flex: 1,
        minHeight: 0,
        paddingBottom: 8, // web pb-2
        backgroundColor: FEED_PAGE_BG,
    },
    /** Drop the opaque page colour when an ambient canvas owns the root background. */
    scrollHostGlass: {
        backgroundColor: 'transparent',
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
