import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

type Props = {
    pageCount: number;
    pageWidth: number;
    pageHeight: number;
    index: number;
    onIndexChange: (next: number) => void;
    onTap?: () => void;
    enabled?: boolean;
    children: React.ReactNode;
};

/**
 * Horizontal pager that does not use ScrollView.
 * RNGH ScrollView inside a Modal / GestureHandlerRootView often cannot page on Android.
 */
export default function NativePageSwipe({
    pageCount,
    pageWidth,
    pageHeight,
    index,
    onIndexChange,
    onTap,
    enabled = true,
    children,
}: Props) {
    const widthSV = useSharedValue(pageWidth);
    const countSV = useSharedValue(Math.max(1, pageCount));
    const indexSV = useSharedValue(index);
    const x = useSharedValue(-index * pageWidth);
    const skipAlignRef = useRef(false);
    const onIndexChangeRef = useRef(onIndexChange);
    const onTapRef = useRef(onTap);
    onIndexChangeRef.current = onIndexChange;
    onTapRef.current = onTap;

    useEffect(() => {
        widthSV.value = pageWidth;
        countSV.value = Math.max(1, pageCount);
    }, [countSV, pageCount, pageWidth, widthSV]);

    useEffect(() => {
        if (skipAlignRef.current) {
            skipAlignRef.current = false;
            return;
        }
        indexSV.value = index;
        x.value = -index * pageWidth;
    }, [index, indexSV, pageWidth, x]);

    const commitIndex = useCallback((next: number) => {
        skipAlignRef.current = true;
        onIndexChangeRef.current(next);
    }, []);

    const fireTap = useCallback(() => {
        onTapRef.current?.();
    }, []);

    const gesture = useMemo(() => {
        const pan = Gesture.Pan()
            .enabled(enabled && pageCount > 1)
            .activeOffsetX([-8, 8])
            .failOffsetY([-28, 28])
            .onUpdate((e) => {
                const minX = -(countSV.value - 1) * widthSV.value;
                const raw = -indexSV.value * widthSV.value + e.translationX;
                x.value = Math.min(0, Math.max(minX, raw));
            })
            .onEnd((e) => {
                const w = Math.max(1, widthSV.value);
                const predicted = -indexSV.value * w + e.translationX + e.velocityX * 0.08;
                let next = Math.round(-predicted / w);
                next = Math.max(0, Math.min(countSV.value - 1, next));
                indexSV.value = next;
                x.value = withTiming(-next * w, { duration: 160 });
                runOnJS(commitIndex)(next);
            });
        const tap = Gesture.Tap().onEnd((_e, ok) => {
            if (ok) runOnJS(fireTap)();
        });
        return Gesture.Exclusive(pan, tap);
    }, [commitIndex, countSV, enabled, fireTap, indexSV, pageCount, widthSV, x]);

    const rowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <View
                collapsable={false}
                style={{ width: pageWidth, height: pageHeight, overflow: 'hidden' }}
            >
                <Animated.View
                    collapsable={false}
                    style={[{ flexDirection: 'row', height: pageHeight }, rowStyle]}
                >
                    {children}
                </Animated.View>
            </View>
        </GestureDetector>
    );
}
