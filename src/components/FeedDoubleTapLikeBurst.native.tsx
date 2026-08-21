import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Line } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { hasFinitePoint, safeLayoutNumber } from '../utils/safeLayoutNative';

const LINE_COUNT = 36;
const BURST_SIZE = 220;
const THUMB_SIZE = 88;

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
    x?: number;
    y?: number;
    /** Fill parent and sit in the middle of the media (feed card). */
    centered?: boolean;
    onDone?: () => void;
};

/** YouTube Shorts-style double-tap burst at the tap point or media center. */
export default function FeedDoubleTapLikeBurst({ x = 0, y = 0, centered = false, onDone }: Props) {
    const glowScale = useRef(new Animated.Value(0.55)).current;
    const glowOpacity = useRef(new Animated.Value(1)).current;
    const thumbScale = useRef(new Animated.Value(0.55)).current;
    const thumbOpacity = useRef(new Animated.Value(1)).current;

    const left = safeLayoutNumber(x, 0);
    const top = safeLayoutNumber(y, 0);
    const canPlace = centered || hasFinitePoint(left, top);

    useEffect(() => {
        if (!canPlace) {
            onDone?.();
            return;
        }
        glowOpacity.setValue(1);
        glowScale.setValue(0.55);
        thumbOpacity.setValue(1);
        thumbScale.setValue(0.55);

        Animated.parallel([
            Animated.sequence([
                Animated.timing(glowOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
                Animated.timing(glowOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
            ]),
            Animated.timing(glowScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
            Animated.sequence([
                Animated.spring(thumbScale, {
                    toValue: 1,
                    speed: 14,
                    bounciness: 10,
                    useNativeDriver: true,
                }),
                Animated.delay(220),
                Animated.timing(thumbScale, { toValue: 0.9, duration: 180, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.delay(320),
                Animated.timing(thumbOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]),
        ]).start(({ finished }) => {
            if (finished) onDone?.();
        });
    }, [canPlace, glowOpacity, glowScale, onDone, thumbOpacity, thumbScale]);

    if (!canPlace) return null;

    return (
        <View
            style={
                centered
                    ? styles.centeredRoot
                    : [
                          styles.root,
                          {
                              left: left - BURST_SIZE / 2,
                              top: top - BURST_SIZE / 2,
                              width: BURST_SIZE,
                              height: BURST_SIZE,
                          },
                      ]
            }
            pointerEvents="none"
            collapsable={false}
        >
            <Animated.View
                style={[
                    styles.glowWrap,
                    { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
                pointerEvents="none"
            >
                <BurstLines />
            </Animated.View>
            <Animated.View
                style={[
                    styles.thumbWrap,
                    { opacity: thumbOpacity, transform: [{ scale: thumbScale }] },
                ]}
                pointerEvents="none"
            >
                <Icon
                    name="thumbs-up"
                    size={72}
                    color="#FFFFFF"
                    style={Platform.OS === 'android' ? styles.thumbAndroid : undefined}
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        zIndex: 9999,
        overflow: 'visible',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowWrap: {
        position: 'absolute',
        width: BURST_SIZE,
        height: BURST_SIZE,
        left: 0,
        top: 0,
    },
    centeredRoot: {
        width: BURST_SIZE,
        height: BURST_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbWrap: {
        position: 'absolute',
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        left: (BURST_SIZE - THUMB_SIZE) / 2,
        top: (BURST_SIZE - THUMB_SIZE) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbAndroid: {
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
});
