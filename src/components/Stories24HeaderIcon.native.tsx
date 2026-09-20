import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Stories24Ring from './Stories24Ring.native';

type Props = {
    size?: number;
    hasUnviewedStory?: boolean;
};

/** Stories 24 header pill — same ring style/logic as feed profile pics. */
export default function Stories24HeaderIcon({ size = 40, hasUnviewedStory = false }: Props) {
    const playSize = Math.round(size * 0.38);
    return (
        <Stories24Ring size={size} unviewed={hasUnviewedStory}>
            <View style={styles.clip}>
                <LinearGradient
                    colors={['#0a0a0a', '#3d3d3d', '#f5f5f5']}
                    locations={[0, 0.48, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.inner}
                >
                    <Icon name="play" size={playSize} color="#FFFFFF" style={styles.playOffset} />
                </LinearGradient>
            </View>
        </Stories24Ring>
    );
}

const styles = StyleSheet.create({
    clip: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#0b0b0f',
    },
    inner: {
        width: '100%',
        height: '100%',
        borderRadius: 999,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playOffset: { marginLeft: 2 },
});
