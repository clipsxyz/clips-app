import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import DiscoverAmbientCanvas from './DiscoverAmbientCanvas.native';
import { PASSPORT_ABYSS } from '../utils/discoverAmbientPalette';

/**
 * Stronger wash than full-screen shell — short sheets need more mid-tone contrast
 * or they read as flat black on Android.
 */
export const PASSPORT_SHEET_WASH = ['#060d16', '#0f3a42', '#1f6b63', '#164858', '#060d16'] as const;

type Props = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Passport night-atlas canvas for bottom sheets / floating cards.
 * iOS: animated ambient behind content.
 * Android: vivid parent LinearGradient (absolute ambient siblings can hide text on some OEMs).
 */
export default function PassportSheetCanvas({ children, style, contentStyle }: Props) {
    if (Platform.OS === 'ios') {
        return (
            <View style={[styles.canvas, style]} collapsable={false}>
                <View style={styles.ambient} pointerEvents="none" collapsable={false}>
                    <DiscoverAmbientCanvas variant="passport" fillParent />
                </View>
                <View style={[styles.content, contentStyle]} collapsable={false}>
                    {children}
                </View>
            </View>
        );
    }

    return (
        <LinearGradient
            colors={[...PASSPORT_SHEET_WASH]}
            locations={[0, 0.22, 0.52, 0.78, 1]}
            start={{ x: 0.05, y: 1 }}
            end={{ x: 0.95, y: 0 }}
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
        backgroundColor: PASSPORT_ABYSS,
        overflow: 'hidden',
    },
    ambient: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    content: {
        position: 'relative',
        zIndex: 1,
        backgroundColor: 'transparent',
    },
});
