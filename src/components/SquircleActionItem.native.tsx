import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export function formatRailCount(n: number | undefined): string {
    const v = Math.max(0, Number(n) || 0);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
    return String(v);
}

type SquircleActionItemProps = {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
    children: React.ReactNode;
    /** Warm pastel fill for the primary like badge. */
    highlight?: boolean;
    disabled?: boolean;
};

/** Full-screen video action badge. Springs to 0.86 on press and back to 1 on release. */
export default function SquircleActionItem({
    label,
    accessibilityLabel,
    onPress,
    children,
    highlight = false,
    disabled = false,
}: SquircleActionItemProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const springTo = (toValue: number) => {
        Animated.spring(scale, {
            toValue,
            useNativeDriver: true,
            friction: 6,
            tension: 140,
        }).start();
    };

    return (
        <View style={styles.col} pointerEvents="box-none">
            <Animated.View style={{ transform: [{ scale }] }}>
                <Pressable
                    onPress={onPress}
                    onPressIn={() => {
                        if (!disabled) springTo(0.86);
                    }}
                    onPressOut={() => springTo(1)}
                    disabled={disabled}
                    accessibilityLabel={accessibilityLabel}
                    style={[styles.badge, highlight ? styles.highlight : null, disabled ? styles.disabled : null]}
                >
                    {children}
                </Pressable>
            </Animated.View>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    col: {
        alignItems: 'center',
    },
    badge: {
        width: 44,
        height: 44,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        elevation: 0,
    },
    highlight: {
        backgroundColor: '#FFF5B8',
    },
    disabled: {
        opacity: 0.4,
    },
    label: {
        marginTop: 5,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
});
