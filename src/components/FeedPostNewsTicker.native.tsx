import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import type { Post } from '../types';
import {
    buildFeedPostNewsTicker,
    tickerSlideCount,
    TICKER_SEGMENT_GAP,
    type NewsTickerSegment,
    type NewsTickerSegmentKind,
} from '../utils/feedPostNewsTicker';

const TICKER_HEIGHT = 32;
const ICON_SIZE = 10;

type Props = {
    post: Post;
    carouselIndex?: number;
};

function segmentKicker(kind: NewsTickerSegmentKind): string {
    switch (kind) {
        case 'location':
            return 'Place';
        case 'venue':
            return 'Venue';
        case 'landmark':
            return 'Landmark';
        case 'tagged':
            return 'Tagged';
        case 'views':
            return 'Views';
        case 'timestamp':
            return 'Posted';
        case 'author':
        default:
            return 'Author';
    }
}

function SegmentIcon({ kind }: { kind: NewsTickerSegmentKind }): React.ReactElement {
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
            return <Ionicons name="person-circle-outline" size={ICON_SIZE} color="#FFFFFF" />;
    }
}

function renderSegments(segments: NewsTickerSegment[], passKey: string): React.ReactNode {
    return segments.map((segment, idx) => (
        <React.Fragment key={`${passKey}-${segment.kind}-${idx}`}>
            {idx > 0 ? <Text style={styles.gap}>{TICKER_SEGMENT_GAP}</Text> : null}
            <View style={styles.segment}>
                <View style={styles.iconWell}>
                    <SegmentIcon kind={segment.kind} />
                </View>
                <View style={styles.textCol}>
                    <Text style={styles.kicker} numberOfLines={1}>
                        {segmentKicker(segment.kind)}
                    </Text>
                    <Text style={styles.title} numberOfLines={1}>
                        {segment.text}
                    </Text>
                </View>
            </View>
        </React.Fragment>
    ));
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
        alignSelf: 'stretch',
        width: '100%',
        height: TICKER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
    },
    animatedTrack: {
        position: 'absolute',
        left: 12,
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
        paddingLeft: 6,
        paddingRight: 8,
    },
    iconWell: {
        width: 18,
        height: 18,
        borderRadius: 9,
        marginRight: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.28)',
        overflow: 'hidden',
    },
    textCol: {
        flexShrink: 0,
        justifyContent: 'center',
    },
    kicker: {
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 7,
        lineHeight: 8,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '700',
        flexShrink: 0,
    },
    gap: {
        color: '#FFFFFF',
        fontSize: 10,
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
