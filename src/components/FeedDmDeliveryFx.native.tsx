import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export type FeedDmDeliveryFxState = {
    toHandle: string;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    phase: 'start' | 'fly';
};

type Props = {
    fx: FeedDmDeliveryFxState | null;
};

export default function FeedDmDeliveryFx({ fx }: Props) {
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!fx) return;
        translateX.setValue(0);
        translateY.setValue(0);
        scale.setValue(1);
        opacity.setValue(1);

        if (fx.phase !== 'fly') return;

        const dx = fx.targetX - fx.startX;
        const dy = fx.targetY - fx.startY;

        Animated.parallel([
            Animated.timing(translateX, {
                toValue: dx,
                duration: 3800,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: dy - 10,
                duration: 3800,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 0.3, duration: 3000, useNativeDriver: true }),
            ]),
            Animated.timing(opacity, {
                toValue: 0.06,
                duration: 3800,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fx, translateX, translateY, scale, opacity]);

    if (!fx) return null;

    const { width, height } = Dimensions.get('window');

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent pointerEvents="none">
            <View style={[styles.root, { width, height }]} pointerEvents="none">
                <Animated.View
                    style={[
                        styles.badge,
                        {
                            left: fx.startX,
                            top: fx.startY,
                            transform: [{ translateX }, { translateY }, { scale }],
                            opacity,
                        },
                    ]}
                >
                    <View style={styles.iconWrap}>
                        <Icon name="send" size={14} color="#FFFFFF" />
                    </View>
                    <View style={styles.textWrap}>
                        <Text style={styles.title}>Message sent</Text>
                        <Text style={styles.sub} numberOfLines={1}>
                            @{fx.toHandle.replace(/^@+/, '')}
                        </Text>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    badge: {
        position: 'absolute',
        marginLeft: -80,
        marginTop: -24,
        width: 160,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(103, 232, 249, 0.4)',
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#06B6D4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sub: {
        fontSize: 10,
        color: 'rgba(207, 250, 254, 0.9)',
        marginTop: 2,
    },
});
