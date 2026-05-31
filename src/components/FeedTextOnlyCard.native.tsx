import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import type { Post } from '../types';
import FeedDoubleTapLikeBurst from './FeedDoubleTapLikeBurst.native';
import FeedStickerOverlays from './FeedStickerOverlays.native';
import { getEffectiveTextStyleForPost } from '../utils/effectiveTextPostStyle';
import {
    getTextOnlyFontSize,
    getTextOnlyTextColor,
} from '../utils/effectiveTextPostStyleNative';
import {
    formatTextOnlyFeedByline,
    isLikelyLightTextColor,
    resolveTextCardTailFill,
} from '../utils/feedTextBubble';
import { gradientColorsFromCss } from '../utils/storyTextStyleNative';
import IMessageDmBubbleShell from './IMessageDmBubbleShell.native';

const FALLBACK_BACKGROUNDS = [
    '#1e3a8a',
    '#1e40af',
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#1e293b',
    '#0f172a',
    '#1a202c',
];

const DOUBLE_TAP_MS = 300;

/** CSS font stacks (e.g. system-ui, -apple-system, …) crash RN Text on Android. */
function nativeTextFontFamily(fontFamily?: string): string | undefined {
    if (!fontFamily?.trim() || fontFamily.includes(',')) return undefined;
    return fontFamily.trim();
}

type Props = {
    post: Post;
    isFromViewer: boolean;
    onDoubleLike: () => void;
    maxWidth: number;
};

/** Web App.tsx TextCard — double-tap like + in-bubble thumbs-up burst only. */
export default function FeedTextOnlyCard({
    post,
    isFromViewer,
    onDoubleLike,
    maxWidth,
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const [bubbleSize, setBubbleSize] = useState({ width: 0, height: 0 });
    const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
    const [burstKey, setBurstKey] = useState(0);
    const lastTapRef = useRef(0);
    const clearBurstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bubbleMeasureRef = useRef<View>(null);

    const text = post.text?.trim() || '';
    const shouldTruncate = text.length > 100;
    const displayText = shouldTruncate && !expanded ? `${text.slice(0, 100)}...` : text;

    const effectiveStyle = useMemo(() => getEffectiveTextStyleForPost(post), [post]);
    const selectedBackground = String(
        effectiveStyle?.background || FALLBACK_BACKGROUNDS[text.length % FALLBACK_BACKGROUNDS.length],
    );
    const textColor = effectiveStyle?.color || getTextOnlyTextColor(post);
    const fontSize = getTextOnlyFontSize(post);
    const tailColor = resolveTextCardTailFill(selectedBackground, isFromViewer);
    const parsedGradient =
        selectedBackground.includes('gradient') ? gradientColorsFromCss(selectedBackground) : [];
    const gradientColors = parsedGradient.length >= 2 ? parsedGradient : undefined;
    const solidBackground =
        selectedBackground.startsWith('#') ? selectedBackground : tailColor;

    const bylineRaw =
        post.isReclipped && post.originalUserHandle && isFromViewer && post.userReclipped
            ? post.originalUserHandle
            : post.userHandle;
    const byline = formatTextOnlyFeedByline(bylineRaw, post.locationLabel);
    const bylineColor = isLikelyLightTextColor(textColor)
        ? 'rgba(15, 23, 42, 0.92)'
        : 'rgba(30, 41, 55, 0.9)';

    const resolveLocalTap = (e: GestureResponderEvent): { x: number; y: number } => {
        const { locationX, locationY } = e.nativeEvent;
        if (typeof locationX === 'number' && typeof locationY === 'number') {
            return { x: locationX, y: locationY };
        }
        if (bubbleSize.width > 0 && bubbleSize.height > 0) {
            return { x: bubbleSize.width / 2, y: bubbleSize.height / 2 };
        }
        return { x: 0, y: 0 };
    };

    const handlePress = (e: GestureResponderEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < DOUBLE_TAP_MS) {
            const local = resolveLocalTap(e);
            setTapPosition(local);
            setBurstKey((k) => k + 1);
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

    const stickers = post.stickers;

    return (
        <View
            style={[
                styles.wrap,
                { maxWidth },
                isFromViewer ? styles.alignEnd : styles.alignStart,
            ]}
        >
            <Pressable onPress={handlePress} accessibilityLabel="Double tap to like">
                <View
                    ref={bubbleMeasureRef}
                    style={styles.bubbleMeasure}
                    onLayout={(ev) => {
                        const { width: w, height: h } = ev.nativeEvent.layout;
                        if (w > 0 && h > 0) setBubbleSize({ width: w, height: h });
                    }}
                >
                    <IMessageDmBubbleShell
                        layout="feed"
                        isFromMe
                        showTail
                        tailBackgroundColor={tailColor}
                        gradientColors={gradientColors}
                        bubbleStyle={
                            gradientColors ? undefined : { backgroundColor: solidBackground }
                        }
                    >
                        {byline ? (
                            <Text style={[styles.byline, { color: bylineColor }]} numberOfLines={2}>
                                {byline.toUpperCase()}
                            </Text>
                        ) : null}
                        <Text
                            style={[
                                styles.body,
                                {
                                    color: textColor,
                                    fontSize,
                                    fontFamily: nativeTextFontFamily(effectiveStyle?.fontFamily),
                                },
                            ]}
                        >
                            {displayText}
                        </Text>
                        {shouldTruncate ? (
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    setExpanded((v) => !v);
                                }}
                                hitSlop={8}
                            >
                                <Text style={[styles.more, { color: textColor }]}>
                                    {expanded ? 'Show less' : 'Show more'}
                                </Text>
                            </Pressable>
                        ) : null}
                    </IMessageDmBubbleShell>
                    {stickers && stickers.length > 0 && bubbleSize.width > 0 ? (
                        <FeedStickerOverlays
                            stickers={stickers}
                            containerWidth={bubbleSize.width}
                            containerHeight={bubbleSize.height}
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
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginTop: 4,
        width: '100%',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    alignStart: {
        alignItems: 'flex-start',
    },
    bubbleMeasure: {
        position: 'relative',
        maxWidth: '100%',
        overflow: 'visible',
    },
    byline: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    body: {
        fontWeight: '600',
        lineHeight: 22,
    },
    more: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'underline',
        opacity: 0.9,
    },
});
