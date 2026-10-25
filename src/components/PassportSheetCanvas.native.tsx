import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import DiscoverSheetCanvas from './DiscoverSheetCanvas.native';

/**
 * Legacy gradient stops still used by a few non-sheet accents (follow buttons).
 * Sheets themselves now paint the Discover Canvas gradient — see below.
 */
export const PASSPORT_SHEET_WASH = ['#000000', '#23104F'] as const;

type Props = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    tone?: 'discover' | 'ucl';
};

/**
 * Backwards-compatible alias: every sheet that rendered through
 * PassportSheetCanvas now inherits the Discover Canvas design system
 * via {@link DiscoverSheetCanvas} (pure black → bright purple gradient).
 */
export default function PassportSheetCanvas({ children, style, contentStyle, tone }: Props) {
    return (
        <DiscoverSheetCanvas tone={tone} style={style} contentStyle={contentStyle}>
            {children}
        </DiscoverSheetCanvas>
    );
}
