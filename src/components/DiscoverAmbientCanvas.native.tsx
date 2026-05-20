import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import HalftoneOverlay from './HalftoneOverlay.native';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    /** Fill the parent (feed card). When false, fills the window (full screen). */
    fillParent?: boolean;
    variant?: DiscoverAmbientVariant;
};

/**
 * Native Discover-style ambient canvas (animated gradients + halftone).
 * `goldChrome` matches Stories 24 border colours.
 */
export default function DiscoverAmbientCanvas({
    fillParent = true,
    variant = 'discover',
}: Props) {
    const { width: winW, height: winH } = useWindowDimensions();
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const drift = useRef(new Animated.Value(0)).current;

    const width = fillParent ? layout.width : winW;
    const height = fillParent ? layout.height : winH;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(drift, {
                    toValue: 1,
                    duration: 5500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(drift, {
                    toValue: 0,
                    duration: 5500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [drift]);

    const translateX = drift.interpolate({
        inputRange: [0, 1],
        outputRange: [-width * 0.08, width * 0.12],
    });
    const translateY = drift.interpolate({
        inputRange: [0, 1],
        outputRange: [height * 0.06, -height * 0.1],
    });

    const onLayout = (e: LayoutChangeEvent) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0) setLayout({ width: w, height: h });
    };

    const baseColors =
        variant === 'goldChrome'
            ? ['#0b0711', '#1a1530', '#0b0711']
            : ['#0b0711', '#201138', '#0b0711'];

    const glowColors =
        variant === 'goldChrome'
            ? ['rgba(11,7,17,0)', 'rgba(246,226,122,0.5)', 'rgba(191,197,204,0.3)']
            : ['rgba(11,7,17,0)', 'rgba(217,27,92,0.55)', 'rgba(32,17,56,0.35)'];

    const shell = (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient
                colors={baseColors}
                locations={[0, 0.55, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {width > 0 && height > 0 ? (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            transform: [{ translateX }, { translateY }],
                            opacity: 0.92,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={glowColors}
                        locations={[0, 0.45, 1]}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0.2 }}
                        style={[StyleSheet.absoluteFill, { width: width * 1.35, height: height * 1.2 }]}
                    />
                </Animated.View>
            ) : null}
            <HalftoneOverlay variant={variant} />
        </View>
    );

    if (!fillParent) {
        return shell;
    }

    return (
        <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
            {shell}
        </View>
    );
}
