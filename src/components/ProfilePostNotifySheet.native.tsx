import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import ProfilePostNotifyBell from './ProfilePostNotifyBell.native';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';
import type { ProfilePostNotifyLevel } from '../utils/profilePostNotifyPrefs';

export type ProfilePostNotifySheetMode = 'menu' | 'confirm';

type Props = {
    visible: boolean;
    mode: ProfilePostNotifySheetMode;
    activeLevel: ProfilePostNotifyLevel;
    displayName: string;
    onClose: () => void;
    onChooseAll: () => void;
    onChooseNone: () => void;
};

/**
 * Post-notify picker — RN Modal (not gorhom) so it works on View Profile
 * the same way GazetteerAlertSheet does inside navigation stacks.
 */
export default function ProfilePostNotifySheet({
    visible,
    mode,
    activeLevel,
    displayName,
    onClose,
    onChooseAll,
    onChooseNone,
}: Props) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const who = displayName.trim() || 'this user';
    const accent = PASSPORT_PALETTE.wavePrimary;
    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 32, 400);
        const marginHorizontal = Math.max(16, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal };
    }, [width]);

    if (!visible) return null;

    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <View
                    style={[
                        styles.sheet,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            alignSelf: 'center',
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <PassportSheetCanvas contentStyle={styles.sheetInner}>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        <Text style={styles.gazetteerLabel}>Gazetteer says</Text>

                        {mode === 'menu' ? (
                            <>
                                <Text style={styles.title}>Post notifications</Text>
                                <Text style={styles.subtitle}>Get notified when this account posts.</Text>

                                <TouchableOpacity
                                    style={[styles.optionRow, activeLevel === 'all' && styles.optionRowActive]}
                                    onPress={onChooseAll}
                                >
                                    <Icon
                                        name="notifications"
                                        size={20}
                                        color={activeLevel === 'all' ? accent : '#FFFFFF'}
                                    />
                                    <Text
                                        style={[
                                            styles.optionText,
                                            activeLevel === 'all' && styles.optionTextActive,
                                        ]}
                                    >
                                        All posts
                                    </Text>
                                    {activeLevel === 'all' ? (
                                        <Icon name="checkmark" size={18} color={accent} />
                                    ) : null}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.optionRow, activeLevel === 'off' && styles.optionRowActive]}
                                    onPress={onChooseNone}
                                >
                                    <Icon
                                        name="notifications-outline"
                                        size={20}
                                        color={activeLevel === 'off' ? accent : '#9CA3AF'}
                                    />
                                    <Text
                                        style={[
                                            styles.optionText,
                                            activeLevel === 'off' && styles.optionTextActive,
                                        ]}
                                    >
                                        None
                                    </Text>
                                    {activeLevel === 'off' ? (
                                        <Icon name="checkmark" size={18} color={accent} />
                                    ) : null}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <View style={styles.confirmIconWrap}>
                                    <ProfilePostNotifyBell active size={28} activeColor={accent} />
                                </View>
                                <Text style={styles.title}>Notifications on</Text>
                                <Text style={styles.confirmMessage}>
                                    You'll get notified when <Text style={styles.confirmBold}>{who}</Text> posts.
                                </Text>
                                <TouchableOpacity style={styles.confirmBtn} onPress={onClose}>
                                    <Text style={styles.confirmBtnText}>Got it</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </PassportSheetCanvas>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: PASSPORT_ABYSS,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sheetInner: {
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    handleWrap: {
        alignItems: 'center',
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    gazetteerLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: PASSPORT_PALETTE.wavePrimary,
        textAlign: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(232,238,242,0.72)',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    optionRowActive: {
        borderColor: 'rgba(61,155,143,0.55)',
        backgroundColor: 'rgba(61,155,143,0.16)',
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#D1D5DB',
    },
    optionTextActive: {
        color: '#FFFFFF',
    },
    cancelBtn: {
        marginTop: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    confirmIconWrap: {
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 4,
    },
    confirmMessage: {
        fontSize: 15,
        color: 'rgba(232,238,242,0.78)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    confirmBold: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    confirmBtn: {
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        alignItems: 'center',
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
});
