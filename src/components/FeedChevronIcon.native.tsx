import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiChevronUp / FiChevronDown — web CommentsModal reply toggle. */
export default function FeedChevronIcon({
    direction,
    size = 14,
    color = '#6B7280',
}: {
    direction: 'up' | 'down';
    size?: number;
    color?: string;
}) {
    const d = direction === 'up' ? 'M18 15L12 9L6 15' : 'M6 9L12 15L18 9';
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d={d}
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
