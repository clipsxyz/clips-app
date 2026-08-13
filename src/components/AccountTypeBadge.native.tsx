import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import { ox } from '../constants/nativeOpticalScale';

type Props = {
    accountType?: 'personal' | 'business' | string | null;
    /** When true, also show a Personal chip. Default: business only. */
    showPersonal?: boolean;
    compact?: boolean;
};

function resolveType(accountType?: string | null): 'personal' | 'business' | null {
    const raw = String(accountType || '').trim().toLowerCase();
    if (raw === 'business') return 'business';
    if (raw === 'personal') return 'personal';
    return null;
}

/** Passport / View Profile chip for account type. */
export default function AccountTypeBadge({ accountType, showPersonal = false, compact = false }: Props) {
    const type = resolveType(accountType);
    if (!type) return null;
    if (type === 'personal' && !showPersonal) return null;

    const isBusiness = type === 'business';

    return (
        <View
            style={[
                styles.badge,
                compact && styles.badgeCompact,
                isBusiness ? styles.badgeBusiness : styles.badgePersonal,
            ]}
        >
            <Icon
                name={isBusiness ? 'storefront-outline' : 'person-outline'}
                size={compact ? ox(12) : ox(14)}
                color={isBusiness ? '#FBBF24' : PASSPORT_PALETTE.wavePrimary}
            />
            <Text
                style={[
                    styles.text,
                    compact && styles.textCompact,
                    isBusiness ? styles.textBusiness : styles.textPersonal,
                ]}
            >
                {isBusiness ? 'Business account' : 'Personal account'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: ox(6),
        paddingVertical: ox(6),
        paddingHorizontal: ox(10),
        borderRadius: ox(999),
        borderWidth: 1,
    },
    badgeCompact: {
        paddingVertical: ox(4),
        paddingHorizontal: ox(8),
        gap: ox(4),
    },
    badgePersonal: {
        borderColor: 'rgba(61,155,143,0.45)',
        backgroundColor: 'rgba(61,155,143,0.12)',
    },
    badgeBusiness: {
        borderColor: 'rgba(251,191,36,0.45)',
        backgroundColor: 'rgba(251,191,36,0.12)',
    },
    text: {
        fontSize: ox(12),
        fontWeight: '700',
    },
    textCompact: {
        fontSize: ox(11),
    },
    textPersonal: {
        color: PASSPORT_PALETTE.wavePrimary,
    },
    textBusiness: {
        color: '#FBBF24',
    },
});
