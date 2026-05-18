import React, { useEffect, useRef } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { getAvatarForHandle } from '../api/users';

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
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (open) {
            const t = setTimeout(() => inputRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [open]);

    if (!open || !recipientHandle) return null;

    const displayName = recipientHandle.split('@')[0] || recipientHandle;

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.root}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <View style={styles.grabber} />
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
                    <View style={styles.composerRow}>
                        <TextInput
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
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        backgroundColor: '#000000',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    grabber: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginBottom: 12,
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
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 12,
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
    },
});
