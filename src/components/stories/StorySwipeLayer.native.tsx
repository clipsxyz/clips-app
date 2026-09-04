import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const SWIPE_THRESHOLD = 40;
const HOLD_DELAY_MS = 380;
const TAP_LEFT_RATIO = 0.35;

type Props = ViewProps & {
    enabled: boolean;
    /** Regular stories: tap left/right to go prev/next. Off for shared postcards so the card stays tappable. */
    captureTaps?: boolean;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
    children: React.ReactNode;
};

/**
 * Same pattern as Scenes: the gesture wrapper CONTAINS the video, it does not sit on top of it.
 * An overlay with elevation hides Android TextureView (audio, no picture).
 */
export default function StorySwipeLayer({
    enabled,
    captureTaps = true,
    onSwipeLeft,
    onSwipeRight,
    onHoldStart,
    onHoldEnd,
    children,
    style,
    ...rest
}: Props) {
    const enabledRef = useRef(enabled);
    const captureTapsRef = useRef(captureTaps);
    const onSwipeLeftRef = useRef(onSwipeLeft);
    const onSwipeRightRef = useRef(onSwipeRight);
    const onHoldStartRef = useRef(onHoldStart);
    const onHoldEndRef = useRef(onHoldEnd);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdingRef = useRef(false);
    const layoutWidthRef = useRef(1);
    enabledRef.current = enabled;
    captureTapsRef.current = captureTaps;
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
    onHoldStartRef.current = onHoldStart;
    onHoldEndRef.current = onHoldEnd;

    const clearHoldTimer = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const endHold = useCallback(() => {
        clearHoldTimer();
        if (!holdingRef.current) return;
        holdingRef.current = false;
        onHoldEndRef.current?.();
    }, [clearHoldTimer]);

    const beginHoldTimer = useCallback(() => {
        if (!enabledRef.current) return;
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            if (!enabledRef.current) return;
            holdingRef.current = true;
            onHoldStartRef.current?.();
        }, HOLD_DELAY_MS);
    }, [clearHoldTimer]);

    const fireLeft = useCallback(() => {
        if (!enabledRef.current) return;
        endHold();
        onSwipeLeftRef.current();
    }, [endHold]);

    const fireRight = useCallback(() => {
        if (!enabledRef.current) return;
        endHold();
        onSwipeRightRef.current();
    }, [endHold]);

    const onTapX = useCallback(
        (x: number) => {
            if (!enabledRef.current || !captureTapsRef.current || holdingRef.current) return;
            const width = layoutWidthRef.current || 1;
            if (x < width * TAP_LEFT_RATIO) fireRight();
            else fireLeft();
        },
        [fireLeft, fireRight],
    );

    const composed = useMemo(() => {
        const pan = Gesture.Pan()
            .enabled(enabled)
            .activeOffsetX([-18, 18])
            .onEnd((e) => {
                if (Math.abs(e.translationX) < SWIPE_THRESHOLD) return;
                if (Math.abs(e.translationY) >= Math.abs(e.translationX)) return;
                if (e.translationX < 0) runOnJS(fireLeft)();
                else runOnJS(fireRight)();
            });

        const tap = Gesture.Tap()
            .enabled(enabled && captureTaps)
            .maxDuration(280)
            .onEnd((e) => {
                runOnJS(onTapX)(e.x);
            });

        return Gesture.Exclusive(pan, tap);
    }, [captureTaps, enabled, fireLeft, fireRight, onTapX]);

    return (
        <GestureDetector gesture={composed}>
            <View
                style={[styles.fill, style]}
                collapsable={false}
                onLayout={(e) => {
                    layoutWidthRef.current = e.nativeEvent.layout.width || 1;
                }}
                onTouchStart={() => beginHoldTimer()}
                onTouchEnd={() => endHold()}
                onTouchCancel={() => endHold()}
                {...rest}
            >
                {children}
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent',
    },
});
