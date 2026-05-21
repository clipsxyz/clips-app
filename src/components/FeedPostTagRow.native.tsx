import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
    tags: string[];
};

export default function FeedPostTagRow({ tags }: Props) {
    if (!tags.length) return null;
    return (
        <View style={styles.wrap}>
            {tags.slice(0, 5).map((t, i) => (
                <View key={`${t}-${i}`} style={styles.pill}>
                    <Text style={styles.pillText}>#{t}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.35)',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#C4B5FD',
    },
});
