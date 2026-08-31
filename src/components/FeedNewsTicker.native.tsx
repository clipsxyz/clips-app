import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { FEED_CARD_TICKER_TEXT, FEED_CARD_TICKER_WRAP } from './FeedPageLayout.native';

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
        <View style={FEED_CARD_TICKER_WRAP}>
            <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
                <Text style={FEED_CARD_TICKER_TEXT}>{label}</Text>
            </Animated.View>
        </View>
    );
}
