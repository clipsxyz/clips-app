import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import GazetteerAmbientBackground from './GazetteerAmbientBackground';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type GazetteerScreenShellProps = {
    children: React.ReactNode;
    edges?: Edge[];
    /** Show animated gradient + halftone (default true). */
    ambient?: boolean;
    /** Ambient wave palette (Stories 24 loader uses `goldChrome`). */
    ambientVariant?: DiscoverAmbientVariant;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
};

/**
 * Standard full-screen wrapper for Gazetteer native screens (iOS & Android).
 */
export default function GazetteerScreenShell({
    children,
    edges = ['top'],
    ambient = true,
    ambientVariant = 'discover',
    style,
    contentStyle,
}: GazetteerScreenShellProps) {
    const isFocused = useIsFocused();
    const showAmbient = ambient && isFocused;

    return (
        <SafeAreaView
            style={[styles.root, !showAmbient && styles.rootSolid, style]}
            edges={edges}
        >
            {showAmbient ? <GazetteerAmbientBackground variant={ambientVariant} /> : null}
            <View style={[styles.content, contentStyle]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: GAZETTEER_ABYSS,
    },
    rootSolid: {
        backgroundColor: GAZETTEER_ABYSS,
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
});
