import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type FeedPostMetaProps = {
    handle: string;
    timeText?: string;
    locationText?: string;
};

export default function FeedPostMeta({ handle, timeText, locationText }: FeedPostMetaProps) {
    return (
        <View>
            <Text style={styles.handle} numberOfLines={1}>{handle}</Text>
            {(timeText || locationText) ? (
                <View style={styles.row}>
                    {timeText ? <Text style={styles.metaText}>{timeText}</Text> : null}
                    {locationText ? <Text style={styles.metaText} numberOfLines={1}>{locationText}</Text> : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    handle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    row: {
        marginTop: 2,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 6,
    },
    metaText: {
        fontSize: 12,
        color: '#9CA3AF',
        maxWidth: 240,
    },
});
