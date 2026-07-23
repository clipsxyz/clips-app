import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GazetteerAmbientBackground from './GazetteerAmbientBackground.native';
import { GAZETTEER_ABYSS } from '../theme/gazetteerAmbientNative';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type GazetteerScreenShellProps = {
    children: React.ReactNode;
    edges?: Edge[];
    ambient?: boolean;
    ambientVariant?: DiscoverAmbientVariant;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
};

const DISCOVER_WASH = ['#0b0711', '#201138', '#3a1528', '#201138', '#0b0711'] as const;
const GOLD_WASH = ['#0a1323', '#1a1530', '#2a2410', '#1a1530', '#0a1323'] as const;

/**
 * Ambient strategy:
 * - iOS: absolute animated canvas behind content (web-like motion).
 * - Android: LinearGradient as the PARENT of content (not an absolute sibling).
 *   Absolute ambient siblings paint above UI on Nokia and hide all text.
 */
export default function GazetteerScreenShell({
    children,
    edges = ['top'],
    ambient = true,
    ambientVariant = 'discover',
    style,
    contentStyle,
}: GazetteerScreenShellProps) {
    const wash = ambientVariant === 'goldChrome' ? GOLD_WASH : DISCOVER_WASH;

    if (!ambient) {
        return (
            <SafeAreaView style={[styles.root, styles.solid, style]} edges={edges}>
                <View style={[styles.content, contentStyle]}>{children}</View>
            </SafeAreaView>
        );
    }

    if (Platform.OS === 'ios') {
        return (
            <SafeAreaView style={[styles.root, styles.solid, style]} edges={edges}>
                <View style={styles.ambientSlot} pointerEvents="none" collapsable={false}>
                    <GazetteerAmbientBackground variant={ambientVariant} />
                </View>
                <View style={[styles.content, contentStyle]} collapsable={false}>
                    {children}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.root, style]} edges={edges}>
            <LinearGradient
                colors={[...wash]}
                locations={[0, 0.28, 0.55, 0.78, 1]}
                start={{ x: 0.1, y: 1 }}
                end={{ x: 0.9, y: 0 }}
                style={styles.androidWash}
            >
                <View style={[styles.content, contentStyle]} collapsable={false}>
                    {children}
                </View>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    solid: {
        backgroundColor: GAZETTEER_ABYSS,
    },
    ambientSlot: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    androidWash: {
        flex: 1,
    },
    content: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
