import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import {
    UCL_CANVAS_NAVY,
    UCL_TEXT_PRIMARY,
} from '../theme/gazetteerAmbientNative';

type Props = {
    visible: boolean;
    title: string;
    message?: string;
    icon?: 'success' | 'alert' | 'info';
    showIcon?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    confirmDestructive?: boolean;
    /** Centered dark card. Passport settings use this; other screens keep the bottom sheet. */
    variant?: 'sheet' | 'card';
    onConfirm: () => void;
    onDismiss: () => void;
};

/**
 * Web `Swal.fire(bottomSheet(...))` parity — uses RN Modal so alerts work inside
 * navigation modals (gorhom BottomSheetModal often fails there).
 */
export default function GazetteerAlertSheet({
    visible,
    title,
    message,
    icon = 'alert',
    showIcon = true,
    confirmButtonText = 'Done',
    cancelButtonText = 'Cancel',
    showCancelButton = false,
    confirmDestructive = false,
    variant = 'sheet',
    onConfirm,
    onDismiss,
}: Props) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 32, 400);
        const marginHorizontal = Math.max(16, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal };
    }, [width]);

    const iconName =
        icon === 'success' ? 'checkmark-circle' : icon === 'info' ? 'information-circle' : 'alert-circle';

    if (!visible) return null;

    if (variant === 'card') {
        const cardIcon = icon === 'success' ? 'checkmark' : icon === 'info' ? 'information' : 'alert';
        const danger = confirmDestructive || icon === 'alert';
        return (
            <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
                <View style={styles.cardBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                    <View style={styles.card}>
                        {showIcon ? (
                            <View
                                style={[
                                    styles.cardIconWrap,
                                    { backgroundColor: danger ? 'rgba(229, 57, 53, 0.16)' : 'rgba(244, 114, 182, 0.16)' },
                                ]}
                            >
                                <Icon name={cardIcon} size={22} color={danger ? '#FF8A80' : '#F472B6'} />
                            </View>
                        ) : null}
                        <Text style={styles.cardTitle}>{title}</Text>
                        {message ? <Text style={styles.cardSubtitle}>{message}</Text> : null}
                        <Pressable
                            style={[styles.cardConfirm, confirmDestructive && styles.cardConfirmDanger]}
                            onPress={onConfirm}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.cardConfirmText, confirmDestructive && styles.cardConfirmDangerText]}>
                                {confirmButtonText}
                            </Text>
                        </Pressable>
                        {showCancelButton ? (
                            <Pressable style={styles.cardCancel} onPress={onDismiss} accessibilityRole="button">
                                <Text style={styles.cardCancelText}>{cancelButtonText}</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={onDismiss}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onDismiss}
                />
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
                    <PassportSheetCanvas tone="ucl" contentStyle={styles.sheetInner}>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        <Text style={styles.gazetteerLabel}>Gazetteer says</Text>

                        {showIcon ? (
                            <View style={styles.iconWrap}>
                                <Icon name={iconName} size={44} color={UCL_TEXT_PRIMARY} />
                            </View>
                        ) : null}

                        <Text style={styles.title}>{title}</Text>
                        {message ? <Text style={styles.message}>{message}</Text> : null}

                        <TouchableOpacity
                            style={[styles.confirmBtn, confirmDestructive && styles.confirmBtnDanger]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.confirmBtnText, confirmDestructive && styles.confirmBtnDangerText]}>
                                {confirmButtonText}
                            </Text>
                        </TouchableOpacity>
                        {showCancelButton ? (
                            <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                                <Text style={styles.cancelBtnText}>{cancelButtonText}</Text>
                            </TouchableOpacity>
                        ) : null}
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
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: UCL_CANVAS_NAVY,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.08)',
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
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    gazetteerLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: UCL_TEXT_PRIMARY,
        textAlign: 'center',
        marginBottom: 12,
    },
    iconWrap: {
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: UCL_TEXT_PRIMARY,
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#E2E8F0',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    confirmBtn: {
        borderRadius: 999,
        backgroundColor: UCL_TEXT_PRIMARY,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: UCL_CANVAS_NAVY,
    },
    confirmBtnDanger: {
        backgroundColor: 'rgba(185, 28, 28, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    confirmBtnDangerText: {
        color: '#FFFFFF',
    },
    cancelBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    cardBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 18,
        backgroundColor: '#161B22',
        borderWidth: 1,
        borderColor: '#2A2F3D',
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 16,
        alignItems: 'center',
    },
    cardIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '700',
        textAlign: 'center',
    },
    cardSubtitle: {
        marginTop: 8,
        color: '#8B949E',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    cardConfirm: {
        marginTop: 18,
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        paddingVertical: 13,
        alignItems: 'center',
    },
    cardConfirmDanger: {
        backgroundColor: '#E53935',
    },
    cardConfirmText: {
        color: '#0B0E14',
        fontSize: 15,
        fontWeight: '700',
    },
    cardConfirmDangerText: {
        color: '#FFFFFF',
    },
    cardCancel: {
        marginTop: 8,
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#21262D',
        paddingVertical: 13,
        alignItems: 'center',
    },
    cardCancelText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});
