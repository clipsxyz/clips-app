import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { G, Line } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';

const LINE_COUNT = 36;
const BURST_SIZE = 200;
const THUMB_SIZE = 96;

/** Radiating lines — web ShortsLikeBurstLines parity. */
function BurstLines() {
    const lines = useMemo(() => {
        const cx = 50;
        const cy = 50;
        return Array.from({ length: LINE_COUNT }, (_, i) => {
            const angle = ((i * 360) / LINE_COUNT) * (Math.PI / 180);
            const r = 38 + (i % 3) * 4;
            return {
                x2: cx + r * Math.cos(angle),
                y2: cy + r * Math.sin(angle),
                stroke: i % 2 === 0 ? '#ff1744' : '#f48fb1',
                strokeWidth: i % 2 === 0 ? 2.2 : 1.6,
            };
        });
    }, []);

    return (
        <Svg width={BURST_SIZE} height={BURST_SIZE} viewBox="0 0 100 100">
            <G strokeLinecap="round">
                {lines.map((line, i) => (
                    <Line
                        key={i}
                        x1={50}
                        y1={50}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={line.stroke}
                        strokeWidth={line.strokeWidth}
                    />
                ))}
            </G>
        </Svg>
    );
}

type Props = {
    x: number;
    y: number;
    onDone?: () => void;
};

/** In-bubble double-tap burst (web TextCard tapPosition + heartPopUp / shortsThumbGlow). */
export default function FeedDoubleTapLikeBurst({ x, y, onDone }: Props) {
    const glowScale = useRef(new Animated.Value(0.4)).current;
    const glowOpacity = useRef(new Animated.Value(0)).current;
    const thumbScale = useRef(new Animated.Value(0.3)).current;
    const thumbOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.sequence([
                Animated.timing(glowOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
                Animated.timing(glowOpacity, { toValue: 0, duration: 410, useNativeDriver: true }),
            ]),
            Animated.timing(glowScale, { toValue: 1.15, duration: 500, useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(thumbOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
                Animated.delay(250),
                Animated.timing(thumbOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.spring(thumbScale, { toValue: 1, speed: 12, bounciness: 8, useNativeDriver: true }),
                Animated.delay(250),
                Animated.timing(thumbScale, { toValue: 0.95, duration: 190, useNativeDriver: true }),
            ]),
        ]).start(({ finished }) => {
            if (finished) onDone?.();
        });
    }, [glowOpacity, glowScale, onDone, thumbOpacity, thumbScale]);

    return (
        <View style={[styles.root, { left: x, top: y }]} pointerEvents="none">
            <Animated.View
                style={[
                    styles.glowWrap,
                    { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
            >
                <BurstLines />
            </Animated.View>
            <Animated.View
                style={[
                    styles.thumbWrap,
                    { opacity: thumbOpacity, transform: [{ scale: thumbScale }] },
                ]}
            >
                <Icon name="thumbs-up" size={56} color="#FFFFFF" />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        zIndex: 50,
        width: 0,
        height: 0,
    },
    glowWrap: {
        position: 'absolute',
        width: BURST_SIZE,
        height: BURST_SIZE,
        left: -BURST_SIZE / 2,
        top: -BURST_SIZE / 2,
    },
    thumbWrap: {
        position: 'absolute',
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        left: -THUMB_SIZE / 2,
        top: -THUMB_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
});
