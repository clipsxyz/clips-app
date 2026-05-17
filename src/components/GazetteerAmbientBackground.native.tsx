import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import HalftoneOverlay from './HalftoneOverlay.native';

/** Native ambient background: animated gradient + halftone (iOS & Android). */
export default function GazetteerAmbientBackground() {
    const { width, height } = useWindowDimensions();
    const drift = useRef(new Animated.Value(0)).current;

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

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient
                colors={['#0b0711', '#201138', '#0b0711']}
                locations={[0, 0.55, 1]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
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
                    colors={['rgba(11,7,17,0)', 'rgba(217,27,92,0.55)', 'rgba(32,17,56,0.35)']}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0.2 }}
                    style={[StyleSheet.absoluteFill, { width: width * 1.35, height: height * 1.2 }]}
                />
            </Animated.View>
            <HalftoneOverlay />
        </View>
    );
}
