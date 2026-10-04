import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** FiMapPin — solid white stroke for Stories 24 section header. */
export default function Stories24MapPinIcon({
    size = 16,
    color = '#FFFFFF',
}: {
    size?: number;
    color?: string;
}) {
    const pinPath =
        'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Path
                    d={pinPath}
                    stroke={color}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
    );
}
