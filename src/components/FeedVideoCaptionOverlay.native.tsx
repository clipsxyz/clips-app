import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Post } from '../types';

/** On-video caption/subtitle overlay (web feed video caption parity). */
export default function FeedVideoCaptionOverlay({ post }: { post: Post }) {
    const caption =
        post.videoCaptionsEnabled && post.videoCaptionText?.trim()
            ? post.videoCaptionText.trim()
            : post.subtitlesEnabled && post.subtitleText?.trim()
              ? post.subtitleText.trim()
              : null;

    if (!caption) return null;

    return (
        <View style={styles.wrap} pointerEvents="none">
            <Text style={styles.text} numberOfLines={3}>
                {caption}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 44,
        alignItems: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
});
