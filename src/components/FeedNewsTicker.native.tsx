import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';

type Props = {
    text: string;
};

export default function FeedNewsTicker({ text }: Props) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: 12000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [anim, text]);

    const label = `${text} • ${text} • ${text} • ${text}`;
    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -280],
    });

    return (
        <View style={styles.wrap}>
            <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
                <Text style={styles.text}>{label}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        height: 28,
        overflow: 'hidden',
        backgroundColor: '#000000',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#374151',
        justifyContent: 'center',
    },
    track: {
        flexDirection: 'row',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 12,
    },
});
