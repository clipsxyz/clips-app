import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
    children: React.ReactNode;
    /** Re-run border reveal when post changes. */
    revealKey?: string;
    size?: number;
};

/** White rounded border reveal on mount (web ScenesModal profile avatar parity). */
export default function ScenesProfileAvatarRing({ children, revealKey, size = 32 }: Props) {
    const reveal = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        reveal.setValue(0);
        const anim = Animated.timing(reveal, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, [reveal, revealKey]);

    const borderOpacity = reveal.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.4, 1],
    });

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.borderRing,
                    {
                        opacity: borderOpacity,
                        borderRadius: 8,
                    },
                ]}
            />
            <View style={styles.inner}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
        borderRadius: 8,
    },
    borderRing: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 1,
    },
    inner: {
        flex: 1,
        borderRadius: 6,
        overflow: 'hidden',
        margin: 2,
        backgroundColor: '#000',
    },
});
