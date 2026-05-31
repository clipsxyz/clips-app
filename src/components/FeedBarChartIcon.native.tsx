import React from 'react';
import Svg, { Line } from 'react-native-svg';

/** Feather FiBarChart2 — web EngagementBar boost metrics affordance. */
export default function FeedBarChartIcon({
    size = 24,
    color = '#FFFFFF',
}: {
    size?: number;
    color?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
            <Line x1="12" y1="20" x2="12" y2="4" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
            <Line x1="6" y1="20" x2="6" y2="14" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
        </Svg>
    );
}
