import React, { useCallback, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BottomSheetFooter,
    BottomSheetTextInput,
    BottomSheetView,
    type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';
import GazetteerBottomSheetModal, { GAZETTEER_SHEET_DM } from './GazetteerBottomSheetModal.native';

type Props = {
    open: boolean;
    recipientHandle: string | null;
    message: string;
    onChangeMessage: (text: string) => void;
    onClose: () => void;
    onSend: () => void;
};

export default function FeedDmSheet({
    open,
    recipientHandle,
    message,
    onChangeMessage,
    onClose,
    onSend,
}: Props) {
    const insets = useSafeAreaInsets();
    const inputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
    const sheetOpen = open && !!recipientHandle;

    useEffect(() => {
        if (!sheetOpen) return;
        const t = setTimeout(() => inputRef.current?.focus(), 200);
        return () => clearTimeout(t);
    }, [sheetOpen, recipientHandle]);

    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props} bottomInset={Math.max(insets.bottom, 12)}>
                <View style={styles.footerInner}>
                    <View style={styles.composerRow}>
                        <BottomSheetTextInput
                            ref={inputRef}
                            value={message}
                            onChangeText={onChangeMessage}
                            placeholder="Message…"
                            placeholderTextColor="#737373"
                            multiline
                            style={styles.input}
                            returnKeyType="send"
                            blurOnSubmit={false}
                            onSubmitEditing={() => {
                                if (message.trim()) onSend();
                            }}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
                            onPress={onSend}
                            disabled={!message.trim()}
                            accessibilityLabel="Send message"
                        >
                            <Icon name="send" size={20} color="#000000" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>Return to send · use newline for longer messages</Text>
                </View>
            </BottomSheetFooter>
        ),
        [insets.bottom, message, onChangeMessage, onSend],
    );

    if (!recipientHandle) return null;

    const displayName = recipientHandle.split('@')[0] || recipientHandle;

    return (
        <GazetteerBottomSheetModal
            visible={sheetOpen}
            onDismiss={onClose}
            enableDynamicSizing
            horizontalInset={0}
            backgroundStyle={GAZETTEER_SHEET_DM.background}
            handleIndicatorStyle={GAZETTEER_SHEET_DM.handle}
            footerComponent={renderFooter}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            backdropOpacity={0.55}
        >
            <BottomSheetView style={styles.sheetBody}>
                <View style={styles.header}>
                    <Avatar
                        src={getAvatarForHandle(recipientHandle)}
                        name={displayName}
                        size={40}
                    />
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text style={styles.headerSub} numberOfLines={1}>
                            {recipientHandle}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                        <Icon name="close" size={22} color="#D1D5DB" />
                    </TouchableOpacity>
                </View>
            </BottomSheetView>
        </GazetteerBottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetBody: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSub: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    footerInner: {
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#000000',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: '#0a0a0a',
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },
    hint: {
        marginTop: 8,
        fontSize: 11,
        color: '#6B7280',
        paddingHorizontal: 4,
        paddingBottom: 4,
    },
});
