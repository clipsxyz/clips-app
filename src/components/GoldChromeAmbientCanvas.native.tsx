import React, { useEffect, useId, memo } from 'react';
import {
    AccessibilityInfo,
    AppState,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import HalftoneOverlay from './HalftoneOverlay.native';
import {
    GOLD_CHROME_PALETTE,
    discoverAmbientTimeFromElapsedMs,
    getDiscoverAmbientWaveGeometry,
} from '../utils/discoverAmbientPalette';

const BASE_FILL = '#0a1323';
const palette = GOLD_CHROME_PALETTE;

type Props = {
    width: number;
    height: number;
};

type WaveSvgProps = {
    size: number;
    radius: number;
    gradId: string;
    variant: 'primary' | 'screen';
};

function WaveSvg({ size, radius, gradId, variant }: WaveSvgProps) {
    const isScreen = variant === 'screen';
    return (
        <Svg width={size} height={size}>
            <Defs>
                <RadialGradient
                    id={gradId}
                    cx={radius}
                    cy={radius}
                    fx={radius}
                    fy={radius}
                    r={radius}
                    gradientUnits="userSpaceOnUse"
                >
                    {isScreen ? (
                        <>
                            <Stop offset="0" stopColor={palette.wave2Primary} />
                            <Stop offset="0.5" stopColor={palette.wave2Mid} />
                            <Stop offset="1" stopColor={palette.wave2End} />
                        </>
                    ) : (
                        <>
                            <Stop offset="0" stopColor={palette.wavePrimary} />
                            <Stop offset="0.4" stopColor={palette.waveMid} />
                            <Stop offset="1" stopColor={palette.waveDeep} />
                        </>
                    )}
                </RadialGradient>
            </Defs>
            <Rect
                x={0}
                y={0}
                width={size}
                height={size}
                fill={`url(#${gradId})`}
                {...(isScreen && Platform.OS === 'ios' ? { mixBlendMode: 'screen' as const } : {})}
            />
        </Svg>
    );
}

/**
 * Stories 24 gold/chrome ambient — web DiscoverAmbientCanvas variant="goldChrome".
 * UI-thread motion via Reanimated; parent passes measured size. Memoized so FlatList
 * re-renders do not restart the frame loop.
 */
function GoldChromeAmbientCanvas({ width, height }: Props) {
    const uid = useId().replace(/:/g, '');
    const time = useSharedValue(0);
    const layoutW = useSharedValue(width);
    const layoutH = useSharedValue(height);
    const wave1R = useSharedValue(Math.max(width, height) * 0.85);
    const wave2R = useSharedValue(Math.max(width, height) * 0.85 * 0.55);
    const reducedMotion = useSharedValue(0);
    const paused = useSharedValue(0);

    const r1 = Math.max(width, height) * 0.85;
    const r2 = r1 * 0.55;
    const wave1Size = r1 * 2;
    const wave2Size = r2 * 2;

    useEffect(() => {
        layoutW.value = width;
        layoutH.value = height;
        const r1 = Math.max(width, height) * 0.85;
        wave1R.value = r1;
        wave2R.value = r1 * 0.55;
    }, [width, height, layoutW, layoutH, wave1R, wave2R]);

    useEffect(() => {
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (!mounted) return;
            reducedMotion.value = enabled ? 1 : 0;
            if (enabled) time.value = 0;
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            reducedMotion.value = enabled ? 1 : 0;
            if (enabled) time.value = 0;
        });
        return () => {
            mounted = false;
            sub.remove();
        };
    }, [time, reducedMotion]);

    useEffect(() => {
        const onAppState = (next: string) => {
            paused.value = next === 'active' ? 0 : 1;
        };
        const appSub = AppState.addEventListener('change', onAppState);
        paused.value = AppState.currentState === 'active' ? 0 : 1;
        return () => appSub.remove();
    }, [paused]);

    useFrameCallback((frameInfo) => {
        'worklet';
        if (reducedMotion.value === 1 || paused.value === 1) return;
        // Wall-clock sync to web (+0.006 per ~16.67ms), not per-callback increment.
        time.value = discoverAmbientTimeFromElapsedMs(frameInfo.timeSinceFirstFrame);
    });

    const wave1Style = useAnimatedStyle(() => {
        'worklet';
        const geo = getDiscoverAmbientWaveGeometry(layoutW.value, layoutH.value, time.value);
        const r = wave1R.value;
        return {
            transform: [
                { translateX: geo.wave1.x - r },
                { translateY: geo.wave1.y - r },
            ],
        };
    });

    const wave2Style = useAnimatedStyle(() => {
        'worklet';
        const geo = getDiscoverAmbientWaveGeometry(layoutW.value, layoutH.value, time.value);
        const r = wave2R.value;
        return {
            transform: [
                { translateX: geo.wave2.x - r },
                { translateY: geo.wave2.y - r },
            ],
        };
    });

    if (width <= 0 || height <= 0) return null;

    return (
        <View
            style={[styles.layer, { width, height }]}
            pointerEvents="none"
            collapsable={false}
        >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_FILL }]} />
            <Animated.View
                style={[
                    styles.blob,
                    { width: wave1Size, height: wave1Size },
                    wave1Style,
                ]}
            >
                <WaveSvg
                    size={wave1Size}
                    radius={r1}
                    gradId={`${uid}-wave1`}
                    variant="primary"
                />
            </Animated.View>
            <Animated.View
                style={[
                    styles.blob,
                    {
                        width: wave2Size,
                        height: wave2Size,
                        opacity: Platform.OS === 'android' ? 0.88 : 1,
                    },
                    wave2Style,
                ]}
            >
                <WaveSvg
                    size={wave2Size}
                    radius={r2}
                    gradId={`${uid}-wave2`}
                    variant="screen"
                />
            </Animated.View>
            <HalftoneOverlay
                variant="goldChrome"
                width={width}
                height={height}
                idPrefix={uid}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
});

export default memo(
    GoldChromeAmbientCanvas,
    (prev, next) => prev.width === next.width && prev.height === next.height,
);
