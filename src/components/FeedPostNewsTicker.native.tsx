import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { Post } from '../types';
import { buildFeedPostNewsTicker, tickerSlideCount, type NewsTickerBadgeTone } from '../utils/feedPostNewsTicker';

const TICKER_HEIGHT = 34;
const GAP = '   •   ';

type Props = {
    post: Post;
    carouselIndex?: number;
};

function badgeColors(tone: NewsTickerBadgeTone): { background: string } {
    switch (tone) {
        case 'emerald':
            return { background: '#10B981' };
        case 'yellow':
            return { background: '#F59E0B' };
    }
}

export default function FeedPostNewsTicker({ post, carouselIndex = 0 }: Props) {
    const slideCount = tickerSlideCount(post);
    const data = buildFeedPostNewsTicker(post, carouselIndex, slideCount >= 2 ? slideCount : undefined);
    const { background } = badgeColors(data.badgeTone);

    const anim = useRef(new Animated.Value(0)).current;
    const [textWidth, setTextWidth] = useState(0);

    useEffect(() => {
        if (textWidth <= 0) return;
        const duration = Math.max(10000, textWidth * 36);
        anim.setValue(0);
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

    const marquee = `${data.content}${GAP}${data.content}`;

    return (
        <LinearGradient
            colors={['rgba(15, 15, 18, 0.92)', 'rgba(15, 15, 18, 0.72)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bar}
        >
            <View style={[styles.badge, { backgroundColor: background }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                    {data.badgeLabel}
                </Text>
            </View>
            <View style={styles.track}>
                <Animated.Text
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                    style={[styles.text, { transform: [{ translateX }] }]}
                >
                    {marquee}
                </Animated.Text>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    bar: {
        height: TICKER_HEIGHT,
        minHeight: TICKER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
    },
    badge: {
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 8,
        marginLeft: 12,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    track: {
        flex: 1,
        overflow: 'hidden',
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
        paddingLeft: 4,
        flexShrink: 0,
        flexDirection: 'row',
        flexWrap: 'nowrap',
    },
});