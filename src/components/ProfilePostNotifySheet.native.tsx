import React, { useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import ProfilePostNotifyBell from './ProfilePostNotifyBell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
import type { ProfilePostNotifyLevel } from '../utils/profilePostNotifyPrefs';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_SLATE } from './GazetteerBottomSheetModal.native';

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

/** Gazetteer-style bottom sheet — menu (All / None) + confirmation (matches web Swal). */
export default function ProfilePostNotifySheet({
    visible,
    mode,
    activeLevel,
    displayName,
    onClose,
    onChooseAll,
    onChooseNone,
}: Props) {
    const { width } = useWindowDimensions();
    const who = displayName.trim() || 'this user';
    const horizontalInset = useMemo(() => {
        const maxSheet = Math.min(width - 32, 400);
        return Math.max(16, Math.floor((width - maxSheet) / 2));
    }, [width]);
    const sheetBackground = useMemo(
        () => [GAZETTEER_SHEET_SLATE.background, glassPanel],
        [],
    );

    return (
        <GazetteerBottomSheetModal
            visible={visible}
            onDismiss={onClose}
            enableDynamicSizing
            horizontalInset={horizontalInset}
            backgroundStyle={sheetBackground}
            handleIndicatorStyle={GAZETTEER_SHEET_SLATE.handle}
            backdropOpacity={0.72}
        >
            <BottomSheetView style={styles.sheetBody}>
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
                                color={activeLevel === 'all' ? '#f9a8d4' : '#FFFFFF'}
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
                                <Icon name="checkmark" size={18} color="#f9a8d4" />
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionRow, activeLevel === 'off' && styles.optionRowActive]}
                            onPress={onChooseNone}
                        >
                            <Icon
                                name="notifications-outline"
                                size={20}
                                color={activeLevel === 'off' ? '#f9a8d4' : '#9CA3AF'}
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
                                <Icon name="checkmark" size={18} color="#f9a8d4" />
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.confirmIconWrap}>
                            <ProfilePostNotifyBell active size={28} activeColor="#f9a8d4" />
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
            </BottomSheetView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetBody: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 20,
    },
    gazetteerLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'rgba(217, 27, 92, 0.95)',
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
        color: '#9CA3AF',
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
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    optionRowActive: {
        borderColor: 'rgba(217, 27, 92, 0.45)',
        backgroundColor: 'rgba(217, 27, 92, 0.12)',
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
        color: '#D1D5DB',
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
        backgroundColor: '#d91b5c',
        paddingVertical: 14,
        alignItems: 'center',
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
