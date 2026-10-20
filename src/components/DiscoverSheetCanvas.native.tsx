import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
    DISCOVER_SHEET_BASE,
    DISCOVER_SHEET_GRADIENT,
    DISCOVER_SHEET_GRADIENT_LOCATIONS,
} from '../utils/discoverAmbientPalette';

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
};

/**
 * Shared Discover Canvas wrapper for bottom sheets / pop-up modals.
 * Dark vertical LinearGradient (near-black → emerald); content sits above it.
 * All current and future sheets should render through this (directly, or via
 * the backwards-compatible PassportSheetCanvas alias).
 */
export default function DiscoverSheetCanvas({ children, style, contentStyle }: Props) {
    return (
        <LinearGradient
            colors={[...DISCOVER_SHEET_GRADIENT]}
            locations={[...DISCOVER_SHEET_GRADIENT_LOCATIONS]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.canvas, style]}
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
    content: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'transparent',
    },
});
