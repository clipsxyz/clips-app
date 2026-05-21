import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { StickerOverlay } from '../types';
import { clampStickerY } from '../utils/stickerLayoutNative';
import { adjustStickersForFeedDisplay } from '../utils/feedStickerLayout';

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
    const baseSize = overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 120 : 50;
    const width = baseSize * overlay.scale;
    const height = (overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 72 : 50) * overlay.scale;
    const y = clampStickerY(overlay.y);
    const left = containerWidth > 0 ? (overlay.x / 100) * containerWidth - width / 2 : 0;
    const top = containerHeight > 0 ? (y / 100) * containerHeight - height / 2 : 0;

    return (
        <View
            style={[
                styles.item,
                {
                    left,
                    top,
                    width,
                    height,
                    transform: [{ rotate: `${overlay.rotation || 0}deg` }],
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
                            fontSize: fontSizePx(overlay.fontSize) * overlay.scale,
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
                <Text style={[styles.emojiSticker, { fontSize: Math.min(width, height) * 0.85 }]}>
                    {overlay.sticker.emoji || overlay.sticker.name}
                </Text>
            )}
        </View>
    );
}

/** Read-only sticker layer for feed media and text bubbles (web StickerOverlay read-only parity). */
export default function FeedStickerOverlays({ stickers, containerWidth, containerHeight }: Props) {
    const adjusted = useMemo(
        () => (stickers?.length ? adjustStickersForFeedDisplay(stickers) : []),
        [stickers],
    );

    if (!adjusted.length || containerWidth <= 0 || containerHeight <= 0) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {adjusted.map((overlay) => (
                <FeedStickerItem
                    key={overlay.id}
                    overlay={overlay}
                    containerWidth={containerWidth}
                    containerHeight={containerHeight}
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
