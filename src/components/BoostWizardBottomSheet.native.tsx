import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Post } from '../types';
import { boostTileImageUri } from './BoostPostTile.native';

type Props = {
    selectedPost?: Post | null;
};

/** Compact reminder of the post being boosted, shown under the sheet title. */
export default function BoostWizardBottomSheet({ selectedPost }: Props) {
    if (!selectedPost) return null;

    const thumbnailUri = boostTileImageUri(selectedPost);
    const caption = (selectedPost.text || selectedPost.caption || 'Untitled post').trim();

    return (
        <View style={styles.card}>
            {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={styles.thumb} resizeMode="cover" />
            ) : (
                <View style={styles.thumb} />
            )}
            <View style={styles.copy}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>SELECTED POST</Text>
                </View>
                <Text style={styles.caption} numberOfLines={1}>
                    {caption}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
        padding: 10,
        borderRadius: 14,
        backgroundColor: '#1E1B2E',
        borderWidth: 1,
        borderColor: '#3B3554',
    },
    thumb: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#15131F',
    },
    copy: {
        flex: 1,
        gap: 4,
    },
    badge: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: 'rgba(59,53,84,0.9)',
    },
    badgeText: {
        color: '#C4B5FD',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    caption: {
        color: '#F4F4F5',
        fontSize: 14,
        fontWeight: '600',
    },
});
