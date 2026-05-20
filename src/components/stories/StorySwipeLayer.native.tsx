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

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => enabled,
            onMoveShouldSetPanResponder: (_, g) =>
                enabled && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
            onPanResponderGrant: (_, gesture) => {
                startX.current = gesture.x0;
                startY.current = gesture.y0;
                onHoldStart?.();
            },
            onPanResponderRelease: (_, gesture) => {
                onHoldEnd?.();
                if (startX.current == null || startY.current == null) return;
                const dx = gesture.moveX - startX.current;
                const dy = gesture.moveY - startY.current;
                startX.current = null;
                startY.current = null;
                if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
                if (dx < 0) onSwipeLeft();
                else onSwipeRight();
            },
            onPanResponderTerminate: () => {
                onHoldEnd?.();
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
