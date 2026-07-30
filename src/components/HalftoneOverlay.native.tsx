import React, { useId } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Mask, Pattern, Rect, Stop } from 'react-native-svg';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';

type Props = {
    variant?: DiscoverAmbientVariant;
    /** When set, halftone is clipped to the parent card instead of the full window. */
    width?: number;
    height?: number;
    /** Unique prefix so multiple canvases on one screen do not clash SVG ids. */
    idPrefix?: string;
};

/**
 * Tiled halftone dots with diagonal fade — matches web .discover-halftone-overlay.
 */
export default function HalftoneOverlay({
    variant = 'discover',
    width: widthProp,
    height: heightProp,
    idPrefix,
}: Props) {
    const dotFill =
        variant === 'goldChrome' ? '#f6e27a' : variant === 'passport' ? '#9fd4cb' : '#ffffff';
    const dotOpacity = variant === 'goldChrome' ? 0.18 : variant === 'passport' ? 0.16 : 0.15;
    const layerOpacity = variant === 'goldChrome' ? 0.72 : variant === 'passport' ? 0.7 : 0.85;
    const { width: winW, height: winH } = useWindowDimensions();
    const width = widthProp && widthProp > 0 ? widthProp : winW;
    const height = heightProp && heightProp > 0 ? heightProp : winH;
    const uid = useId().replace(/:/g, '');
    const prefix = idPrefix || uid;

    return (
        <Svg
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
        >
            <Defs>
                <Pattern
                    id={`${prefix}-halftone`}
                    patternUnits="userSpaceOnUse"
                    width={16}
                    height={16}
                >
                    <Circle cx={8} cy={8} r={2.5} fill={dotFill} opacity={dotOpacity} />
                </Pattern>
                <LinearGradient id={`${prefix}-halftoneFade`} x1="0%" y1="0%" x2="82%" y2="57%">
                    <Stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="20%" stopColor="#ffffff" stopOpacity={1} />
                    <Stop offset="75%" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
                <Mask id={`${prefix}-halftoneMask`}>
                    <Rect x={0} y={0} width={width} height={height} fill={`url(#${prefix}-halftoneFade)`} />
                </Mask>
            </Defs>
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill={`url(#${prefix}-halftone)`}
                mask={`url(#${prefix}-halftoneMask)`}
                opacity={layerOpacity}
                {...(variant === 'goldChrome' ? { mixBlendMode: 'soft-light' as const } : { mixBlendMode: 'overlay' as const })}
            />
        </Svg>
    );
}
