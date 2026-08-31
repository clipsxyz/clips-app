import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    count: number;
    onPress: () => void;
};

/** Small tagged-people control inline with the caption (not over media / mute). */
export default function FeedTaggedMediaBadge({ count, onPress }: Props) {
    if (count <= 0) return null;

    return (
        <TouchableOpacity
            style={styles.wrap}
            onPress={onPress}
            activeOpacity={0.75}
            hitSlop={8}
            accessibilityLabel={`View ${count} tagged ${count === 1 ? 'person' : 'people'}`}
        >
            <Icon name="person" size={12} color="#D1D5DB" />
            {count > 1 ? <Text style={styles.count}>{count > 9 ? '9+' : String(count)}</Text> : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingTop: 2,
        paddingLeft: 8,
        flexShrink: 0,
    },
    count: {
        color: '#D1D5DB',
        fontSize: 11,
        fontWeight: '600',
    },
});
