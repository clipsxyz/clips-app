import React, { useEffect, useRef } from 'react';
import {
    AccessibilityInfo,
    Animated,
    StyleSheet,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
    STORIES_24_AVATAR_RING_COLORS,
    STORIES_24_AVATAR_RING_SEEN,
} from '../constants/stories24Ring';

const RING_PAD = 2;

type Props = {
    size: number;
    unviewed?: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/** Shared Stories 24 ring — teal/sky/fuchsia + white pulse when unviewed. */
export default function Stories24Ring({ size, unviewed = false, children, style }: Props) {
    const pulse = useRef(new Animated.Value(0.28)).current;
    const inner = Math.max(1, size - RING_PAD * 2);

    useEffect(() => {
        if (!unviewed) {
            pulse.stopAnimation();
            pulse.setValue(0.28);
            return;
        }
        let loop: Animated.CompositeAnimation | null = null;
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (!mounted || enabled) return;
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0.22,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ]),
            );
            loop.start();
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            loop?.stop();
            loop = null;
            if (enabled) {
                pulse.setValue(0.55);
                return;
            }
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0.22,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ]),
            );
            loop.start();
        });
        return () => {
            mounted = false;
            loop?.stop();
            sub.remove();
        };
    }, [pulse, unviewed]);

    return (
        <View
            style={[
                styles.ring,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    padding: RING_PAD,
                },
                style,
            ]}
        >
            {unviewed ? (
                <LinearGradient
                    colors={[...STORIES_24_AVATAR_RING_COLORS]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.ringSeen]} />
            )}
            {unviewed ? (
                <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.ringPulseFill, { opacity: pulse }]}
                />
            ) : null}
            <View
                style={{
                    width: inner,
                    height: inner,
                    borderRadius: inner / 2,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ringSeen: {
        backgroundColor: STORIES_24_AVATAR_RING_SEEN,
    },
    ringPulseFill: {
        backgroundColor: '#FFFFFF',
    },
});
