import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet, type ViewProps } from 'react-native';

const SWIPE_THRESHOLD = 40;
const HOLD_DELAY_MS = 140;

type Props = ViewProps & {
    enabled: boolean;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
    children: React.ReactNode;
};

/**
 * Horizontal swipe + hold-to-pause.
 * Do NOT claim the responder on touch start — that steals taps from shared-post cards
 * (and loses to Android TextureView). Only claim after a clear horizontal move.
 */
export default function StorySwipeLayer({
    enabled,
    onSwipeLeft,
    onSwipeRight,
    onHoldStart,
    onHoldEnd,
    children,
    style,
    ...rest
}: Props) {
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);
    const enabledRef = useRef(enabled);
    const onSwipeLeftRef = useRef(onSwipeLeft);
    const onSwipeRightRef = useRef(onSwipeRight);
    const onHoldStartRef = useRef(onHoldStart);
    const onHoldEndRef = useRef(onHoldEnd);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdingRef = useRef(false);
    enabledRef.current = enabled;
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
    onHoldStartRef.current = onHoldStart;
    onHoldEndRef.current = onHoldEnd;

    const clearHoldTimer = () => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    };

    const endHold = () => {
        clearHoldTimer();
        if (!holdingRef.current) return;
        holdingRef.current = false;
        onHoldEndRef.current?.();
    };

    const beginHoldTimer = () => {
        if (!enabledRef.current) return;
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            if (!enabledRef.current) return;
            holdingRef.current = true;
            onHoldStartRef.current?.();
        }, HOLD_DELAY_MS);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (_, g) =>
                enabledRef.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
            onMoveShouldSetPanResponderCapture: (_, g) =>
                enabledRef.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
            onPanResponderGrant: (_, gesture) => {
                clearHoldTimer();
                startX.current = gesture.x0;
                startY.current = gesture.y0;
            },
            onPanResponderRelease: (_, gesture) => {
                endHold();
                if (startX.current == null || startY.current == null) return;
                const dx = gesture.moveX - startX.current;
                const dy = gesture.moveY - startY.current;
                startX.current = null;
                startY.current = null;
                if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
                if (dx < 0) onSwipeLeftRef.current();
                else onSwipeRightRef.current();
            },
            onPanResponderTerminate: () => {
                endHold();
                startX.current = null;
                startY.current = null;
            },
        }),
    ).current;

    return (
        <View
            style={[styles.fill, style]}
            {...rest}
            onTouchStart={() => beginHoldTimer()}
            onTouchEnd={() => endHold()}
            onTouchCancel={() => endHold()}
            {...(enabled ? panResponder.panHandlers : {})}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        width: '100%',
    },
});
