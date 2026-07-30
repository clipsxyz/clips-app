import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Modal,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { ox } from '../constants/nativeOpticalScale';

export type ReactionFlyTarget = { x: number; y: number };

type Props = {
    emoji: string;
    /** Screen coords of reaction pill center (from measureInWindow). */
    target: ReactionFlyTarget | null;
    /** Called after center pop finishes — parent should measure pill & set target. */
    onPopComplete: () => void;
    onComplete: () => void;
};

/**
 * Instagram / web DM reaction motion:
 * 1) Pop — emoji springs large at screen center (~350ms)
 * 2) Fly — emoji translates + shrinks into the reaction pill on the bubble (~400ms)
 *
 * Rendered in a transparent Modal so positions match measureInWindow (screen space).
 */
export default function DmReactionFlyOverlay({
    emoji,
    target,
    onPopComplete,
    onComplete,
}: Props) {
    const { width: sw, height: sh } = Dimensions.get('window');
    const cx = sw / 2;
    const cy = sh / 2;
    const posX = useRef(new Animated.Value(cx)).current;
    const posY = useRef(new Animated.Value(cy)).current;
    const scale = useRef(new Animated.Value(0.35)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const phaseRef = useRef<'pop' | 'fly' | 'done'>('pop');
    const onPopCompleteRef = useRef(onPopComplete);
    const onCompleteRef = useRef(onComplete);
    onPopCompleteRef.current = onPopComplete;
    onCompleteRef.current = onComplete;

    useEffect(() => {
        phaseRef.current = 'pop';
        posX.setValue(cx);
        posY.setValue(cy);
        scale.setValue(0.35);
        opacity.setValue(0);

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 70,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.spring(scale, {
                    toValue: 2.85,
                    friction: 4.5,
                    tension: 140,
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 2.45,
                    duration: 70,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        ]).start(({ finished }) => {
            if (!finished || phaseRef.current !== 'pop') return;
            requestAnimationFrame(() => onPopCompleteRef.current());
        });
    }, [cx, cy, emoji, opacity, posX, posY, scale]);

    useEffect(() => {
        if (!target || phaseRef.current === 'fly' || phaseRef.current === 'done') return;
        phaseRef.current = 'fly';

        Animated.parallel([
            Animated.timing(posX, {
                toValue: target.x,
                duration: 400,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(posY, {
                toValue: target.y,
                duration: 400,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.32,
                duration: 400,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (!finished) return;
            phaseRef.current = 'done';
            Animated.timing(opacity, {
                toValue: 0,
                duration: 90,
                useNativeDriver: true,
            }).start(() => onCompleteRef.current());
        });
    }, [target, opacity, posX, posY, scale]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (phaseRef.current === 'pop' && !target) {
                phaseRef.current = 'done';
                onCompleteRef.current();
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [target]);

    const half = ox(48);

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent>
            <View style={styles.layer} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.emojiWrap,
                        {
                            opacity,
                            transform: [
                                { translateX: Animated.subtract(posX, half) },
                                { translateY: Animated.subtract(posY, half) },
                                { scale },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.emoji}>{emoji}</Text>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    layer: {
        flex: 1,
    },
    emojiWrap: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: ox(96),
        height: ox(96),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: ox(72),
        lineHeight: ox(88),
        textAlign: 'center',
    },
});
