import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiX — web CommentsModal close button. */
export default function FeedCloseIcon({
    size = 20,
    color = '#4B5563',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M18 6L6 18M6 6L18 18"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
