import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

function renderTextWithIcons(content: string): React.ReactNode {
    // Simple token-based rendering by looking for known labels
    const parts = content.split(new RegExp(`(${GAP})`));
    return parts.map((part, idx) => {
        if (part === GAP) return <Text key={`gap-${idx}`} style={styles.tickerText}>{GAP}</Text>;
        if (part.includes('VENUE:')) {
            return (
                <View key={`p-${idx}`} style={styles.iconTextRow}>
                    <Ionicons name="business-sharp" size={12} color="#FFFFFF" style={styles.icon} />
                    <Text style={styles.tickerText}>{part}</Text>
                </View>
            );
        }
        if (part.includes('LANDMARK:')) {
            return (
                <View key={`p-${idx}`} style={styles.iconTextRow}>
                    <Ionicons name="location-sharp" size={12} color="#FFFFFF" style={styles.icon} />
                    <Text style={styles.tickerText}>{part}</Text>
                </View>
            );
        }
        if (part.startsWith('@') || (part.includes('@') && !part.includes('VENUE') && !part.includes('LANDMARK'))) {
            return (
                <View key={`p-${idx}`} style={styles.iconTextRow}>
                    <Ionicons name="person-sharp" size={12} color="#FFFFFF" style={styles.icon} />
                    <Text style={styles.tickerText}>{part}</Text>
                </View>
            );
        }
        if (part.includes('Views') || /^-?\d+(\.\d+)?(K|M)? Views$/.test(part.trim()) || /^\d+(\.\d+)?(K|M)? Views$/.test(part.trim())) {
            return (
                <View key={`p-${idx}`} style={styles.iconTextRow}>
                    <Ionicons name="eye-sharp" size={12} color="#FFFFFF" style={styles.icon} />
                    <Text style={styles.tickerText}>{part}</Text>
                </View>
            );
        }
        // location or time
        if (!part.includes(':') && part.length > 0 && !part.includes('Views')) {
            return (
                <View key={`p-${idx}`} style={styles.iconTextRow}>
                    <Ionicons name="location-sharp" size={12} color="#FFFFFF" style={styles.icon} />
                    <Text style={styles.tickerText}>{part}</Text>
                </View>
            );
        }
        return <Text key={`p-${idx}`} style={styles.tickerText}>{part}</Text>;
    });
}
export default function FeedPostNewsTicker({ post, carouselIndex = 0 }: Props) {
    const slideCount = tickerSlideCount(post);
    const data = buildFeedPostNewsTicker(post, carouselIndex, slideCount >= 2 ? slideCount : undefined);
    const { background } = badgeColors(data.badgeTone);

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
            <View style={[styles.badge, { backgroundColor: background }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                    {data.badgeLabel}
                </Text>
            </View>
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
                <View style={styles.scrollingRow}>
                    {renderTextWithIcons(tickerText)}
                </View>
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
    badge: {
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 8,
        marginLeft: 12,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'absolute',
        left: 0,
        zIndex: 10,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    animatedTrack: {
        position: 'absolute',
        left: 80,
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
    iconTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        flexShrink: 0,
    },
    icon: {
        marginRight: 4,
    },
    scrollingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        flexShrink: 0,
    },

});
