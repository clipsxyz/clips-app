import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Feather FiSmile — web CommentsModal emoji toggle. */
export default function FeedSmileIcon({
    size = 20,
    color = '#6B7280',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.75} />
            <Path
                d="M8 14s1.5 2 4 2 4-2 4-2"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M9 9h.01M15 9h.01"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
            />
        </Svg>
    );
}
