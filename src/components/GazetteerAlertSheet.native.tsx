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

                        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
                            <Text style={styles.confirmBtnText}>{confirmButtonText}</Text>
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
});
