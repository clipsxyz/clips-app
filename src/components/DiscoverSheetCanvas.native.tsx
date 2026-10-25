import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
    DISCOVER_SHEET_BASE,
    DISCOVER_SHEET_GRADIENT,
    DISCOVER_SHEET_GRADIENT_LOCATIONS,
} from '../utils/discoverAmbientPalette';
import {
    UCL_CANVAS_NAVY,
    UCL_SHEET_GRADIENT,
    UCL_SHEET_GRADIENT_LOCATIONS,
} from '../theme/gazetteerAmbientNative';

export {
    DISCOVER_SHEET_ACCENT,
    DISCOVER_SHEET_BASE,
    DISCOVER_SHEET_BORDER,
    DISCOVER_SHEET_GRADIENT,
    DISCOVER_SHEET_GRADIENT_LOCATIONS,
    DISCOVER_SHEET_SURFACE,
    DISCOVER_SHEET_TEXT,
    DISCOVER_SHEET_TEXT_MUTED,
} from '../utils/discoverAmbientPalette';

type Props = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    /** `ucl` = Champions League navy canvas; default is black → purple. */
    tone?: 'discover' | 'ucl';
};

/**
 * Shared Discover Canvas wrapper for bottom sheets / pop-up modals.
 * Dark vertical LinearGradient (pure black → bright purple); content sits above it.
 * All current and future sheets should render through this (directly, or via
 * the backwards-compatible PassportSheetCanvas alias).
 */
export default function DiscoverSheetCanvas({
    children,
    style,
    contentStyle,
    tone = 'discover',
}: Props) {
    const ucl = tone === 'ucl';
    return (
        <LinearGradient
            colors={[...(ucl ? UCL_SHEET_GRADIENT : DISCOVER_SHEET_GRADIENT)]}
            locations={[...(ucl ? UCL_SHEET_GRADIENT_LOCATIONS : DISCOVER_SHEET_GRADIENT_LOCATIONS)]}
            start={ucl ? { x: 0.12, y: 0 } : { x: 0.5, y: 0 }}
            end={ucl ? { x: 0.88, y: 1 } : { x: 0.5, y: 1 }}
            style={[styles.canvas, ucl && styles.canvasUcl, style]}
        >
            <View style={[styles.content, contentStyle]} collapsable={false}>
                {children}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    canvas: {
        backgroundColor: DISCOVER_SHEET_BASE,
        overflow: 'hidden',
    },
    canvasUcl: {
        backgroundColor: UCL_CANVAS_NAVY,
    },
    content: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'transparent',
    },
});
