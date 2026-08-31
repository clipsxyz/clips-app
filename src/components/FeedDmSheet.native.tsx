import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import PassportSheetCanvas from './PassportSheetCanvas.native';
import { PASSPORT_ABYSS, PASSPORT_PALETTE } from '../utils/discoverAmbientPalette';

type Props = {
    open: boolean;
    recipientHandle: string | null;
    onClose: () => void;
    onSend: (text: string) => void;
};

const P = {
    text: '#e8eef2',
    muted: 'rgba(232, 238, 242, 0.72)',
    border: 'rgba(255,255,255,0.12)',
    chipBg: 'rgba(15, 36, 48, 0.72)',
    handle: 'rgba(255,255,255,0.28)',
    accent: PASSPORT_PALETTE.wavePrimary,
};

export default function FeedDmSheet({
    open,
    recipientHandle,
    onClose,
    onSend,
}: Props) {
    const inputRef = useRef<TextInput>(null);
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [draft, setDraft] = useState('');
    const sheetOpen = open && !!recipientHandle;

    const sheetLayout = useMemo(() => {
        const sheetWidth = Math.min(width - 32, 400);
        const marginHorizontal = Math.max(16, Math.floor((width - sheetWidth) / 2));
        return { sheetWidth, marginHorizontal };
    }, [width]);

    useEffect(() => {
        if (!sheetOpen) {
            setDraft('');
            return;
        }
        const t = setTimeout(() => inputRef.current?.focus(), 320);
        return () => clearTimeout(t);
    }, [sheetOpen, recipientHandle]);

    const send = useCallback(() => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
    }, [draft, onSend]);

    if (!sheetOpen || !recipientHandle) return null;

    const displayName = recipientHandle.split('@')[0] || recipientHandle;

    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

                        <View style={styles.iconWrap}>
                            <Icon name="paper-plane" size={40} color="#FFFFFF" />
                        </View>

                        <Text style={styles.title}>Message {displayName}</Text>

                        <View style={styles.recipientRow}>
                            <Avatar
                                src={getAvatarForHandle(recipientHandle)}
                                name={displayName}
                                size={40}
                            />
                            <View style={styles.recipientText}>
                                <Text style={styles.recipientName} numberOfLines={1}>
                                    {displayName}
                                </Text>
                                <Text style={styles.recipientHandle} numberOfLines={1}>
                                    {recipientHandle}
                                </Text>
                            </View>
                        </View>

                        <TextInput
                            ref={inputRef}
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="Write a message…"
                            placeholderTextColor={P.muted}
                            multiline
                            style={styles.input}
                            returnKeyType="send"
                            blurOnSubmit={false}
                            onSubmitEditing={() => {
                                if (draft.trim()) send();
                            }}
                        />

                        <TouchableOpacity
                            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                            onPress={send}
                            disabled={!draft.trim()}
                            accessibilityLabel="Send message"
                        >
                            <Text style={styles.sendBtnText}>Send</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </PassportSheetCanvas>
                </KeyboardAvoidingView>
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
        zIndex: 2,
        elevation: 12,
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
        backgroundColor: P.handle,
    },
    gazetteerLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: P.accent,
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
        marginBottom: 16,
    },
    recipientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: P.chipBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: P.border,
        marginBottom: 14,
    },
    recipientText: {
        flex: 1,
        minWidth: 0,
    },
    recipientName: {
        fontSize: 15,
        fontWeight: '700',
        color: P.text,
    },
    recipientHandle: {
        fontSize: 12,
        color: P.muted,
        marginTop: 2,
    },
    input: {
        minHeight: 88,
        maxHeight: 140,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: P.border,
        backgroundColor: P.chipBg,
        color: P.text,
        fontSize: 15,
        lineHeight: 20,
        paddingHorizontal: 14,
        paddingVertical: 12,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    sendBtn: {
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },
    sendBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    cancelBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
