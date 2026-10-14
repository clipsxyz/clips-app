import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle, type GestureResponderEvent } from 'react-native';

/** True for the tap that immediately follows a long-press, so nested taps can be swallowed. */
type SuppressTapRef = React.MutableRefObject<boolean>;

const DmTapSuppressContext = createContext<SuppressTapRef | null>(null);

/**
 * Consumed by tappable children inside a `DmMessagePressable` (shared-post card, inline
 * video, audio pill, …). When `.current` is true the press was already handled as a
 * long-press, so the child should ignore its own single-tap callback to avoid opening
 * full-screen playback / scenes at the same time as the action sheet.
 */
export function useDmTapSuppressed(): SuppressTapRef | null {
    return useContext(DmTapSuppressContext);
}

type Props = {
    onLongPress: () => void;
    /** Fired on a quick double tap (used for the heart reaction). */
    onDoubleTap?: () => void;
    /** Hold duration before menu opens. Instagram-ish ~250–300ms. */
    delayMs?: number;
    /** Cancel long-press only after finger moves this far (px). */
    moveTolerance?: number;
    /**
     * Optional shared suppression ref. Supply one to also guard sibling taps rendered
     * outside this component (React context only reaches descendants).
     */
    suppressTapRef?: React.MutableRefObject<boolean>;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

/**
 * Soft long-press for DM bubbles.
 * Uses onTouch* (does not steal the responder), so FlatList scroll + swipe-to-reply
 * still work, while tiny finger jitter won't cancel the hold the way Pressable does.
 *
 * Nested pressables read `useDmTapSuppressed()` so that a press-and-hold does not also
 * fire their single-tap handler on release.
 */
export default function DmMessagePressable({
    onLongPress,
    onDoubleTap,
    delayMs = 280,
    moveTolerance = 18,
    suppressTapRef,
    style,
    children,
}: Props) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef({ x: 0, y: 0 });
    const firedRef = useRef(false);
    const lastTapRef = useRef(0);
    const internalSuppressRef = useRef(false);
    const tapSuppressRef = suppressTapRef ?? internalSuppressRef;
    const onLongPressRef = useRef(onLongPress);
    onLongPressRef.current = onLongPress;
    const onDoubleTapRef = useRef(onDoubleTap);
    onDoubleTapRef.current = onDoubleTap;

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
        // A fresh touch re-arms nested taps until this gesture turns into a long-press.
        tapSuppressRef.current = false;
        clearTimer();
        timerRef.current = setTimeout(() => {
            firedRef.current = true;
            tapSuppressRef.current = true;
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
        if (firedRef.current) {
            firedRef.current = false;
            return;
        }
        if (!onDoubleTapRef.current) return;
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
            lastTapRef.current = 0;
            onDoubleTapRef.current();
        } else {
            lastTapRef.current = now;
        }
    };

    return (
        <DmTapSuppressContext.Provider value={tapSuppressRef}>
            <View
                style={style}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
            >
                {children}
            </View>
        </DmTapSuppressContext.Provider>
    );
}
