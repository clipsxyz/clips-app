import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const BUTTON = 78;
const RING = 90;
const STROKE = 3;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = RING / 2;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
    mode: 'photo' | 'video';
    busy: boolean;
    recording: boolean;
    maxVideoSeconds: number;
    disabled?: boolean;
    onTakePhoto: () => void;
    onToggleRecording: () => void;
};

/** Outer stroke on the existing shutter. The center disc never swaps out or resizes. */
export default function CameraShutterButton({
    mode,
    busy,
    recording,
    maxVideoSeconds,
    disabled = false,
    onTakePhoto,
    onToggleRecording,
}: Props) {
    const [holding, setHolding] = useState(false);
    const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spin = useRef(new Animated.Value(0)).current;
    const fill = useRef(new Animated.Value(0)).current;
    const spinning = mode === 'photo' && (holding || busy);
    const filling = mode === 'video' && recording;

    useEffect(() => {
        if (busy && releaseTimer.current) {
            clearTimeout(releaseTimer.current);
            releaseTimer.current = null;
        }
        if (!busy) setHolding(false);
    }, [busy]);

    useEffect(() => () => {
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
    }, []);

    useEffect(() => {
        if (!spinning) {
            spin.stopAnimation();
            spin.setValue(0);
            return;
        }
        spin.setValue(0);
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [spin, spinning]);

    useEffect(() => {
        fill.stopAnimation();
        if (!filling) {
            fill.setValue(0);
            return;
        }
        fill.setValue(0);
        const grow = Animated.timing(fill, {
            toValue: 1,
            duration: Math.max(1, maxVideoSeconds) * 1000,
            easing: Easing.linear,
            useNativeDriver: false,
        });
        grow.start();
        return () => grow.stop();
    }, [fill, filling, maxVideoSeconds]);

    const turn = spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
    const dashOffset = fill.interpolate({
        inputRange: [0, 1],
        outputRange: [CIRCUMFERENCE, 0],
    });

    return (
        <View style={styles.slot}>
            <Pressable
                style={styles.shutterRing}
                onPressIn={() => {
                    if (mode !== 'photo' || disabled || busy) return;
                    if (releaseTimer.current) clearTimeout(releaseTimer.current);
                    setHolding(true);
                }}
                onPressOut={() => {
                    if (releaseTimer.current) clearTimeout(releaseTimer.current);
                    releaseTimer.current = setTimeout(() => setHolding(false), 160);
                }}
                onPress={mode === 'video' ? onToggleRecording : onTakePhoto}
                disabled={disabled}
                accessibilityLabel={
                    mode === 'video' ? (recording ? 'Stop recording' : 'Start recording') : 'Take photo'
                }
            >
                {mode === 'video' ? (
                    recording ? <View style={styles.recordStop} /> : <View style={styles.recordDot} />
                ) : (
                    <View style={styles.shutter} />
                )}
            </Pressable>
            {spinning ? (
                <Animated.View pointerEvents="none" style={[styles.ringSlot, { transform: [{ rotate: turn }] }]}>
                    <Svg width={RING} height={RING}>
                        <Circle
                            cx={CENTER}
                            cy={CENTER}
                            r={RADIUS}
                            stroke="#FFFFFF"
                            strokeWidth={STROKE}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${CIRCUMFERENCE * 0.22} ${CIRCUMFERENCE}`}
                        />
                    </Svg>
                </Animated.View>
            ) : null}
            {filling ? (
                <View pointerEvents="none" style={[styles.ringSlot, styles.ringStart]}>
                    <Svg width={RING} height={RING}>
                        <AnimatedCircle
                            cx={CENTER}
                            cy={CENTER}
                            r={RADIUS}
                            stroke="#FFFFFF"
                            strokeWidth={STROKE}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={dashOffset}
                        />
                    </Svg>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    slot: {
        width: BUTTON,
        height: BUTTON,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringSlot: {
        position: 'absolute',
        width: RING,
        height: RING,
        left: (BUTTON - RING) / 2,
        top: (BUTTON - RING) / 2,
    },
    ringStart: {
        transform: [{ rotate: '-90deg' }],
    },
    shutterRing: {
        width: BUTTON,
        height: BUTTON,
        borderRadius: BUTTON / 2,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutter: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FFFFFF',
    },
    recordDot: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#FF3B30',
    },
    recordStop: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#FF3B30',
    },
});
