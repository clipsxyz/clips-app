import React, { useEffect, useMemo, useRef } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import type { StickerOverlay } from '../types';
import { clampStickerY, STICKER_SAFE_ZONE_BOTTOM, STICKER_SAFE_ZONE_TOP } from '../utils/stickerLayoutNative';

type Props = {
    overlay: StickerOverlay;
    onUpdate: (overlay: StickerOverlay) => void;
    onRemove: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerWidth: number;
    containerHeight: number;
    safeZoneTop?: number;
    safeZoneBottom?: number;
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
    safeZoneTop = STICKER_SAFE_ZONE_TOP,
    safeZoneBottom = STICKER_SAFE_ZONE_BOTTOM,
}: Props) {
    const overlayRef = useRef(overlay);
    overlayRef.current = overlay;

    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const isDraggingRef = useRef(false);

    const safeMinY = safeZoneTop;
    const safeMaxY = safeZoneBottom;

    const posX = useSharedValue(overlay.x);
    const posY = useSharedValue(overlay.y);
    const dragStartX = useSharedValue(overlay.x);
    const dragStartY = useSharedValue(overlay.y);
    const containerW = useSharedValue(containerWidth);
    const containerH = useSharedValue(containerHeight);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const minY = useSharedValue(safeMinY);
    const maxY = useSharedValue(safeMaxY);
    const rotationDeg = useSharedValue(overlay.rotation);

    const isLocationSticker = overlay.sticker.category === 'Location';
    const isLinkSticker = overlay.sticker.category === 'Link';
    const isTextSticker =
        overlay.sticker.category === 'Text' ||
        (Boolean(overlay.textContent) && !isLocationSticker && !isLinkSticker);
    const isPillSticker = isLocationSticker || isLinkSticker;

    const baseSize = overlay.sticker.category === 'GIF' ? 80 : isTextSticker ? 120 : 50;
    const width = isPillSticker
        ? Math.max(120, ((overlay.textContent || overlay.sticker.name || '').length * 7 + 48) * overlay.scale)
        : baseSize * overlay.scale;
    const height =
        overlay.sticker.category === 'GIF'
            ? 80 * overlay.scale
            : isTextSticker
              ? 72 * overlay.scale
              : isPillSticker
                ? 36 * overlay.scale
                : 50 * overlay.scale;

    const halfW = useSharedValue(width / 2);
    const halfH = useSharedValue(isPillSticker ? 18 : height / 2);

    useEffect(() => {
        if (isDraggingRef.current) return;
        posX.value = overlay.x;
        posY.value = overlay.y;
        translateX.value = 0;
        translateY.value = 0;
    }, [overlay.x, overlay.y, posX, posY, translateX, translateY]);

    useEffect(() => {
        rotationDeg.value = overlay.rotation;
    }, [overlay.rotation, rotationDeg]);

    useEffect(() => {
        containerW.value = containerWidth;
        containerH.value = containerHeight;
    }, [containerWidth, containerHeight, containerW, containerH]);

    useEffect(() => {
        minY.value = safeMinY;
        maxY.value = safeMaxY;
    }, [safeMinY, safeMaxY, minY, maxY]);

    useEffect(() => {
        halfW.value = width / 2;
        halfH.value = isPillSticker ? 18 : height / 2;
    }, [width, height, isPillSticker, halfW, halfH]);

    const markDragging = (dragging: boolean) => {
        isDraggingRef.current = dragging;
    };

    const commitDrag = (newX: number, newY: number) => {
        isDraggingRef.current = false;
        onUpdateRef.current({
            ...overlayRef.current,
            x: Math.max(0, Math.min(100, newX)),
            y: clampStickerY(newY, { min: safeMinY, max: safeMaxY }),
        });
    };

    const panGesture = useMemo(
        () =>
            Gesture.Pan()
                .minDistance(3)
                .onBegin(() => {
                    dragStartX.value = posX.value;
                    dragStartY.value = posY.value;
                    translateX.value = 0;
                    translateY.value = 0;
                    runOnJS(markDragging)(true);
                    runOnJS(onSelectRef.current)();
                })
                .onUpdate((e) => {
                    const cw = containerW.value;
                    const ch = containerH.value;
                    if (cw <= 0 || ch <= 0) return;

                    const rawX = dragStartX.value + (e.translationX / cw) * 100;
                    const rawY = dragStartY.value + (e.translationY / ch) * 100;
                    const clampedX = Math.max(0, Math.min(100, rawX));
                    const clampedY = Math.max(minY.value, Math.min(maxY.value, rawY));

                    translateX.value = ((clampedX - dragStartX.value) / 100) * cw;
                    translateY.value = ((clampedY - dragStartY.value) / 100) * ch;
                })
                .onFinalize((e) => {
                    const cw = containerW.value;
                    const ch = containerH.value;
                    if (cw <= 0 || ch <= 0) {
                        translateX.value = 0;
                        translateY.value = 0;
                        runOnJS(markDragging)(false);
                        return;
                    }

                    const rawX = dragStartX.value + (e.translationX / cw) * 100;
                    const rawY = dragStartY.value + (e.translationY / ch) * 100;
                    const clampedX = Math.max(0, Math.min(100, rawX));
                    const clampedY = Math.max(minY.value, Math.min(maxY.value, rawY));

                    // Commit visual position on UI thread first — avoids release flicker.
                    posX.value = clampedX;
                    posY.value = clampedY;
                    translateX.value = 0;
                    translateY.value = 0;
                    runOnJS(commitDrag)(clampedX, clampedY);
                }),
        [
            containerH,
            containerW,
            dragStartX,
            dragStartY,
            maxY,
            minY,
            posX,
            posY,
            translateX,
            translateY,
        ],
    );

    const positionStyle = useAnimatedStyle(() => {
        const cw = containerW.value;
        const ch = containerH.value;
        return {
            left: (posX.value / 100) * cw - halfW.value + translateX.value,
            top: (posY.value / 100) * ch - halfH.value + translateY.value,
            transform: [{ rotate: `${rotationDeg.value}deg` }],
        };
    });

    const label = overlay.textContent || overlay.sticker.name || '';

    const content = isLocationSticker ? (
        <View style={styles.locationPill}>
            <Icon name="location" size={12} color="#EF4444" />
            <Text style={styles.locationPillText} numberOfLines={1}>
                {label}
            </Text>
        </View>
    ) : isLinkSticker ? (
        <View style={styles.linkPill}>
            <View style={styles.linkIconWrap}>
                <Icon name="link" size={11} color="#E11D48" />
            </View>
            <Text style={styles.linkPillText} numberOfLines={1}>
                {label}
            </Text>
        </View>
    ) : overlay.textContent && overlay.sticker.category === 'Text' ? (
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
        <Animated.View
            style={[
                styles.root,
                {
                    width: isPillSticker ? undefined : width,
                    height: isPillSticker ? undefined : height,
                    minWidth: isPillSticker ? 96 : Math.max(width, 48),
                    minHeight: isPillSticker ? 40 : Math.max(height, 48),
                    opacity: overlay.opacity,
                    zIndex: isSelected ? 30 : 20,
                },
                isPillSticker && styles.pillRoot,
                isSelected && styles.rootSelected,
                positionStyle,
            ]}
        >
            <GestureDetector gesture={panGesture}>
                <View style={styles.touchTarget}>{content}</View>
            </GestureDetector>
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
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchTarget: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
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
    pillRoot: {
        maxWidth: 260,
    },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    locationPillText: {
        color: '#111827',
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
    linkPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.68)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.52)',
    },
    linkIconWrap: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.58)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.68)',
    },
    linkPillText: {
        color: '#0B1220',
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 1,
    },
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
