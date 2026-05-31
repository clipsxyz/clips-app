import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Layered FiMapPin — web Stories24FeedRail title badge (silver + gold + highlight). */
export default function Stories24MapPinIcon({ size = 16 }: { size?: number }) {
    const pinPath =
        'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

    return (
        <View
            style={[
                styles.wrap,
                {
                    width: size,
                    height: size,
                    shadowColor: '#ffffff',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.35,
                    shadowRadius: 1,
                },
            ]}
        >
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={StyleSheet.absoluteFill}>
                <Path
                    d={pinPath}
                    stroke="#d7dde3"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
            <View style={[styles.clipBottom, { height: size * 0.52 }]}>
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d={pinPath}
                        stroke="#d4af37"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            </View>
            <View style={[styles.clipTop, { height: size * 0.38 }]}>
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d={pinPath}
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
    },
    clipBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    clipTop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        overflow: 'hidden',
    },
});
