import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Avatar from './Avatar.native';
import { getAvatarForHandle } from '../api/users';

type Props = {
    onPress: () => void;
    label?: string;
    userHandle?: string;
    avatarSrc?: string;
};

/**
 * Bottom-left CTA on feed video cards — opens Scenes on tap.
 * Sized smaller than web so it doesn’t dominate the RN feed media frame.
 */
export default function VideoCTAOverlay({
    onPress,
    label = 'View in scenes',
    userHandle,
    avatarSrc: avatarSrcProp,
}: Props) {
    const avatarSrc = avatarSrcProp ?? (userHandle ? getAvatarForHandle(userHandle) : undefined);
    const avatarName = userHandle?.split('@')[0] || 'User';
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.03, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <Pressable
                onPress={(e) => {
                    e?.stopPropagation?.();
                    onPress();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <Animated.View style={[styles.pillRow, { transform: [{ scale: pulse }] }]}>
                    <View style={styles.avatarRing}>
                        <Avatar src={avatarSrc} name={avatarName} size={16} />
                    </View>
                    <View style={styles.labelPill}>
                        <Text style={styles.labelText} numberOfLines={1}>
                            {label}
                        </Text>
                    </View>
                </Animated.View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 8,
        bottom: 8,
        zIndex: 40,
        elevation: Platform.OS === 'android' ? 40 : 0,
    },
    pillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 140,
    },
    avatarRing: {
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 2,
    },
    labelPill: {
        marginLeft: -3,
        paddingLeft: 7,
        paddingRight: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    labelText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '600',
        lineHeight: 11,
    },
});
