import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { StickerOverlay } from '../types';
import { clampStickerY } from '../utils/stickerLayoutNative';
import { adjustStickersForFeedDisplay } from '../utils/feedStickerLayout';
import { safeLayoutNumber, safePositiveLayoutNumber, safeScale } from '../utils/safeLayoutNative';

type Props = {
    stickers?: StickerOverlay[];
    containerWidth: number;
    containerHeight: number;
};

function fontSizePx(size?: 'small' | 'medium' | 'large'): number {
    if (size === 'small') return 14;
    if (size === 'large') return 22;
    return 18;
}

function FeedStickerItem({
    overlay,
    containerWidth,
    containerHeight,
}: {
    overlay: StickerOverlay;
    containerWidth: number;
    containerHeight: number;
}) {
    const isTextSticker = overlay.sticker.category === 'Text' || Boolean(overlay.textContent);
    const scale = safeScale(overlay.scale, 1);
    const baseSize = overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 120 : 50;
    const width = safePositiveLayoutNumber(baseSize * scale, baseSize);
    const height = safePositiveLayoutNumber(
        (overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 72 : 50) * scale,
        baseSize,
    );
    const xPct = safeLayoutNumber(overlay.x, 50);
    const y = clampStickerY(safeLayoutNumber(overlay.y, 50));
    const rotation = safeLayoutNumber(overlay.rotation, 0);
    const left = containerWidth > 0 ? (xPct / 100) * containerWidth - width / 2 : 0;
    const top = containerHeight > 0 ? (y / 100) * containerHeight - height / 2 : 0;
    const fontSize = safePositiveLayoutNumber(fontSizePx(overlay.fontSize) * scale, 14);
    const emojiSize = safePositiveLayoutNumber(Math.min(width, height) * 0.85, 14);

    return (
        <View
            style={[
                styles.item,
                {
                    left: safeLayoutNumber(left),
                    top: safeLayoutNumber(top),
                    width,
                    height,
                    transform: [{ rotate: `${rotation}deg` }],
                },
            ]}
            pointerEvents="none"
        >
            {overlay.textContent ? (
                <Text
                    style={[
                        styles.textSticker,
                        {
                            color: overlay.textColor || '#FFFFFF',
                            fontSize,
                        },
                    ]}
                    numberOfLines={4}
                >
                    {overlay.textContent}
                </Text>
            ) : overlay.sticker.url ? (
                <Image
                    source={{ uri: overlay.sticker.url }}
                    style={styles.imageSticker}
                    resizeMode="contain"
                />
            ) : (
                <Text style={[styles.emojiSticker, { fontSize: emojiSize }]}>
                    {overlay.sticker.emoji || overlay.sticker.name}
                </Text>
            )}
        </View>
    );
}

/** Read-only sticker layer for feed media and text bubbles (web StickerOverlay read-only parity). */
export default function FeedStickerOverlays({ stickers, containerWidth, containerHeight }: Props) {
    const safeW = safePositiveLayoutNumber(containerWidth, 0);
    const safeH = safePositiveLayoutNumber(containerHeight, 0);
    const adjusted = useMemo(
        () => (stickers?.length ? adjustStickersForFeedDisplay(stickers) : []),
        [stickers],
    );

    if (!adjusted.length || safeW <= 0 || safeH <= 0) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {adjusted.map((overlay) => (
                <FeedStickerItem
                    key={overlay.id}
                    overlay={overlay}
                    containerWidth={safeW}
                    containerHeight={safeH}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    item: {
        position: 'absolute',
    },
    textSticker: {
        textAlign: 'center',
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    emojiSticker: {
        textAlign: 'center',
    },
    imageSticker: {
        width: '100%',
        height: '100%',
    },
});
