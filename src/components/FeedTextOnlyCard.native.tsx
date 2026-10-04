import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import type { Post } from '../types';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import { hasFinitePoint, safeLayoutNumber } from '../utils/safeLayoutNative';

const DOUBLE_TAP_MS = 300;
const BODY_COLOR = '#F1F5F9';

type Props = {
    post: Post;
    onDoubleLike: () => void;
};

/** Bluesky/Twitter-style text body — no template canvas or bubble chrome. */
export default function FeedTextOnlyCard({ post, onDoubleLike }: Props) {
    const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);
    const [bodySize, setBodySize] = useState({ width: 0, height: 0 });
    const lastTapRef = useRef(0);
    const clearBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const text = post.text?.trim() || '';
    const stickers = post.stickers;

    const resolveLocalTap = (e: GestureResponderEvent): { x: number; y: number } => {
        const { locationX, locationY } = e.nativeEvent;
        if (
            typeof locationX === 'number' &&
            typeof locationY === 'number' &&
            hasFinitePoint(locationX, locationY)
        ) {
            return { x: safeLayoutNumber(locationX), y: safeLayoutNumber(locationY) };
        }
        if (bodySize.width > 0 && bodySize.height > 0) {
            return { x: bodySize.width / 2, y: bodySize.height / 2 };
        }
        return { x: 0, y: 0 };
    };

    const handlePress = (e: GestureResponderEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < DOUBLE_TAP_MS) {
            const local = resolveLocalTap(e);
            if (hasFinitePoint(local.x, local.y)) {
                setTapPosition(local);
                setBurstKey((k) => k + 1);
            }
            onDoubleLike();

            if (clearBurstTimerRef.current) {
                clearTimeout(clearBurstTimerRef.current);
            }
            clearBurstTimerRef.current = setTimeout(() => {
                setTapPosition(null);
                clearBurstTimerRef.current = null;
            }, 500);
        }

        lastTapRef.current = now;
    };

    if (!text) return null;

    return (
        <Pressable
            onPress={handlePress}
            accessibilityLabel="Double tap to like"
            style={styles.wrap}
        >
            <View
                style={styles.bodyMeasure}
                onLayout={(ev) => {
                    const { width: w, height: h } = ev.nativeEvent.layout;
                    if (w > 0 && h > 0) setBodySize({ width: w, height: h });
                }}
            >
                <Text style={styles.body}>{text}</Text>
                {stickers && stickers.length > 0 && bodySize.width > 0 ? (
                    <FeedStickerOverlays
                        stickers={stickers}
                        containerWidth={bodySize.width}
                        containerHeight={bodySize.height}
                    />
                ) : null}
                {tapPosition ? (
                    <FeedDoubleTapLikeBurst
                        key={burstKey}
                        x={tapPosition.x}
                        y={tapPosition.y}
                    />
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        backgroundColor: 'transparent',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    bodyMeasure: {
        position: 'relative',
        width: '100%',
    },
    body: {
        color: BODY_COLOR,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '400',
    },
});
