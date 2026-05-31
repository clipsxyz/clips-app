import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Feather FiPlus — Stories 24 Add yours affordances. */
export default function FeedPlusIcon({
    size = 12,
    color = '#111827',
    strokeWidth = 2.5,
}: {
    size?: number;
    color?: string;
    strokeWidth?: number;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 5v14M5 12h14"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
