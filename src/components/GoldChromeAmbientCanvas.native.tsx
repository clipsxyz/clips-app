import React, { useEffect, useId, memo } from 'react';
import {
    AccessibilityInfo,
    AppState,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import HalftoneOverlay from './HalftoneOverlay.native';
import { clampSvgSide } from '../utils/androidSafeSvgNative';
import { safePositiveLayoutNumber } from '../utils/safeLayoutNative';
import {
    GOLD_CHROME_PALETTE,
    discoverAmbientTimeFromElapsedMs,
    getDiscoverAmbientWaveGeometry,
} from '../utils/discoverAmbientPalette';

const BASE_FILL = '#0a1323';
const palette = GOLD_CHROME_PALETTE;
const ANDROID_MAX_WAVE_SIDE = 320;
/** High-dpi Android: skip SVG waves entirely (Canvas ~175MB crash at 480dpi). */
const ANDROID_LITE = Platform.OS === 'android';

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
                        [
                            <Stop key="s0" offset="0" stopColor={palette.wave2Primary} />,
                            <Stop key="s1" offset="0.5" stopColor={palette.wave2Mid} />,
                            <Stop key="s2" offset="1" stopColor={palette.wave2End} />,
                        ]
                    ) : (
                        [
                            <Stop key="p0" offset="0" stopColor={palette.wavePrimary} />,
                            <Stop key="p1" offset="0.4" stopColor={palette.waveMid} />,
                            <Stop key="p2" offset="1" stopColor={palette.waveDeep} />,
                        ]
                    )}
                </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={size} height={size} fill={`url(#${gradId})`} />
        </Svg>
    );
}

function AndroidLiteAmbient({ width, height }: { width: number; height: number }) {
    const blobW = Math.round(width * 0.75);
    const blobH = Math.round(height * 0.6);
    const blob2W = Math.round(width * 0.7);
    const blob2H = Math.round(height * 0.55);
    return (
        <View style={[styles.layer, { width, height }]} pointerEvents="none" collapsable={false}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_FILL }]} />
            <LinearGradient
                colors={[palette.wavePrimary, 'transparent']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[
                    styles.liteBlob,
                    {
                        width: blobW,
                        height: blobH,
                        top: -Math.round(height * 0.05),
                        left: -Math.round(width * 0.05),
                    },
                ]}
            />
            <LinearGradient
                colors={[palette.wave2Primary, 'transparent']}
                start={{ x: 0.9, y: 0.1 }}
                end={{ x: 0.2, y: 1 }}
                style={[
                    styles.liteBlob,
                    {
                        width: blob2W,
                        height: blob2H,
                        top: Math.round(height * 0.3),
                        left: Math.round(width * 0.25),
                        opacity: 0.35,
                    },
                ]}
            />
        </View>
    );
}

/**
 * Stories 24 gold/chrome ambient — web DiscoverAmbientCanvas variant="goldChrome".
 * On Android uses LinearGradient only — SVG waves crash at 480dpi (~175MB bitmaps).
 */
function GoldChromeAmbientCanvas({ width: widthProp, height: heightProp }: Props) {
    const width = safePositiveLayoutNumber(widthProp, 0);
    const height = safePositiveLayoutNumber(heightProp, 0);
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
    const layoutWave1 = r1 * 2;
    const layoutWave2 = r2 * 2;
    const wave1SvgSize = clampSvgSide(
        Platform.OS === 'android' ? Math.min(layoutWave1, ANDROID_MAX_WAVE_SIDE) : layoutWave1,
    );
    const wave2SvgSize = clampSvgSide(
        Platform.OS === 'android' ? Math.min(layoutWave2, ANDROID_MAX_WAVE_SIDE) : layoutWave2,
    );
    const wave1Scale = layoutWave1 > 0 ? layoutWave1 / wave1SvgSize : 1;
    const wave2Scale = layoutWave2 > 0 ? layoutWave2 / wave2SvgSize : 1;

    useEffect(() => {
        layoutW.value = width;
        layoutH.value = height;
        const nextR1 = Math.max(width, height) * 0.85;
        wave1R.value = nextR1;
        wave2R.value = nextR1 * 0.55;
    }, [width, height, layoutW, layoutH, wave1R, wave2R]);

    useEffect(() => {
        if (ANDROID_LITE) return;
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
        if (ANDROID_LITE) return;
        const onAppState = (next: string) => {
            paused.value = next === 'active' ? 0 : 1;
        };
        const appSub = AppState.addEventListener('change', onAppState);
        paused.value = AppState.currentState === 'active' ? 0 : 1;
        return () => appSub.remove();
    }, [paused]);

    useFrameCallback((frameInfo) => {
        'worklet';
        if (ANDROID_LITE) return;
        if (reducedMotion.value === 1 || paused.value === 1) return;
        time.value = discoverAmbientTimeFromElapsedMs(frameInfo.timeSinceFirstFrame);
    });

    const wave1Style = useAnimatedStyle(() => {
        'worklet';
        if (ANDROID_LITE) return {};
        const geo = getDiscoverAmbientWaveGeometry(layoutW.value, layoutH.value, time.value);
        const half = wave1SvgSize / 2;
        return {
            transform: [
                { translateX: geo.wave1.x - half },
                { translateY: geo.wave1.y - half },
                { scale: wave1Scale },
            ],
        };
    });

    const wave2Style = useAnimatedStyle(() => {
        'worklet';
        if (ANDROID_LITE) return {};
        const geo = getDiscoverAmbientWaveGeometry(layoutW.value, layoutH.value, time.value);
        const half = wave2SvgSize / 2;
        return {
            transform: [
                { translateX: geo.wave2.x - half },
                { translateY: geo.wave2.y - half },
                { scale: wave2Scale },
            ],
        };
    });

    if (width <= 0 || height <= 0) return null;
    if (ANDROID_LITE) return <AndroidLiteAmbient width={width} height={height} />;

    return (
        <View style={[styles.layer, { width, height }]} pointerEvents="none" collapsable={false}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_FILL }]} />
            <Animated.View
                style={[styles.blob, { width: wave1SvgSize, height: wave1SvgSize }, wave1Style]}
            >
                <WaveSvg
                    size={wave1SvgSize}
                    radius={wave1SvgSize / 2}
                    gradId={`${uid}-wave1`}
                    variant="primary"
                />
            </Animated.View>
            <Animated.View
                style={[styles.blob, { width: wave2SvgSize, height: wave2SvgSize }, wave2Style]}
            >
                <WaveSvg
                    size={wave2SvgSize}
                    radius={wave2SvgSize / 2}
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
        ...StyleSheet.absoluteFill,
        zIndex: 0,
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    liteBlob: {
        position: 'absolute',
        opacity: 0.5,
        borderRadius: 999,
    },
});

export default memo(
    GoldChromeAmbientCanvas,
    (prev, next) => prev.width === next.width && prev.height === next.height,
);
