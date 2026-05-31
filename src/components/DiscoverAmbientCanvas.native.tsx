import React, { useEffect, useId, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    AppState,
    LayoutChangeEvent,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import HalftoneOverlay from './HalftoneOverlay.native';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import {
    getAmbientPalette,
    getDiscoverAmbientWaveGeometry,
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

const TIME_STEP_PER_MS = 0.006 / (1000 / 60);
const FRAME_MS = Platform.OS === 'android' ? 33 : 16;
/** Stories 24 card shell background — matches rail inner fill. */
const GOLD_CHROME_BASE = '#0a1323';

export default function DiscoverAmbientCanvas({
    fillParent = true,
    variant = 'discover',
    width: widthProp,
    height: heightProp,
}: Props) {
    const { width: winW, height: winH } = useWindowDimensions();
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const [time, setTime] = useState(0);
    const timeRef = useRef(0);
    const frameRef = useRef<number | undefined>(undefined);
    const lastFrameAtRef = useRef(0);
    const pausedRef = useRef(false);
    const reducedMotionRef = useRef(false);
    const uid = useId().replace(/:/g, '');

    const width =
        widthProp && widthProp > 0
            ? widthProp
            : fillParent
              ? layout.width
              : winW;
    const height =
        heightProp && heightProp > 0
            ? heightProp
            : fillParent
              ? layout.height
              : winH;

    const palette = getAmbientPalette(variant);
    const baseFill = variant === 'goldChrome' ? GOLD_CHROME_BASE : GAZETTEER_ABYSS;
    const geometry =
        width > 0 && height > 0 ? getDiscoverAmbientWaveGeometry(width, height, time) : null;
    const useParentLayout = fillParent && !(widthProp && heightProp);

    useEffect(() => {
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (!mounted) return;
            reducedMotionRef.current = enabled;
            if (enabled) {
                timeRef.current = 0;
                setTime(0);
            }
        });
        const reduceSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            reducedMotionRef.current = enabled;
            if (enabled) {
                timeRef.current = 0;
                setTime(0);
            }
        });
        return () => {
            mounted = false;
            reduceSub.remove();
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const stopLoop = () => {
            if (frameRef.current != null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = undefined;
            }
        };

        const startLoop = () => {
            stopLoop();
            lastFrameAtRef.current = 0;
            const tick = (now: number) => {
                if (!mounted) return;
                if (!pausedRef.current && !reducedMotionRef.current && width > 0 && height > 0) {
                    if (lastFrameAtRef.current === 0) {
                        lastFrameAtRef.current = now;
                    }
                    if (now - lastFrameAtRef.current >= FRAME_MS) {
                        const delta = now - lastFrameAtRef.current;
                        lastFrameAtRef.current = now;
                        timeRef.current += TIME_STEP_PER_MS * delta;
                        setTime(timeRef.current);
                    }
                }
                frameRef.current = requestAnimationFrame(tick);
            };
            frameRef.current = requestAnimationFrame(tick);
        };

        const onAppState = (next: string) => {
            pausedRef.current = next !== 'active';
            if (pausedRef.current) {
                stopLoop();
            } else {
                startLoop();
            }
        };

        const sub = AppState.addEventListener('change', onAppState);
        pausedRef.current = AppState.currentState !== 'active';

        if (reducedMotionRef.current) {
            timeRef.current = 0;
            setTime(0);
        } else if (!pausedRef.current) {
            startLoop();
        }

        return () => {
            mounted = false;
            sub.remove();
            stopLoop();
        };
    }, [width, height]);

    const onLayout = (e: LayoutChangeEvent) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0) setLayout({ width: w, height: h });
    };

    const waveShell =
        width > 0 && height > 0 && geometry ? (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                    <RadialGradient
                        id={`${uid}-wave1`}
                        gradientUnits="userSpaceOnUse"
                        cx={geometry.wave1.x}
                        cy={geometry.wave1.y}
                        fx={geometry.wave1.x}
                        fy={geometry.wave1.y}
                        r={geometry.wave1.radius}
                    >
                        <Stop offset="0" stopColor={palette.wavePrimary} />
                        <Stop offset="0.4" stopColor={palette.waveMid} />
                        <Stop offset="1" stopColor={palette.waveDeep} />
                    </RadialGradient>
                    <RadialGradient
                        id={`${uid}-wave2`}
                        gradientUnits="userSpaceOnUse"
                        cx={geometry.wave2.x}
                        cy={geometry.wave2.y}
                        fx={geometry.wave2.x}
                        fy={geometry.wave2.y}
                        r={geometry.wave2.radius}
                    >
                        <Stop offset="0" stopColor={palette.wave2Primary} />
                        <Stop offset="0.5" stopColor={palette.wave2Mid} />
                        <Stop offset="1" stopColor={palette.wave2End} />
                    </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} fill={baseFill} />
                <Rect x={0} y={0} width={width} height={height} fill={`url(#${uid}-wave1)`} />
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    fill={`url(#${uid}-wave2)`}
                    mixBlendMode="screen"
                />
            </Svg>
        ) : null;

    const shell = (
        <View
            style={[StyleSheet.absoluteFill, { width, height }]}
            pointerEvents="none"
            {...(Platform.OS === 'android' ? { needsOffscreenAlphaCompositing: true } : {})}
        >
            {waveShell}
            <HalftoneOverlay variant={variant} width={width} height={height} idPrefix={uid} />
        </View>
    );

    if (useParentLayout) {
        return (
            <View
                style={StyleSheet.absoluteFill}
                onLayout={onLayout}
                pointerEvents="none"
                collapsable={false}
            >
                {shell}
            </View>
        );
    }

    return (
        <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none" collapsable={false}>
            {shell}
        </View>
    );
}
