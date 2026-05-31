import React, { useState } from 'react';
import { Dimensions, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    variant?: DiscoverAmbientVariant;
};

/**
 * Full-screen feed ambient — measures its layer then paints the wave canvas
 * (same technique as Stories 24 / suggested cards, which embed the canvas in a sized parent).
 */
export default function GazetteerAmbientBackground({ variant = 'discover' }: Props) {
    const initial = Dimensions.get('window');
    const [size, setSize] = useState({
        width: initial.width,
        height: initial.height,
    });

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
