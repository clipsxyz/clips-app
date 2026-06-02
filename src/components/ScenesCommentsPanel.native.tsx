import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

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
    const dragStartTop = useSharedValue(sheetTop);
    const topSv = useSharedValue(sheetTop);

    useEffect(() => {
        topSv.value = sheetTop;
    }, [sheetTop, topSv]);

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
                    runOnJS(onSheetTopChange)(next);
                })
                .onEnd((e) => {
                    const projected = topSv.value + e.velocityY * 0.12;
                    if (projected > minTop + 88 || e.velocityY > 620) {
                        topSv.value = withSpring(maxTop, SPRING, (finished) => {
                            if (finished) runOnJS(onClose)();
                        });
                        runOnJS(onSheetTopChange)(maxTop);
                        return;
                    }
                    topSv.value = withSpring(minTop, SPRING);
                    runOnJS(onSheetTopChange)(minTop);
                }),
        [maxTop, minTop, onClose, onSheetTopChange, dragStartTop, topSv],
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
                <GestureDetector gesture={pan}>
                    <View style={styles.dragHandleRow}>
                        <View style={styles.dragHandle} />
                    </View>
                </GestureDetector>
                {children}
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
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 45,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 12,
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
        backgroundColor: '#D1D5DB',
    },
});
