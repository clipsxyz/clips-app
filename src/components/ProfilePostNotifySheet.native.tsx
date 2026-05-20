import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ProfilePostNotifyBell from './ProfilePostNotifyBell.native';
import { glassPanel } from '../theme/gazetteerAmbientNative';
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

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { width: Math.min(width - 32, 400) }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.handle} />

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
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 7, 17, 0.72)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    sheet: {
        borderRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        alignSelf: 'center',
        ...glassPanel,
        backgroundColor: '#1a1a1a',
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 14,
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
