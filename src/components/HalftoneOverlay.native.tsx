import React, { useId } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Mask, Pattern, Rect, Stop } from 'react-native-svg';
import type { DiscoverAmbientVariant } from '../utils/discoverAmbientPalette';
import { shouldSkipHeavySvg } from '../utils/androidSafeSvgNative';
import { safePositiveLayoutNumber } from '../utils/safeLayoutNative';

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
 * Skipped on Android when the density-scaled bitmap would exceed Canvas limits
 * (Stories 24 / full-screen feed crash: "trying to draw too large bitmap").
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
    const width = safePositiveLayoutNumber(widthProp && widthProp > 0 ? widthProp : winW, 1);
    const height = safePositiveLayoutNumber(heightProp && heightProp > 0 ? heightProp : winH, 1);
    const uid = useId().replace(/:/g, '');
    const prefix = idPrefix || uid;

    if (shouldSkipHeavySvg(width, height)) {
        return null;
    }

    const blendProps =
        Platform.OS === 'android'
            ? {}
            : variant === 'goldChrome'
              ? { mixBlendMode: 'soft-light' as const }
              : { mixBlendMode: 'overlay' as const };

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
                {...blendProps}
            />
        </Svg>
    );
}
