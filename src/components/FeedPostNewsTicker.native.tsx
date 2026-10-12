import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import { buildFeedPostNewsTicker, tickerSlideCount } from '../utils/feedPostNewsTicker';

const TICKER_HEIGHT = 34;

type Props = {
    post: Post;
    carouselIndex?: number;
};

export default function FeedPostNewsTicker({ post, carouselIndex = 0 }: Props) {
    const slideCount = tickerSlideCount(post);
    const data = buildFeedPostNewsTicker(post, carouselIndex, slideCount >= 2 ? slideCount : undefined);

    const anim = useRef(new Animated.Value(0)).current;
    const [textWidth, setTextWidth] = useState(0);

    useEffect(() => {
        if (textWidth <= 0) return;
        anim.setValue(0);
        const duration = Math.max(10000, textWidth * 36);
        const loop = Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [anim, textWidth, data.content]);

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -textWidth],
    });

    const tickerText = `${data.content}   •   ${data.content}`;

    return (
        <View style={styles.scrim}>
            <LinearGradient
                colors={['rgba(15, 15, 18, 0.92)', 'rgba(15, 15, 18, 0.72)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <Animated.View
                style={[
                    styles.animatedTrack,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <Text
                    style={styles.measureText}
                    numberOfLines={1}
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                >
                    {tickerText}
                </Text>
                <Text style={styles.tickerText} numberOfLines={1}>
                    {tickerText}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    scrim: {
        height: TICKER_HEIGHT,
        minHeight: TICKER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
    },
    animatedTrack: {
        position: 'absolute',
        left: 0,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        width: 9999,
        flexShrink: 0,
    },
    tickerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
        flexShrink: 0,
    },
    measureText: {
        position: 'absolute',
        opacity: 0,
        flexShrink: 0,
        flexWrap: 'nowrap',
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
});
