import React from 'react';
import Svg, { Path, Polyline } from 'react-native-svg';

/** Feather FiRepeat — web EngagementBar reclip affordance. */
export default function FeedRepeatIcon({
    size = 24,
    color = '#9CA3AF',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Polyline
                points="17 1 21 5 17 9"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M3 11V9a4 4 0 0 1 4-4h14"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Polyline
                points="7 23 3 19 7 15"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M21 13v2a4 4 0 0 1-4 4H3"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
