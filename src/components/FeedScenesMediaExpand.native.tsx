import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated';

export type FeedScenesOrigin = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Props = {
    expanding: boolean;
    progress: SharedValue<number>;
    origin: FeedScenesOrigin | null;
    screenWidth: number;
    screenHeight: number;
    style?: ViewStyle;
    children: React.ReactNode;
};

/**
 * Grows the in-cell player box from the postcard to the window.
 * Uses width/height (not scaleX/scaleY) so the video is not stretched.
 */
export default function FeedScenesMediaExpand({
    expanding,
    progress,
    origin,
    screenWidth,
    screenHeight,
    style,
    children,
}: Props) {
    const animStyle = useAnimatedStyle(() => {
        if (!expanding || !origin || origin.width < 8 || origin.height < 8) {
            return {};
        }
        const p = progress.value;
        const ow = Math.max(1, origin.width);
        const oh = Math.max(1, origin.height);
        const sw = Math.max(1, screenWidth);
        const sh = Math.max(1, screenHeight);
        return {
            position: 'absolute' as const,
            left: 0,
            top: 0,
            width: interpolate(p, [0, 1], [ow, sw]),
            height: interpolate(p, [0, 1], [oh, sh]),
            zIndex: 9999,
            backgroundColor: '#000000',
            transform: [
                { translateX: interpolate(p, [0, 1], [0, -origin.x]) },
                { translateY: interpolate(p, [0, 1], [0, -origin.y]) },
            ],
        };
    }, [expanding, origin, screenHeight, screenWidth]);

    if (!expanding || !origin) {
        return (
            <View style={style} collapsable={false}>
                {children}
            </View>
        );
    }

    return (
        <View
            style={[style, { width: origin.width, height: origin.height }]}
            collapsable={false}
        >
            <Animated.View style={[styles.lift, animStyle]} collapsable={false}>
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    lift: {
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
});
