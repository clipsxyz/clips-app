import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
    resolveVerifiedAccountType,
    VERIFIED_BADGE_BLUE,
    VERIFIED_BADGE_PERSONAL_CHECK,
    VERIFIED_BADGE_PERSONAL_FILL,
    VERIFIED_BADGE_PERSONAL_STROKE,
    VERIFIED_CHECK_PATH,
    VERIFIED_SEAL_PATH,
    type VerifiedAccountType,
} from '../utils/verifiedBadge';

type Props = {
    accountType?: string | null;
    size?: number;
};

/** Instagram / X–style scalloped verified seal (personal = white, business = blue). */
export default function VerifiedBadge({ accountType, size = 15 }: Props) {
    const type: VerifiedAccountType = resolveVerifiedAccountType(accountType);
    const isBusiness = type === 'business';
    const fill = isBusiness ? VERIFIED_BADGE_BLUE : VERIFIED_BADGE_PERSONAL_FILL;
    const check = isBusiness ? '#FFFFFF' : VERIFIED_BADGE_PERSONAL_CHECK;

    return (
        <View
            accessible
            accessibilityLabel={isBusiness ? 'Business verified' : 'Verified'}
            style={[styles.badge, { width: size, height: size }]}
        >
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    d={VERIFIED_SEAL_PATH}
                    fill={fill}
                    stroke={isBusiness ? 'none' : VERIFIED_BADGE_PERSONAL_STROKE}
                    strokeWidth={isBusiness ? 0 : 0.75}
                />
                <Path d={VERIFIED_CHECK_PATH} fill={check} />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
});
