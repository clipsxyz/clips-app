import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
    size?: number;
};

/** Dual-ring play control for Stories 24 entry (feed header). */
export default function Stories24HeaderIcon({ size = 40 }: Props) {
    const inner = Math.round(size * 0.72);
    const playSize = Math.round(size * 0.3);
    return (
        <View style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }]}>
            <LinearGradient
                colors={['#0a0a0a', '#3d3d3d', '#f5f5f5']}
                locations={[0, 0.48, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}
            >
                <Icon name="play" size={playSize} color="#FFFFFF" style={styles.playOffset} />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playOffset: { marginLeft: 2 },
});
