import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    count: number;
    onPress: () => void;
    /** Lift above feed video mute control when both are shown. */
    aboveMuteControl?: boolean;
};

/** Compact tagged-people control on feed media (bottom-right, away from Scenes CTA). */
export default function FeedTaggedMediaBadge({ count, onPress, aboveMuteControl }: Props) {
    if (count <= 0) return null;

    return (
        <TouchableOpacity
            style={[styles.wrap, aboveMuteControl && styles.wrapAboveMute]}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityLabel={`View ${count} tagged ${count === 1 ? 'person' : 'people'}`}
        >
            <View style={styles.circle}>
                <Icon name="person" size={14} color="#FFFFFF" />
            </View>
            {count > 1 ? (
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count > 9 ? '9+' : count}</Text>
                </View>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 22,
    },
    wrapAboveMute: {
        bottom: 52,
    },
    circle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    countBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#7A8AF0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    countText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
    },
});
