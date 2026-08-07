import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import PassportSheetCanvas from './PassportSheetCanvas.native';

type Props = {
    visible: boolean;
    sheetTop: number;
    minTop: number;
    maxTop: number;
    backdropOpacity?: number;
    onSheetTopChange: (top: number) => void;
    onClose: () => void;
    children: React.ReactNode;
};

const SPRING = { damping: 22, stiffness: 220 };
const OPEN_MS = 640;
const OPEN_EASE = Easing.bezier(0.16, 1, 0.3, 1);

export default function ScenesCommentsPanel({
    visible,
    sheetTop,
    minTop,
    maxTop,
    backdropOpacity = 0.35,
    onSheetTopChange,
    onClose,
    children,
}: Props) {
    const dragStartTop = useSharedValue(maxTop);
    // Always start off-screen so open never flashes the settled sheet.
    const topSv = useSharedValue(maxTop);
    const lastReported = useSharedValue(-1);

    useEffect(() => {
        if (!visible) {
            topSv.value = maxTop;
            lastReported.value = -1;
            return;
        }
        // Slide up from bottom into the Reels-style dock under the mini video.
        topSv.value = maxTop;
        lastReported.value = -1;
        topSv.value = withTiming(minTop, { duration: OPEN_MS, easing: OPEN_EASE });
    }, [visible, minTop, maxTop, topSv, lastReported]);

    // Keep parent media height locked to the sheet during open + drag.
    useAnimatedReaction(
        () => Math.round(topSv.value),
        (top, prev) => {
            if (!visible) return;
            if (top === prev || top === lastReported.value) return;
            lastReported.value = top;
            runOnJS(onSheetTopChange)(top);
        },
        [visible, onSheetTopChange],
    );

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetY([-8, 8])
                .onStart(() => {
                    dragStartTop.value = topSv.value;
                })
                .onUpdate((e) => {
                    const next = Math.min(maxTop, Math.max(minTop, dragStartTop.value + e.translationY));
                    topSv.value = next;
                })
                .onEnd((e) => {
                    const projected = topSv.value + e.velocityY * 0.12;
                    if (projected > minTop + 88 || e.velocityY > 620) {
                        topSv.value = withSpring(maxTop, SPRING, (finished) => {
                            if (finished) runOnJS(onClose)();
                        });
                        return;
                    }
                    topSv.value = withSpring(minTop, SPRING);
                }),
        [maxTop, minTop, onClose, dragStartTop, topSv],
    );

    const sheetStyle = useAnimatedStyle(() => ({
        top: topSv.value,
    }));

    if (!visible) return null;

    return (
        <>
            <Pressable
                style={[
                    styles.backdrop,
                    {
                        top: sheetTop,
                        backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
                    },
                ]}
                onPress={onClose}
            />
            <Animated.View style={[styles.sheet, sheetStyle]}>
                <PassportSheetCanvas style={styles.canvas} contentStyle={styles.canvasContent}>
                    <GestureDetector gesture={pan}>
                        <View style={styles.dragHandleRow}>
                            <View style={styles.dragHandle} />
                        </View>
                    </GestureDetector>
                    {children}
                </PassportSheetCanvas>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        elevation: 18,
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 80,
        elevation: 40,
        backgroundColor: '#060d16',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    canvas: {
        flex: 1,
        backgroundColor: '#060d16',
    },
    canvasContent: {
        flex: 1,
        backgroundColor: '#060d16',
    },
    dragHandleRow: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
});
