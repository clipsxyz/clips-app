import React from 'react';
import { StyleSheet, View } from 'react-native';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    variant?: DiscoverAmbientVariant;
};

export default function GazetteerAmbientBackground({ variant = 'discover' }: Props) {
    return (
        <View
            style={styles.layer}
            pointerEvents="none"
            collapsable={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <DiscoverAmbientCanvas variant={variant} fillParent />
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
    },
});
