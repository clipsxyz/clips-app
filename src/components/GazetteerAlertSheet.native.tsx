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
import { GAZETTEER_SHEET_SLATE } from './GazetteerBottomSheetModal.native';

type Props = {
    visible: boolean;
    title: string;
    message?: string;
    icon?: 'success' | 'alert';
    confirmButtonText?: string;
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
    confirmButtonText = 'Done',
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
                        GAZETTEER_SHEET_SLATE.background,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            alignSelf: 'center',
                            paddingBottom: Math.max(insets.bottom, 16),
                        },
                    ]}
                >
                    <View style={styles.handleWrap}>
                        <View style={[styles.handle, GAZETTEER_SHEET_SLATE.handle]} />
                    </View>

                    <Text style={styles.gazetteerLabel}>Gazetteer says</Text>

                    <View style={styles.iconWrap}>
                        <Icon
                            name={icon === 'success' ? 'checkmark-circle' : 'alert-circle'}
                            size={44}
                            color="#FFFFFF"
                        />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
                        <Text style={styles.confirmBtnText}>{confirmButtonText}</Text>
                    </TouchableOpacity>
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
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    handleWrap: {
        alignItems: 'center',
        paddingBottom: 8,
    },
    handle: {
        height: 4,
        borderRadius: 2,
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
    iconWrap: {
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#D1D5DB',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    confirmBtn: {
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
});
