import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** YouTube Shorts / web EngagementBar thumbs-up affordance. */
export default function FeedLikeThumbsIcon({
    size = 24,
    filled = false,
    color = '#FFFFFF',
}: {
    size?: number;
    filled?: boolean;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} aria-hidden>
            <Path
                d="M2 9H5V21H2C1.45 21 1 20.55 1 20V10C1 9.45 1.45 9 2 9ZM7.29 7.71L13.69 1.31C13.87 1.13 14.15 1.11 14.35 1.26L15.2 1.9C15.68 2.26 15.9 2.88 15.75 3.47L14.6 8H21C22.1 8 23 8.9 23 10V12.1C23 12.36 22.95 12.62 22.85 12.87L19.76 20.38C19.6 20.76 19.24 21 18.83 21H8C7.45 21 7 20.55 7 20V8.41C7 8.15 7.11 7.89 7.29 7.71Z"
                stroke={filled ? 'none' : color}
                strokeWidth={filled ? 0 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
