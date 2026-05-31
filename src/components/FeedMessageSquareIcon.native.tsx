import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiMessageSquare — web EngagementBar + CommentsModal empty state. */
export default function FeedMessageSquareIcon({
    size = 24,
    color = '#FFFFFF',
    opacity = 1,
}: {
    size?: number;
    color?: string;
    opacity?: number;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity={opacity}>
            <Path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
