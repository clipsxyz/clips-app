import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';
import { PASSPORT_SHEET_WASH } from './PassportSheetCanvas.native';

type Props = {
    /** Ignored — canvas is locked to the share-card Passport wash. */
    dominantColor?: string | null;
};

/** Same floor as native share / Passport sheets. */
export const FEED_AMBIENT_STATIC_HEX = PASSPORT_ABYSS;

/**
 * Full-bleed feed floor — identical Passport sheet wash as the share card canvas.
 */
function FeedAmbientCanvasBase(_props: Props) {
    return (
        <LinearGradient
            colors={[...PASSPORT_SHEET_WASH]}
            locations={[0, 0.22, 0.52, 0.78, 1]}
            start={{ x: 0.05, y: 1 }}
            end={{ x: 0.95, y: 0 }}
            style={styles.canvas}
            pointerEvents="none"
            collapsable={false}
        />
    );
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
        backgroundColor: FEED_AMBIENT_STATIC_HEX,
    },
});

export default memo(FeedAmbientCanvasBase);
