import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

type Props = {
    width: number;
    height: number;
    radius: number;
    color: string;
    maskId: string;
};

/**
 * Paint feed-background corners over media so ColorOS TextureView looks rounded
 * even when it ignores overflow clip.
 */
export default function FeedMediaRoundFrame({
    width,
    height,
    radius,
    color,
    maskId,
}: Props) {
    if (!(width > 1 && height > 1 && radius > 0)) return null;
    const id = `feed-round-${maskId}`;
    return (
        <View pointerEvents="none" style={styles.wrap}>
            <Svg width={width} height={height}>
                <Defs>
                    <Mask id={id}>
                        <Rect width={width} height={height} fill="#FFFFFF" />
                        <Rect
                            width={width}
                            height={height}
                            rx={radius}
                            ry={radius}
                            fill="#000000"
                        />
                    </Mask>
                </Defs>
                <Rect width={width} height={height} fill={color} mask={`url(#${id})`} />
                <Rect
                    x={0.5}
                    y={0.5}
                    width={Math.max(1, width - 1)}
                    height={Math.max(1, height - 1)}
                    rx={radius}
                    ry={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth={1}
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 6,
        elevation: 12,
    },
});
