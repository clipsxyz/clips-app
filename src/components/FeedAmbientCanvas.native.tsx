import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/**
 * Obsidian floor for the feed canvas.
 *
 * Neutral by design. The header morphs through a saturated accent palette, and the
 * previous teal Passport wash fought those hues for attention — the accents now read as
 * the only saturated thing on screen.
 */
export const FEED_AMBIENT_STATIC_HEX = '#0B0E14';

/** Subtle vertical wash — smoked glass, darkening toward the tab bar. */
const FEED_AMBIENT_WASH = ['#161B22', '#0B0E14', '#05070A'] as const;

/** Faint sheen so cards read as floating on smoked glass rather than sitting on flat paint. */
const FEED_AMBIENT_FROST = 'rgba(255, 255, 255, 0.02)';

type Props = {
    /** Ignored — the canvas is a fixed neutral wash, never sampled per post. */
    dominantColor?: string | null;
};

/** Full-bleed feed floor. */
function FeedAmbientCanvasBase(_props: Props) {
    return (
        <>
            <LinearGradient
                colors={[...FEED_AMBIENT_WASH]}
                locations={[0, 0.5, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.canvas}
                pointerEvents="none"
                collapsable={false}
            />
            <View style={styles.frost} pointerEvents="none" />
        </>
    );
}

const styles = StyleSheet.create({
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        elevation: 0,
        backgroundColor: FEED_AMBIENT_STATIC_HEX,
    },
    frost: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        elevation: 0,
        backgroundColor: FEED_AMBIENT_FROST,
    },
});

export default memo(FeedAmbientCanvasBase);
