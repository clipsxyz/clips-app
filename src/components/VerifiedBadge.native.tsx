import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
    resolveVerifiedAccountType,
    VERIFIED_BADGE_BLUE,
    VERIFIED_BADGE_PERSONAL_BG,
    VERIFIED_BADGE_PERSONAL_CHECK,
    type VerifiedAccountType,
} from '../utils/verifiedBadge';

type Props = {
    accountType?: string | null;
    size?: number;
};

/** Instagram-style verified tick beside usernames (personal = white, business = blue). */
export default function VerifiedBadge({ accountType, size = 14 }: Props) {
    const type: VerifiedAccountType = resolveVerifiedAccountType(accountType);
    const isBusiness = type === 'business';
    const checkSize = Math.max(8, Math.round(size * 0.62));

    return (
        <View
            accessible
            accessibilityLabel={isBusiness ? 'Business verified' : 'Verified'}
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: isBusiness ? VERIFIED_BADGE_BLUE : VERIFIED_BADGE_PERSONAL_BG,
                },
            ]}
        >
            <Icon
                name="checkmark"
                size={checkSize}
                color={isBusiness ? '#FFFFFF' : VERIFIED_BADGE_PERSONAL_CHECK}
                style={styles.check}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    check: {
        marginTop: 0.5,
    },
});
