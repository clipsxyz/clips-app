import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ox } from '../constants/nativeOpticalScale';

export const NEWS_HEADLINE_MAX_CHARS = 80;
export const NEWS_HEADLINE_CTA_LABEL = 'TAP TO READ';
export const NEWS_ACCENT_COLOR = '#E50914';

type Props = {
    headline?: string;
    linkUrl?: string | null;
    /** Editor: tap headline / CTA opens editors. Viewer: CTA opens URL. */
    mode?: 'editor' | 'viewer';
    onPressHeadline?: () => void;
    onPressCta?: () => void;
    style?: StyleProp<ViewStyle>;
    /** Show empty headline guide in the editor before text exists. */
    showEmptyGuides?: boolean;
    /**
     * Extra space above bottom chrome (composer rail / story reply bar)
     * so the link pill stays visible.
     */
    ctaBottomOffset?: number;
};

/**
 * Fixed news-headline layout for Stories 24:
 * red accent → uppercase headline (mid canvas) → white “TAP TO READ” pill when a link exists.
 * Link is added from the footer rail — no ghost “ADD LINK” control on the canvas.
 */
export default function StoryNewsHeadlineScaffold({
    headline,
    linkUrl,
    mode = 'editor',
    onPressHeadline,
    onPressCta,
    style,
    showEmptyGuides = false,
    ctaBottomOffset = ox(132),
}: Props) {
    const trimmed = String(headline || '').trim();
    const displayHeadline = trimmed
        ? trimmed.toUpperCase().slice(0, NEWS_HEADLINE_MAX_CHARS)
        : '';
    const hasHeadline = displayHeadline.length > 0;
    const hasLink = Boolean(String(linkUrl || '').trim());
    const showHeadlineBlock = hasHeadline || (mode === 'editor' && showEmptyGuides);
    const showScaffold = showHeadlineBlock || hasLink;

    if (!showScaffold) return null;

    const headlineNode = (
        <View style={styles.headlineWrap}>
            {!hasHeadline && mode === 'editor' && showEmptyGuides ? (
                <Text style={styles.headlinePlaceholder}>ADD HEADLINE</Text>
            ) : hasHeadline ? (
                <Text style={styles.headline} numberOfLines={4}>
                    {displayHeadline}
                </Text>
            ) : null}
        </View>
    );

    const ctaNode = (
        <View style={styles.ctaPill}>
            <View style={styles.ctaIconWrap}>
                <Icon name="link-outline" size={ox(14)} color="#FFFFFF" />
            </View>
            <Text style={styles.ctaText}>{NEWS_HEADLINE_CTA_LABEL}</Text>
        </View>
    );

    const ctaInteractive =
        !hasLink
            ? null
            : onPressCta ? (
                  <Pressable onPress={onPressCta} style={styles.ctaPress} hitSlop={12}>
                      {ctaNode}
                  </Pressable>
              ) : (
                  ctaNode
              );

    return (
        <View style={[styles.root, style]} pointerEvents="box-none">
            {showHeadlineBlock ? (
                <View style={styles.midStack} pointerEvents="box-none">
                    <View style={styles.accent} />
                    {mode === 'editor' && onPressHeadline ? (
                        <Pressable onPress={onPressHeadline} hitSlop={8}>
                            {headlineNode}
                        </Pressable>
                    ) : (
                        headlineNode
                    )}
                </View>
            ) : null}

            {ctaInteractive ? (
                <View
                    style={[styles.ctaAnchor, { bottom: Math.max(ox(24), ctaBottomOffset) }]}
                    pointerEvents="box-none"
                >
                    {ctaInteractive}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        // Above StoryBottomBar (zIndex 120) so TAP TO READ stays visible/tappable.
        zIndex: 130,
        elevation: 130,
    },
    midStack: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: ox(28),
        paddingBottom: ox(100),
    },
    accent: {
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: NEWS_ACCENT_COLOR,
        marginBottom: ox(14),
    },
    headlineWrap: {
        width: '100%',
        maxWidth: ox(340),
        alignItems: 'center',
        paddingVertical: ox(4),
        paddingHorizontal: ox(4),
    },
    headline: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: ox(26),
        lineHeight: ox(32),
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        textShadowColor: 'rgba(0,0,0,0.72)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
    },
    headlinePlaceholder: {
        color: 'rgba(255,255,255,0.55)',
        fontWeight: '800',
        fontSize: ox(18),
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    ctaAnchor: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 131,
        elevation: 131,
    },
    ctaPress: {
        alignItems: 'center',
    },
    ctaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ox(10),
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    ctaIconWrap: {
        width: ox(22),
        height: ox(22),
        borderRadius: ox(11),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E11D48',
    },
    ctaText: {
        color: '#000000',
        fontWeight: '700',
        fontSize: ox(13),
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
