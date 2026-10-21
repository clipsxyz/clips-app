import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { hasFinitePoint, safeLayoutNumber } from '../utils/safeLayoutNative';

const LINE_COUNT = 36;
const BURST_SIZE = 200;
const THUMB_SIZE = 96;

/** Radiating lines — web ShortsLikeBurstLines parity. */
function BurstLines() {
    // One <Path> per stroke color keeps the same radiating spokes at 2 native
    // views instead of 36, so mounting the burst can't jank the TextureView video.
    const { bright, soft } = useMemo(() => {
        const cx = 50;
        const cy = 50;
        let bright = '';
        let soft = '';
        for (let i = 0; i < LINE_COUNT; i++) {
            const angle = ((i * 360) / LINE_COUNT) * (Math.PI / 180);
            const r = 38 + (i % 3) * 4;
            const x2 = (cx + r * Math.cos(angle)).toFixed(3);
            const y2 = (cy + r * Math.sin(angle)).toFixed(3);
            const segment = `M50,50L${x2},${y2}`;
            if (i % 2 === 0) bright += segment;
            else soft += segment;
        }
        return { bright, soft };
    }, []);

    return (
        <Svg width={BURST_SIZE} height={BURST_SIZE} viewBox="0 0 100 100">
            <G strokeLinecap="round" fill="none">
                <Path d={bright} stroke="#ff1744" strokeWidth={2.2} />
                <Path d={soft} stroke="#f48fb1" strokeWidth={1.6} />
            </G>
        </Svg>
    );
}

type Props = {
    x: number;
    y: number;
    onDone?: () => void;
};

/** YouTube Shorts-style double-tap burst at the tap point (same as text-only cards). */
export default function FeedDoubleTapLikeBurst({ x, y, onDone }: Props) {
    const glowScale = useRef(new Animated.Value(0.4)).current;
    const glowOpacity = useRef(new Animated.Value(0)).current;
    const thumbScale = useRef(new Animated.Value(0.3)).current;
    const thumbOpacity = useRef(new Animated.Value(0)).current;

    const left = safeLayoutNumber(x, 0);
    const top = safeLayoutNumber(y, 0);
    const canPlace = hasFinitePoint(left, top);

    useEffect(() => {
        if (!canPlace) {
            onDone?.();
            return;
        }
        // Reset so remounts (new key) always animate from hidden → visible.
        glowOpacity.setValue(0);
        glowScale.setValue(0.4);
        thumbOpacity.setValue(0);
        thumbScale.setValue(0.3);

        Animated.parallel([
            Animated.sequence([
                Animated.timing(glowOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
                Animated.timing(glowOpacity, { toValue: 0, duration: 410, useNativeDriver: true }),
            ]),
            Animated.timing(glowScale, { toValue: 1.15, duration: 500, useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(thumbOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
                Animated.delay(280),
                Animated.timing(thumbOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.spring(thumbScale, {
                    toValue: 1,
                    speed: 12,
                    bounciness: 8,
                    useNativeDriver: true,
                }),
                Animated.delay(280),
                Animated.timing(thumbScale, { toValue: 0.95, duration: 190, useNativeDriver: true }),
            ]),
        ]).start(({ finished }) => {
            if (finished) onDone?.();
        });
    }, [canPlace, glowOpacity, glowScale, onDone, thumbOpacity, thumbScale]);

    if (!canPlace) return null;

    return (
        <View style={[styles.root, { left, top }]} pointerEvents="none" collapsable={false}>
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
                {/* Ionicons thumbs-up — same glyph path text-only cards use successfully. */}
                <Icon
                    name="thumbs-up"
                    size={64}
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
        zIndex: 1000,
        elevation: Platform.OS === 'android' ? 1000 : 0,
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
    },
    thumbAndroid: {
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
});
