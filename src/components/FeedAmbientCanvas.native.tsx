import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
    /** Unused for now — feed canvas is a fixed Bluesky-dim floor. */
    dominantColor?: string | null;
};

/** News-feed ambient floor — fixed `#161E2E` (colour only). */
function FeedAmbientCanvasBase(_props: Props) {
    return <View style={styles.canvas} pointerEvents="none" collapsable={false} />;
}

const styles = StyleSheet.create({
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        elevation: 0,
        backgroundColor: '#161E2E',
    },
});

export default memo(FeedAmbientCanvasBase);
