import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import GazetteerAmbientBackground from './GazetteerAmbientBackground';
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
    return (
        <SafeAreaView style={[styles.root, style]} edges={edges}>
            {ambient ? <GazetteerAmbientBackground variant={ambientVariant} /> : null}
            <View style={[styles.content, contentStyle]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
});
