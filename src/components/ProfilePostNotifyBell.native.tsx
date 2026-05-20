import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    active: boolean;
    size?: number;
    activeColor?: string;
    inactiveColor?: string;
};

/** Ionicons bell — outline when off, filled when on; gentle wiggle when notifications enabled. */
export default function ProfilePostNotifyBell({
    active,
    size = 22,
    activeColor = '#f9a8d4',
    inactiveColor = '#FFFFFF',
}: Props) {
    const rotate = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const wasActive = useRef(active);

    useEffect(() => {
        rotate.stopAnimation();
        if (!active) {
            rotate.setValue(0);
            return;
        }
        const wiggle = Animated.loop(
            Animated.sequence([
                Animated.timing(rotate, {
                    toValue: 1,
                    duration: 110,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(rotate, {
                    toValue: -1,
                    duration: 200,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(rotate, {
                    toValue: 0,
                    duration: 110,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.delay(2400),
            ]),
        );
        wiggle.start();
        return () => wiggle.stop();
    }, [active, rotate]);

    useEffect(() => {
        if (active && !wasActive.current) {
            scale.setValue(0.82);
            Animated.spring(scale, {
                toValue: 1,
                friction: 5,
                tension: 140,
                useNativeDriver: true,
            }).start();
        }
        wasActive.current = active;
    }, [active, scale]);

    const spin = rotate.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-16deg', '0deg', '16deg'],
    });

    return (
        <Animated.View style={{ transform: [{ rotate: spin }, { scale }] }}>
            <Icon
                name={active ? 'notifications' : 'notifications-outline'}
                size={size}
                color={active ? activeColor : inactiveColor}
            />
        </Animated.View>
    );
}
