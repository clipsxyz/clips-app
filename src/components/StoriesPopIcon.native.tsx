import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
    size?: number;
};

/** Black & white Stories play icon with pop pulse — used while Stories 24 opens. */
export default function StoriesPopIcon({ size = 72 }: Props) {
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pop = Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.14,
                    duration: 450,
                    easing: Easing.out(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 450,
                    easing: Easing.in(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );
        pop.start();
        return () => pop.stop();
    }, [scale]);

    return (
        <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ scale }] }]}>
            <LinearGradient
                colors={['#0a0a0a', '#3d3d3d', '#f5f5f5']}
                locations={[0, 0.48, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
            >
                <Icon name="play" size={Math.round(size * 0.38)} color="#FFFFFF" />
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
    },
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
});
