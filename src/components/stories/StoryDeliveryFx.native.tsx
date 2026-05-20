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

    const dx = fx.targetX - fx.startX;
    const dy = fx.targetY - fx.startY;
    const originX = fx.startX - BUBBLE_W / 2;
    const originY = fx.startY - BUBBLE_H / 2;
    const endX = fx.targetX - BUBBLE_W / 2;
    const endY = fx.targetY - BUBBLE_H / 2;

    useEffect(() => {
        progress.setValue(0);
        if (fx.phase !== 'fly') return;
        const anim = Animated.timing(progress, {
            toValue: 1,
            duration: DURATION_MS,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: false,
        });
        anim.start(({ finished }) => {
            if (finished) onComplete();
        });
        return () => anim.stop();
    }, [fx.phase, fx.kind, onComplete, progress]);

    const left = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [originX, originX + dx * 0.05, originX + dx * 0.82, endX],
    });
    const top = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [originY, originY + dy * 0.05 - 8, originY + dy * 0.82 - 10, endY],
    });
    const scale = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [1, 1.08, 0.66, 0.3],
    });
    const opacity = progress.interpolate({
        inputRange: [0, 0.22, 0.74, 1],
        outputRange: [1, 1, 0.9, 0.06],
    });

    const staticLeft = originX;
    const staticTop = originY;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View
                style={[
                    styles.bubble,
                    fx.phase === 'fly'
                        ? { left, top, opacity, transform: [{ scale }] }
                        : { left: staticLeft, top: staticTop, opacity: 1, transform: [{ scale: 1 }] },
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
