import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

/** White location pin that shakes while the next page of the newsfeed loads. */
export default function FeedPagingPin() {
    const shake = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shake, {
                    toValue: 1,
                    duration: 55,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shake, {
                    toValue: -1,
                    duration: 110,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shake, {
                    toValue: 0,
                    duration: 55,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => {
            loop.stop();
            shake.setValue(0);
        };
    }, [shake]);

    const rotate = shake.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-14deg', '14deg'],
    });
    const translateX = shake.interpolate({
        inputRange: [-1, 1],
        outputRange: [-2, 2],
    });

    return (
        <Animated.View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading more posts"
            style={{ transform: [{ translateX }, { rotate }] }}
        >
            <Icon name="location" size={28} color="#FFFFFF" />
        </Animated.View>
    );
}
