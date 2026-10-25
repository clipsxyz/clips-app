import React, { useEffect, useState } from 'react';
import {
    AccessibilityInfo,
    AppState,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import {
    discoverAmbientTimeFromElapsedMs,
    getAmbientPalette,
    getDiscoverAmbientWaveGeometry,
    AUTH_ABYSS,
    PASSPORT_ABYSS,
    type DiscoverAmbientVariant,
} from '../utils/discoverAmbientPalette';

type Props = {
    fillParent?: boolean;
    variant?: DiscoverAmbientVariant;
    width?: number;
    height?: number;
};

const GOLD_CHROME_BASE = '#0a1323';

/**
 * JS-thread ambient only — no Reanimated, no LinearGradient, no SVG.
 * Those native surfaces were painting above Discover greeting/search on Nokia.
 */
export default function DiscoverAmbientCanvas({
    fillParent = true,
    variant = 'discover',
    width: widthProp,
    height: heightProp,
}: Props) {
    const { width: winW, height: winH } = useWindowDimensions();
    const width = widthProp && widthProp > 0 ? widthProp : winW;
    const height = heightProp && heightProp > 0 ? heightProp : winH;
    const palette = getAmbientPalette(variant);
    const baseFill =
        variant === 'goldChrome'
            ? GOLD_CHROME_BASE
            : variant === 'passport'
              ? PASSPORT_ABYSS
              : variant === 'auth'
                ? AUTH_ABYSS
                : GAZETTEER_ABYSS;

    const [tick, setTick] = useState(0);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [paused, setPaused] = useState(false);
    // Track focus through navigation events (not render state): a blurred screen is also
    // frozen by freezeOnBlur, so a React-effect cleanup would not run to stop the timer.
    // The listener fires regardless, letting the interval callback bail when off-screen.
    const navigation = useNavigation();
    const focusedRef = React.useRef(true);

    useEffect(() => {
        let mounted = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) setReduceMotion(!!enabled);
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            setReduceMotion(!!enabled);
        });
        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    useEffect(() => {
        const onAppState = (next: string) => setPaused(next !== 'active');
        const appSub = AppState.addEventListener('change', onAppState);
        setPaused(AppState.currentState !== 'active');
        return () => appSub.remove();
    }, []);

    useEffect(() => {
        // Seed from the current focus then keep the ref in sync via navigation events.
        focusedRef.current = navigation.isFocused();
        const unsubFocus = navigation.addListener('focus', () => {
            focusedRef.current = true;
        });
        const unsubBlur = navigation.addListener('blur', () => {
            focusedRef.current = false;
        });
        return () => {
            unsubFocus();
            unsubBlur();
        };
    }, [navigation]);

    useEffect(() => {
        // Backgrounded screens don't tick (AppState). Off-screen (blurred) screens are
        // frozen, so we can't rely on effect cleanup — instead the interval callback
        // bails via focusedRef, keeping a ~21fps setState loop off a hidden screen.
        if (reduceMotion || paused || width <= 0 || height <= 0) return;
        const started = Date.now();
        const id = setInterval(() => {
            if (!focusedRef.current) return;
            setTick(discoverAmbientTimeFromElapsedMs(Date.now() - started));
        }, 48);
        return () => clearInterval(id);
    }, [reduceMotion, paused, width, height]);

    if (width <= 0 || height <= 0) return null;

    const geo = getDiscoverAmbientWaveGeometry(width, height, tick);
    const r1 = geo.wave1.radius * 0.65;
    const r2 = geo.wave2.radius * 0.85;

    const layer = (
        <View
            style={[styles.layer, { width, height, backgroundColor: baseFill }]}
            pointerEvents="none"
            collapsable={false}
        >
            <View
                style={[
                    styles.blob,
                    {
                        width: r1 * 2,
                        height: r1 * 2,
                        borderRadius: r1,
                        left: geo.wave1.x - r1,
                        top: geo.wave1.y - r1,
                        backgroundColor: palette.wavePrimary,
                        opacity: 0.38,
                    },
                ]}
            />
            <View
                style={[
                    styles.blob,
                    {
                        width: r2 * 2,
                        height: r2 * 2,
                        borderRadius: r2,
                        left: geo.wave2.x - r2,
                        top: geo.wave2.y - r2,
                        backgroundColor: palette.wavePrimary,
                        opacity: 0.22,
                    },
                ]}
            />
        </View>
    );

    if (fillParent && !(widthProp && heightProp)) {
        return (
            <View style={styles.parentClip} pointerEvents="none" collapsable={false}>
                {layer}
            </View>
        );
    }

    return layer;
}

const styles = StyleSheet.create({
    parentClip: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
    },
    layer: {
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
    },
});
