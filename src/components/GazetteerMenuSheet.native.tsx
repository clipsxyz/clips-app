import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Easing,
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

export type GazetteerMenuOption = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
    /** Ionicons glyph (optional). */
    icon?: string;
};

type Props = {
    visible: boolean;
    title: string;
    subtitle?: string;
    options: GazetteerMenuOption[];
    cancelLabel?: string;
    onDismiss: () => void;
};

/** View Profile passport canvas — sea-glass / night atlas (matches GazetteerAlertSheet). */
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

    const fade = useRef(new Animated.Value(0)).current;
    const rise = useRef(new Animated.Value(14)).current;

    useEffect(() => {
        if (!visible) {
            fade.setValue(0);
            rise.setValue(14);
            return;
        }
        fade.setValue(0);
        rise.setValue(14);
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(rise, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, fade, rise]);

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            marginHorizontal: sheetLayout.marginHorizontal,
                            width: sheetLayout.sheetWidth,
                            alignSelf: 'center',
                            paddingBottom: Math.max(insets.bottom, 16),
                            opacity: fade,
                            transform: [{ translateY: rise }],
                        },
                    ]}
                >
                    <PassportSheetCanvas contentStyle={styles.sheetInner}>
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>
                        <Text style={styles.gazetteerLabel}>Gazetteer says</Text>
                        <Text style={styles.title}>{title}</Text>
                        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                        <ScrollView style={styles.optionsScroll} bounces={false}>
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={option.label}
                                    style={[
                                        styles.optionBtn,
                                        option.icon ? styles.optionBtnWithIcon : null,
                                    ]}
                                    onPress={() => {
                                        onDismiss();
                                        // Defer so the sheet Modal closes before launching pickers / navigation.
                                        setTimeout(() => option.onPress(), 80);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    {option.icon ? (
                                        <View style={styles.optionIconWrap}>
                                            <Icon
                                                name={option.icon}
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                        </View>
                                    ) : null}
                                    <Text
                                        style={[
                                            styles.optionText,
                                            option.destructive
                                                ? styles.optionTextDestructive
                                                : null,
                                            option.icon ? styles.optionTextWithIcon : null,
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
                    </PassportSheetCanvas>
                </Animated.View>
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
        color: 'rgba(232,238,242,0.72)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
    },
    optionsScroll: {
        maxHeight: 320,
        marginBottom: 8,
    },
    optionBtn: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 15,
        paddingHorizontal: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    optionBtnWithIcon: {
        justifyContent: 'flex-start',
    },
    optionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(61, 155, 143, 0.22)',
        borderWidth: 1,
        borderColor: 'rgba(61, 155, 143, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    optionTextWithIcon: {
        textAlign: 'left',
        flexShrink: 1,
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
