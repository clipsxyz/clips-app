import React, { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle, type GestureResponderEvent } from 'react-native';

type Props = {
    onLongPress: () => void;
    /** Hold duration before menu opens. Instagram-ish ~250–300ms. */
    delayMs?: number;
    /** Cancel long-press only after finger moves this far (px). */
    moveTolerance?: number;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

/**
 * Soft long-press for DM bubbles.
 * Uses onTouch* (does not steal the responder), so FlatList scroll + swipe-to-reply
 * still work, while tiny finger jitter won't cancel the hold the way Pressable does.
 */
export default function DmMessagePressable({
    onLongPress,
    delayMs = 280,
    moveTolerance = 18,
    style,
    children,
}: Props) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef({ x: 0, y: 0 });
    const firedRef = useRef(false);
    const onLongPressRef = useRef(onLongPress);
    onLongPressRef.current = onLongPress;

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => () => clearTimer(), []);

    const onTouchStart = (e: GestureResponderEvent) => {
        const t = e.nativeEvent;
        startRef.current = { x: t.pageX, y: t.pageY };
        firedRef.current = false;
        clearTimer();
        timerRef.current = setTimeout(() => {
            firedRef.current = true;
            timerRef.current = null;
            onLongPressRef.current();
        }, delayMs);
    };

    const onTouchMove = (e: GestureResponderEvent) => {
        if (!timerRef.current) return;
        const t = e.nativeEvent;
        const dx = t.pageX - startRef.current.x;
        const dy = t.pageY - startRef.current.y;
        if (Math.hypot(dx, dy) > moveTolerance) {
            clearTimer();
        }
    };

    const onTouchEnd = () => {
        clearTimer();
    };

    return (
        <View
            style={style}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
        >
            {children}
        </View>
    );
}
