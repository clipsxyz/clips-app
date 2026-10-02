import React, { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { normalizeHex } from '../utils/feedAmbientPalette';

type Props = {
    /** Focused post accent — morphs the full-bleed feed floor. */
    dominantColor?: string | null;
};

/** Safe neutral when the focused post has no usable dominant colour. */
const AMBIENT_NEUTRAL_HEX = '#0B0E14';

const MORPH_MS = 500;

/**
 * Full-bleed feed floor. Colour-only Reanimated morph — no gestures / video.
 */
function FeedAmbientCanvasBase({ dominantColor }: Props) {
    const progress = useSharedValue(0);
    const fromColor = useSharedValue(AMBIENT_NEUTRAL_HEX);
    const toColor = useSharedValue(AMBIENT_NEUTRAL_HEX);

    useEffect(() => {
        const next = normalizeHex(dominantColor) ?? AMBIENT_NEUTRAL_HEX;
        // Carry the last target as the new origin so mid-morph scrolls stay continuous.
        fromColor.value = toColor.value;
        toColor.value = next;
        progress.value = 0;
        progress.value = withTiming(1, { duration: MORPH_MS });
    }, [dominantColor, fromColor, progress, toColor]);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [fromColor.value, toColor.value],
        ),
    }));

    return (
        <Animated.View
            style={[styles.canvas, animatedStyle]}
            pointerEvents="none"
            collapsable={false}
        />
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
        backgroundColor: AMBIENT_NEUTRAL_HEX,
    },
});

export default memo(FeedAmbientCanvasBase);
