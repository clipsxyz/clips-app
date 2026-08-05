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
                Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
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
                        <Avatar src={avatarSrc} name={avatarName} size={22} />
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
        left: 12,
        bottom: 12,
        zIndex: 40,
        elevation: Platform.OS === 'android' ? 40 : 0,
    },
    pillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 180,
    },
    avatarRing: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 2,
    },
    labelPill: {
        marginLeft: -4,
        paddingLeft: 10,
        paddingRight: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    labelText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
});
