import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiSend — web CommentsModal composer + reply send. */
export default function FeedSendIcon({
    size = 16,
    color = '#111827',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M22 2L11 13"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M22 2L15 22L11 13L2 9L22 2Z"
                stroke={color}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
