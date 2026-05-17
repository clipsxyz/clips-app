import React, { useMemo, useRef } from 'react';
import {
    Image,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { StickerOverlay } from '../types';
import { clampStickerY } from '../utils/stickerLayoutNative';

type Props = {
    overlay: StickerOverlay;
    onUpdate: (overlay: StickerOverlay) => void;
    onRemove: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerWidth: number;
    containerHeight: number;
};

function fontSizePx(size?: 'small' | 'medium' | 'large'): number {
    if (size === 'small') return 14;
    if (size === 'large') return 22;
    return 18;
}

export default function StickerOverlayNative({
    overlay,
    onUpdate,
    onRemove,
    isSelected,
    onSelect,
    containerWidth,
    containerHeight,
}: Props) {
    const overlayRef = useRef(overlay);
    overlayRef.current = overlay;

    const isTextSticker = overlay.sticker.category === 'Text' || Boolean(overlay.textContent);
    const baseSize = overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 120 : 50;
    const width = baseSize * overlay.scale;
    const height = (overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 72 : 50) * overlay.scale;

    const dragOrigin = useRef({ px: 0, py: 0 });

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                    onSelect();
                    const current = overlayRef.current;
                    dragOrigin.current = {
                        px: (current.x / 100) * containerWidth,
                        py: (current.y / 100) * containerHeight,
                    };
                },
                onPanResponderMove: (_, gesture) => {
                    if (containerWidth <= 0 || containerHeight <= 0) return;
                    const current = overlayRef.current;
                    const newX = ((dragOrigin.current.px + gesture.dx) / containerWidth) * 100;
                    const newY = ((dragOrigin.current.py + gesture.dy) / containerHeight) * 100;
                    onUpdate({
                        ...current,
                        x: Math.max(0, Math.min(100, newX)),
                        y: clampStickerY(Math.max(0, Math.min(100, newY))),
                    });
                },
            }),
        [containerWidth, containerHeight, onSelect, onUpdate],
    );

    const left = containerWidth > 0 ? (overlay.x / 100) * containerWidth - width / 2 : 0;
    const top = containerHeight > 0 ? (overlay.y / 100) * containerHeight - height / 2 : 0;

    const content = overlay.textContent ? (
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
        <Image source={{ uri: overlay.sticker.url }} style={styles.imageSticker} resizeMode="contain" />
    ) : (
        <Text style={[styles.emojiSticker, { fontSize: Math.min(width, height) * 0.85 }]}>
            {overlay.sticker.emoji || overlay.sticker.name}
        </Text>
    );

    return (
        <View
            {...panResponder.panHandlers}
            style={[
                styles.root,
                {
                    left,
                    top,
                    width,
                    height,
                    opacity: overlay.opacity,
                    transform: [{ rotate: `${overlay.rotation}deg` }],
                },
                isSelected && styles.rootSelected,
            ]}
        >
            {content}
            {isSelected ? (
                <View style={styles.controls} pointerEvents="box-none">
                    <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() =>
                            onUpdate({
                                ...overlay,
                                scale: Math.max(0.5, overlay.scale - 0.1),
                            })
                        }
                    >
                        <Icon name="remove" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() =>
                            onUpdate({
                                ...overlay,
                                scale: Math.min(2, overlay.scale + 0.1),
                            })
                        }
                    >
                        <Icon name="add" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() =>
                            onUpdate({
                                ...overlay,
                                rotation: (overlay.rotation + 15) % 360,
                            })
                        }
                    >
                        <Icon name="refresh" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.controlBtn, styles.removeBtn]} onPress={onRemove}>
                        <Icon name="trash" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    rootSelected: {
        borderWidth: 2,
        borderColor: '#f472b6',
        borderRadius: 8,
    },
    emojiSticker: { textAlign: 'center' },
    textSticker: {
        fontWeight: '800',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        paddingHorizontal: 4,
    },
    imageSticker: { width: '100%', height: '100%' },
    controls: {
        position: 'absolute',
        top: -36,
        flexDirection: 'row',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 8,
        padding: 4,
    },
    controlBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBtn: { backgroundColor: 'rgba(239, 68, 68, 0.85)' },
});
