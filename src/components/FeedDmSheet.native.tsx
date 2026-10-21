/* @refresh reset */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import GazetteerBottomSheetModal, {
    GAZETTEER_SHEET_DM,
    type GazetteerBottomSheetModalHandle,
} from './GazetteerBottomSheetModal.native';
import {
    DISCOVER_SHEET_TEXT,
    DISCOVER_SHEET_TEXT_MUTED,
    PASSPORT_PALETTE,
} from '../utils/discoverAmbientPalette';

type Props = {
    open: boolean;
    recipientHandle: string | null;
    message: string;
    onChangeMessage: (text: string) => void;
    onClose: () => void;
    onSend: () => void;
    sending?: boolean;
};

export type FeedDmSheetHandle = {
    present: () => void;
    dismiss: () => void;
};

function displayHandle(handle: string): string {
    const trimmed = handle.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

const FeedDmSheet = forwardRef<FeedDmSheetHandle, Props>(function FeedDmSheet(
    {
        open,
        recipientHandle,
        message,
        onChangeMessage,
        onClose,
        onSend,
        sending = false,
    },
    ref,
) {
    const inputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
    const sheetRef = useRef<GazetteerBottomSheetModalHandle>(null);
    const handle = typeof recipientHandle === 'string' ? recipientHandle.trim() : '';
    const sheetOpen = Boolean(open && handle);

    const dismissSheet = useCallback(() => {
        sheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            present: () => {
                sheetRef.current?.present();
            },
            dismiss: dismissSheet,
        }),
        [dismissSheet],
    );

    useEffect(() => {
        if (!sheetOpen) return undefined;
        const t = setTimeout(() => inputRef.current?.focus(), 220);
        return () => clearTimeout(t);
    }, [sheetOpen, handle]);

    const label = displayHandle(handle);
    const canSend = Boolean(message.trim()) && !sending;

    return (
        <GazetteerBottomSheetModal
            ref={sheetRef}
            visible={sheetOpen}
            onDismiss={onClose}
            enableDynamicSizing
            bottomInset={0}
            horizontalInset={0}
            autoPresent={false}
            backgroundStyle={GAZETTEER_SHEET_DM.background}
            handleIndicatorStyle={GAZETTEER_SHEET_DM.handle}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <BottomSheetView style={styles.sheetBody}>
                <View style={styles.header}>
                    <Avatar
                        src={getAvatarForHandle(handle)}
                        name={handle.replace(/^@/, '').split('@')[0] || 'User'}
                        size={40}
                        hideBorder
                    />
                    <View style={styles.headerCopy}>
                        <Text style={styles.headerKicker}>Message</Text>
                        <Text style={styles.headerHandle} numberOfLines={1}>
                            {label || 'Message'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={dismissSheet}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close message sheet"
                        style={styles.closeBtn}
                    >
                        <Icon name="close" size={20} color={DISCOVER_SHEET_TEXT} />
                    </TouchableOpacity>
                </View>

                <BottomSheetTextInput
                    ref={inputRef}
                    value={message}
                    onChangeText={onChangeMessage}
                    placeholder="Message…"
                    placeholderTextColor={DISCOVER_SHEET_TEXT_MUTED}
                    multiline
                    textAlignVertical="top"
                    style={styles.input}
                    returnKeyType="send"
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                        if (canSend) onSend();
                    }}
                />

                <TouchableOpacity
                    style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                    onPress={onSend}
                    disabled={!canSend}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                >
                    <Icon name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.sendLabel}>{sending ? 'Sending…' : 'Send'}</Text>
                </TouchableOpacity>
            </BottomSheetView>
        </GazetteerBottomSheetModal>
    );
});

export default FeedDmSheet;

const styles = StyleSheet.create({
    sheetBody: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 16,
        overflow: 'hidden',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        backgroundColor: '#0F172A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        columnGap: 10,
    },
    headerCopy: {
        flex: 1,
        minWidth: 0,
    },
    headerKicker: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: DISCOVER_SHEET_TEXT_MUTED,
        marginBottom: 2,
    },
    headerHandle: {
        fontSize: 16,
        fontWeight: '600',
        color: DISCOVER_SHEET_TEXT,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    input: {
        width: '100%',
        minHeight: 96,
        maxHeight: 180,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(0,0,0,0.28)',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        lineHeight: 22,
        color: DISCOVER_SHEET_TEXT,
    },
    sendBtn: {
        marginTop: 14,
        minHeight: 48,
        borderRadius: 14,
        backgroundColor: PASSPORT_PALETTE.wavePrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        columnGap: 8,
    },
    sendBtnDisabled: {
        opacity: 0.45,
    },
    sendLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
