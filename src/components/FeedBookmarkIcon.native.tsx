import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiBookmark — web EngagementBar save affordance. */
export default function FeedBookmarkIcon({
    size = 24,
    color = '#FFFFFF',
    filled = false,
}: {
    size?: number;
    color?: string;
    filled?: boolean;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
            <Path
                d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                stroke={filled ? 'none' : color}
                strokeWidth={filled ? 0 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
