import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import DiscoverSheetCanvas from './DiscoverSheetCanvas.native';

/**
 * Legacy gradient stops still used by a few non-sheet accents (follow buttons).
 * Sheets themselves now paint the Discover Canvas gradient — see below.
 */
export const PASSPORT_SHEET_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

type Props = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    tone?: 'discover' | 'ucl';
};

/**
 * Backwards-compatible alias: every sheet that rendered through
 * PassportSheetCanvas now inherits the Discover Canvas design system
 * via {@link DiscoverSheetCanvas} (dark near-black → emerald gradient).
 */
export default function PassportSheetCanvas({ children, style, contentStyle, tone }: Props) {
    return (
        <DiscoverSheetCanvas tone={tone} style={style} contentStyle={contentStyle}>
            {children}
        </DiscoverSheetCanvas>
    );
}
