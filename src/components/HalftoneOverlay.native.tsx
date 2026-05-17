import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Mask, Pattern, Rect, Stop } from 'react-native-svg';

/**
 * Tiled halftone dots with diagonal fade — matches web .discover-halftone-overlay.
 */
export default function HalftoneOverlay() {
    const { width, height } = useWindowDimensions();

    return (
        <Svg
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
        >
            <Defs>
                <Pattern id="gazetteerHalftone" patternUnits="userSpaceOnUse" width={16} height={16}>
                    <Circle cx={8} cy={8} r={2.5} fill="#ffffff" opacity={0.15} />
                </Pattern>
                <LinearGradient id="halftoneFade" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="20%" stopColor="#ffffff" stopOpacity={1} />
                    <Stop offset="75%" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
                <Mask id="halftoneMask">
                    <Rect x={0} y={0} width={width} height={height} fill="url(#halftoneFade)" />
                </Mask>
            </Defs>
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="url(#gazetteerHalftone)"
                mask="url(#halftoneMask)"
                opacity={0.85}
            />
        </Svg>
    );
}
