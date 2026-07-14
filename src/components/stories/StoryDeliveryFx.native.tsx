import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export type StoryDeliveryFxState = {
    kind: 'message' | 'like';
    toHandle: string;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    phase: 'start' | 'fly';
};

type Props = {
    fx: StoryDeliveryFxState;
    onComplete: () => void;
};

const DURATION_MS = 3800;
const BUBBLE_W = 180;
const BUBBLE_H = 48;

/** Fly-from-bottom confirmation toward header avatar (web story-delivery-drop parity). */
export default function StoryDeliveryFx({ fx, onComplete }: Props) {
    const progress = useRef(new Animated.Value(0)).current;
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const dx = fx.targetX - fx.startX;
    const dy = fx.targetY - fx.startY;
    const originX = fx.startX - BUBBLE_W / 2;
    const originY = fx.startY - BUBBLE_H / 2;

    useEffect(() => {
        progress.setValue(0);
        if (fx.phase !== 'fly') return;
        const anim = Animated.timing(progress, {
            toValue: 1,
            duration: DURATION_MS,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
        });
        anim.start(({ finished }) => {
            if (finished) onCompleteRef.current();
        });
        return () => anim.stop();
    }, [fx.phase, fx.kind, fx.startX, fx.startY, fx.targetX, fx.targetY, progress]);

    const translateX = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [0, dx * 0.05, dx * 0.82, dx],
    });
    const translateY = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [0, dy * 0.05 - 8, dy * 0.82 - 10, dy],
    });
    const scale = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [1, 1.08, 0.66, 0.3],
    });
    const opacity = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [1, 1, 0.9, 0.06],
    });

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View
                style={[
                    styles.bubble,
                    {
                        left: originX,
                        top: originY,
                        opacity: fx.phase === 'fly' ? opacity : 1,
                        transform: fx.phase === 'fly' ? [{ translateX }, { translateY }, { scale }] : [],
                    },
                ]}
            >
                <View style={styles.iconWrap}>
                    <Icon
                        name={fx.kind === 'message' ? 'send' : 'thumbs-up'}
                        size={14}
                        color="#fff"
                    />
                </View>
                <View style={styles.textWrap}>
                    <Text style={styles.title}>
                        {fx.kind === 'message' ? 'Message sent' : 'Like sent'}
                    </Text>
                    <Text style={styles.handle} numberOfLines={1}>
                        @{fx.toHandle.replace(/^@/, '')}
                    </Text>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    bubble: {
        position: 'absolute',
        width: BUBBLE_W,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(103,232,249,0.4)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        zIndex: 95,
        elevation: 12,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(6,182,212,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textWrap: { flex: 1, minWidth: 0 },
    title: { color: '#fff', fontSize: 11, fontWeight: '700' },
    handle: { color: 'rgba(207,250,254,0.9)', fontSize: 10, marginTop: 1 },
});
