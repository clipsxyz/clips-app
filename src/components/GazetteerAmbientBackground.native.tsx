import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    variant?: DiscoverAmbientVariant;
};

/**
 * Full-screen ambient for GazetteerScreenShell tabs/screens — measures its layer
 * then paints the wave canvas (never paints at window size before layout).
 */
export default function GazetteerAmbientBackground({ variant = 'discover' }: Props) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setSize((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height },
            );
        }
    };

    return (
        <View
            style={styles.layer}
            onLayout={onLayout}
            pointerEvents="none"
            collapsable={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            {size.width > 0 && size.height > 0 ? (
                <DiscoverAmbientCanvas
                    variant={variant}
                    fillParent={false}
                    width={size.width}
                    height={size.height}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        elevation: Platform.OS === 'android' ? 0 : undefined,
    },
});
