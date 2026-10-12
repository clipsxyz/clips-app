import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import type { Post } from '../types';
import {
    buildFeedPostNewsTicker,
    tickerSlideCount,
    TICKER_SEGMENT_GAP,
    type NewsTickerSegment,
    type NewsTickerSegmentKind,
} from '../utils/feedPostNewsTicker';

const TICKER_HEIGHT = 34;
const ICON_SIZE = 12;
const ICON_TEXT_GAP = 8;

type Props = {
    post: Post;
    carouselIndex?: number;
};

function SegmentIcon({ kind }: { kind: NewsTickerSegmentKind }): React.ReactElement | null {
    switch (kind) {
        case 'location':
            return <Ionicons name="location-sharp" size={ICON_SIZE} color="#FFFFFF" />;
        case 'venue':
            return <Ionicons name="business-sharp" size={ICON_SIZE} color="#FFFFFF" />;
        case 'landmark':
            return <FontAwesome5 name="landmark" size={ICON_SIZE - 1} color="#FFFFFF" />;
        case 'tagged':
            return <Ionicons name="person-sharp" size={ICON_SIZE} color="#FFFFFF" />;
        case 'views':
            return <Ionicons name="eye-sharp" size={ICON_SIZE} color="#FFFFFF" />;
        case 'timestamp':
            return <Ionicons name="time-outline" size={ICON_SIZE} color="#FFFFFF" />;
        case 'author':
        default:
            return null;
    }
}

function renderSegments(segments: NewsTickerSegment[], passKey: string): React.ReactNode {
    return segments.map((segment, idx) => {
        const icon = <SegmentIcon kind={segment.kind} />;
        return (
            <React.Fragment key={`${passKey}-${segment.kind}-${idx}`}>
                {idx > 0 ? <Text style={styles.gap}>{TICKER_SEGMENT_GAP}</Text> : null}
                <View style={styles.segment}>
                    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
                    <Text style={styles.tickerText} numberOfLines={1}>
                        {segment.text}
                    </Text>
                </View>
            </React.Fragment>
        );
    });
}

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
                <View
                    style={styles.measureRow}
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                    pointerEvents="none"
                >
                    {renderSegments(data.segments, 'm')}
                    <Text style={styles.gap}>{TICKER_SEGMENT_GAP}</Text>
                </View>
                <View style={styles.scrollingRow}>
                    {renderSegments(data.segments, 'a')}
                    <Text style={styles.gap}>{TICKER_SEGMENT_GAP}</Text>
                    {renderSegments(data.segments, 'b')}
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
    animatedTrack: {
        position: 'absolute',
        left: 0,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        width: 9999,
        flexShrink: 0,
    },
    scrollingRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        flexShrink: 0,
    },
    segment: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        flexShrink: 0,
    },
    iconWrap: {
        marginRight: ICON_TEXT_GAP,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tickerText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
        flexShrink: 0,
    },
    gap: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
        flexShrink: 0,
    },
    measureRow: {
        position: 'absolute',
        left: 0,
        top: 0,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        opacity: 0,
    },
});
