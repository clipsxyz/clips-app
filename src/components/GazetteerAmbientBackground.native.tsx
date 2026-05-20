import React from 'react';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    variant?: DiscoverAmbientVariant;
};

/** Native full-screen ambient background (Discover wave + halftone). */
export default function GazetteerAmbientBackground({ variant = 'discover' }: Props) {
    return <DiscoverAmbientCanvas fillParent={false} variant={variant} />;
}
