import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Instagram-style “add to story”: dashed circle + centered plus (feed share-to-stories affordance). */
export default function ShareToStoriesFeedIcon({
    size = 24,
    color = '#FFFFFF',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
            <Circle
                cx="12"
                cy="12"
                r="10.25"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="2.55 2.55"
                strokeLinecap="round"
            />
            <Path
                d="M12 7.35v9.3M7.35 12h9.3"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
            />
        </Svg>
    );
}
