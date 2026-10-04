import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    size?: number;
};

/** Dual-ring play control for Stories 24 entry (feed header). */
export default function Stories24HeaderIcon({ size = 40 }: Props) {
    const inner = Math.round(size * 0.72);
    const playSize = Math.round(size * 0.3);
    return (
        <View style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }]}>
            <View
                style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}
            >
                <Icon name="play" size={playSize} color="#FFFFFF" style={styles.playOffset} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playOffset: { marginLeft: 2 },
});