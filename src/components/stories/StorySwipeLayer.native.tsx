import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet, type ViewProps } from 'react-native';

const SWIPE_THRESHOLD = 40;

type Props = ViewProps & {
    enabled: boolean;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onHoldStart?: () => void;
    onHoldEnd?: () => void;
    children: React.ReactNode;
};

/** Horizontal swipe + hold-to-pause gesture layer (web Stories swipe parity). */
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
    enabledRef.current = enabled;
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
    onHoldStartRef.current = onHoldStart;
    onHoldEndRef.current = onHoldEnd;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => enabledRef.current,
            onMoveShouldSetPanResponder: (_, g) =>
                enabledRef.current && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
            onPanResponderGrant: (_, gesture) => {
                startX.current = gesture.x0;
                startY.current = gesture.y0;
                onHoldStartRef.current?.();
            },
            onPanResponderRelease: (_, gesture) => {
                onHoldEndRef.current?.();
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
                onHoldEndRef.current?.();
                startX.current = null;
                startY.current = null;
            },
        }),
    ).current;

    return (
        <View
            style={[styles.fill, style]}
            {...rest}
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
