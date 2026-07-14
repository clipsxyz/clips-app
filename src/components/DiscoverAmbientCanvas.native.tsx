import React, { useEffect, useId, memo, useState } from 'react';
import {
    AccessibilityInfo,
    AppState,
    LayoutChangeEvent,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import HalftoneOverlay from './HalftoneOverlay.native';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import {
    discoverAmbientTimeFromElapsedMs,
    getAmbientPalette,
    getDiscoverAmbientWaveGeometry,
    type AmbientPalette,
    type DiscoverAmbientVariant,
} from '../utils/discoverAmbientPalette';

type Props = {
    /** Fill the parent (feed card). When false, uses explicit or window size. */
    fillParent?: boolean;
    variant?: DiscoverAmbientVariant;
    /** Explicit pixel size — used for full-screen feed background (from parent onLayout). */
    width?: number;
    height?: number;
};

const GOLD_CHROME_BASE = '#0a1323';
/** Android SVG cannot apply screen blend reliably — approximate web wave-2 intensity. */
const ANDROID_SCREEN_WAVE_OPACITY: Record<DiscoverAmbientVariant, number> = {
    discover: 0.92,
    goldChrome: 0.88,
};

type WaveSvgProps = {
    size: number;
    radius: number;
    gradId: string;
    layer: 'primary' | 'screen';
    palette: AmbientPalette;
};

function WaveSvg({ size, radius, gradId, layer, palette }: WaveSvgProps) {
    const isScreen = layer === 'screen';
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

type AmbientWaveLayerProps = {
    width: number;
    height: number;
    variant: DiscoverAmbientVariant;
};

/**
 * Web parity: same wave geometry + palette as `drawDiscoverAmbientWave`, but painted as
 * moving radial blobs on the UI thread (Reanimated). Matches GoldChromeAmbientCanvas and
 * avoids Android SVG full-canvas blend/perf issues.
 */
function AmbientWaveLayer({ width, height, variant }: AmbientWaveLayerProps) {
    const uid = useId().replace(/:/g, '');
    const palette = getAmbientPalette(variant);
    const baseFill = variant === 'goldChrome' ? GOLD_CHROME_BASE : GAZETTEER_ABYSS;

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
        const nextR1 = Math.max(width, height) * 0.85;
        wave1R.value = nextR1;
        wave2R.value = nextR1 * 0.55;
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

    const androidScreenOpacity =
        Platform.OS === 'android' ? ANDROID_SCREEN_WAVE_OPACITY[variant] : 1;

    return (
        <View
            style={[styles.layer, { width, height }]}
            pointerEvents="none"
            collapsable={false}
        >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: baseFill }]} />
            <Animated.View
                style={[styles.blob, { width: wave1Size, height: wave1Size }, wave1Style]}
            >
                <WaveSvg
                    size={wave1Size}
                    radius={r1}
                    gradId={`${uid}-wave1`}
                    layer="primary"
                    palette={palette}
                />
            </Animated.View>
            <Animated.View
                style={[
                    styles.blob,
                    {
                        width: wave2Size,
                        height: wave2Size,
                        opacity: androidScreenOpacity,
                    },
                    wave2Style,
                ]}
            >
                <WaveSvg
                    size={wave2Size}
                    radius={r2}
                    gradId={`${uid}-wave2`}
                    layer="screen"
                    palette={palette}
                />
            </Animated.View>
            <HalftoneOverlay
                variant={variant}
                width={width}
                height={height}
                idPrefix={uid}
            />
        </View>
    );
}

const MemoAmbientWaveLayer = memo(
    AmbientWaveLayer,
    (prev, next) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.variant === next.variant,
);

export default function DiscoverAmbientCanvas({
    fillParent = true,
    variant = 'discover',
    width: widthProp,
    height: heightProp,
}: Props) {
    const { width: winW, height: winH } = useWindowDimensions();
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const width =
        widthProp && widthProp > 0 ? widthProp : fillParent ? layout.width : winW;
    const height =
        heightProp && heightProp > 0 ? heightProp : fillParent ? layout.height : winH;

    const useParentLayout = fillParent && !(widthProp && heightProp);
    const ready = width > 0 && height > 0;

    const onLayout = (e: LayoutChangeEvent) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0) setLayout({ width: w, height: h });
    };

    if (useParentLayout && !ready) {
        return (
            <View
                style={styles.parentClip}
                onLayout={onLayout}
                pointerEvents="none"
                collapsable={false}
            />
        );
    }

    if (!ready) return null;

    const layer = <MemoAmbientWaveLayer width={width} height={height} variant={variant} />;

    if (useParentLayout) {
        return (
            <View
                style={styles.parentClip}
                onLayout={onLayout}
                pointerEvents="none"
                collapsable={false}
            >
                {layer}
            </View>
        );
    }

    return layer;
}

const styles = StyleSheet.create({
    parentClip: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
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
