import React, { useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GAZETTEER_SHEET_SLATE } from './GazetteerBottomSheetModal.native';

export type GazetteerMenuOption = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
};

type Props = {
    visible: boolean;
    title: string;
    subtitle?: string;
    options: GazetteerMenuOption[];
    cancelLabel?: string;
    onDismiss: () => void;
};

/** Web Swal / action-sheet parity for multi-option menus on React Native. */
export default function GazetteerMenuSheet({
    visible,
    title,
    subtitle,
    options,
    cancelLabel = 'Cancel',
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
        <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
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
                    <Text style={styles.title}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    <ScrollView style={styles.optionsScroll} bounces={false}>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.label}
                                style={styles.optionBtn}
                                onPress={() => {
                                    onDismiss();
                                    option.onPress();
                                }}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        option.destructive ? styles.optionTextDestructive : null,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                        <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
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
        maxHeight: '78%',
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
        width: 40,
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
        marginBottom: 10,
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
        color: '#D1D5DB',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
    },
    optionsScroll: {
        maxHeight: 320,
        marginBottom: 8,
    },
    optionBtn: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    optionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    optionTextDestructive: {
        color: '#F87171',
    },
    cancelBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
