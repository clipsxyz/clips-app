import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    clampStickerY,
    STICKER_SAFE_ZONE_BOTTOM,
    STICKER_SAFE_ZONE_TOP,
} from '../utils/stickerLayoutNative';

export type TaggedUserOverlayItem = {
    id: string;
    handle: string;
    x: number;
    y: number;
};

type Props = {
    taggedUser: TaggedUserOverlayItem;
    onUpdate: (taggedUser: TaggedUserOverlayItem) => void;
    onRemove: () => void;
    isSelected: boolean;
    onSelect: () => void;
    containerWidth: number;
    containerHeight: number;
    safeZoneTop?: number;
    safeZoneBottom?: number;
};

export default function TaggedUserOverlayNative({
    taggedUser,
    onUpdate,
    onRemove,
    isSelected,
    onSelect,
    containerWidth,
    containerHeight,
    safeZoneTop = STICKER_SAFE_ZONE_TOP,
    safeZoneBottom = STICKER_SAFE_ZONE_BOTTOM,
}: Props) {
    const taggedRef = useRef(taggedUser);
    taggedRef.current = taggedUser;

    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const isDraggingRef = useRef(false);

    const safeMinY = safeZoneTop;
    const safeMaxY = safeZoneBottom;

    const approxWidth = Math.max(88, taggedUser.handle.length * 7 + 36);
    const approxHeight = 32;

    const posX = useSharedValue(taggedUser.x);
    const posY = useSharedValue(taggedUser.y);
    const dragStartX = useSharedValue(taggedUser.x);
    const dragStartY = useSharedValue(taggedUser.y);
    const containerW = useSharedValue(containerWidth);
    const containerH = useSharedValue(containerHeight);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const minY = useSharedValue(safeMinY);
    const maxY = useSharedValue(safeMaxY);
    const halfW = useSharedValue(approxWidth / 2);
    const halfH = useSharedValue(approxHeight / 2);

    useEffect(() => {
        if (isDraggingRef.current) return;
        posX.value = taggedUser.x;
        posY.value = taggedUser.y;
        translateX.value = 0;
        translateY.value = 0;
    }, [taggedUser.x, taggedUser.y, posX, posY, translateX, translateY]);

    useEffect(() => {
        containerW.value = containerWidth;
        containerH.value = containerHeight;
    }, [containerWidth, containerHeight, containerW, containerH]);

    useEffect(() => {
        minY.value = safeMinY;
        maxY.value = safeMaxY;
    }, [safeMinY, safeMaxY, minY, maxY]);

    useEffect(() => {
        halfW.value = approxWidth / 2;
        halfH.value = approxHeight / 2;
    }, [approxWidth, approxHeight, halfW, halfH]);

    const markDragging = (dragging: boolean) => {
        isDraggingRef.current = dragging;
    };

    const commitDrag = (newX: number, newY: number) => {
        isDraggingRef.current = false;
        onUpdateRef.current({
            ...taggedRef.current,
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
        };
    });

    return (
        <Animated.View
            style={[
                styles.wrap,
                {
                    zIndex: isSelected ? 40 : 25,
                },
                positionStyle,
            ]}
        >
            <GestureDetector gesture={panGesture}>
                <View style={styles.touchTarget}>
                    <View style={[styles.pill, isSelected && styles.pillSelected]}>
                        <Text style={styles.pillText}>@{taggedUser.handle}</Text>
                    </View>
                </View>
            </GestureDetector>
            {isSelected ? (
                <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={onRemove}
                    hitSlop={6}
                    accessibilityLabel="Remove tag"
                >
                    <Icon name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchTarget: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    pillSelected: {
        borderWidth: 2,
        borderColor: '#a855f7',
    },
    pillText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    removeBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
