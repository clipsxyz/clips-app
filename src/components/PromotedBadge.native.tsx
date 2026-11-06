import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Shown on a boosted post in the feed and the fullscreen viewers. */
export default function PromotedBadge() {
    return (
        <View style={styles.pill}>
            <Text style={styles.text}>Promoted</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
