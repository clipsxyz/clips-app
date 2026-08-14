import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    Animated,
    Easing,
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { PASSPORT_TRAVELING_BORDER_COLORS } from '../utils/discoverAmbientPalette';

type Props = {
    children: React.ReactNode;
    /** Outer corner radius (includes the border ring). */
    borderRadius?: number;
    borderWidth?: number;
    style?: StyleProp<ViewStyle>;
};

/**
 * Instagram-style traveling gradient ring (passport sea-glass + brass).
 * Clips only the ring layer so sibling badges outside this view stay visible.
 */
export default function PassportTravelingBorder({
    children,
    borderRadius = 10,
    borderWidth = 2,
    style,
}: Props) {
    const spin = useRef(new Animated.Value(0)).current;
    const [reduceMotion, setReduceMotion] = useState(false);
    const [box, setBox] = useState({ w: 0, h: 0 });

    useEffect(() => {
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) setReduceMotion(Boolean(enabled));
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            setReduceMotion(Boolean(enabled));
        });
        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    useEffect(() => {
        if (reduceMotion) {
            spin.setValue(0);
            return;
        }
        spin.setValue(0);
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => {
            loop.stop();
        };
    }, [reduceMotion, spin]);

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width <= 0 || height <= 0) return;
        if (Math.abs(width - box.w) < 0.5 && Math.abs(height - box.h) < 0.5) return;
        setBox({ w: width, h: height });
    };

    const rotate = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const innerRadius = Math.max(0, borderRadius - borderWidth);
    const spinSize = box.w > 0 && box.h > 0
        ? Math.ceil(Math.sqrt(box.w * box.w + box.h * box.h) * 1.2)
        : 0;

    return (
        <View
            onLayout={onLayout}
            style={[{ borderRadius, padding: borderWidth, overflow: 'hidden' }, style]}
        >
            {spinSize > 0 ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Animated.View
                        style={{
                            position: 'absolute',
                            width: spinSize,
                            height: spinSize,
                            left: (box.w - spinSize) / 2,
                            top: (box.h - spinSize) / 2,
                            transform: [{ rotate: reduceMotion ? '0deg' : rotate }],
                        }}
                    >
                        <LinearGradient
                            colors={[...PASSPORT_TRAVELING_BORDER_COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
            ) : null}
            <View style={{ borderRadius: innerRadius, overflow: 'hidden' }}>{children}</View>
        </View>
    );
}
