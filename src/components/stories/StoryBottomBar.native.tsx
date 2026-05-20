import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    hidden?: boolean;
    showReplyComposer: boolean;
    replyText: string;
    replyPlaceholder: string;
    isSending: boolean;
    hasReaction: boolean;
    onReplyTextChange: (text: string) => void;
    onOpenReply: () => void;
    onCancelReply: () => void;
    onSendReply: () => void;
    onLike: () => void;
    onShare: () => void;
};

/** Instagram-style bottom bar: Send message pill, like, share (web StoriesPage parity). */
export default function StoryBottomBar({
    hidden,
    showReplyComposer,
    replyText,
    replyPlaceholder,
    isSending,
    hasReaction,
    onReplyTextChange,
    onOpenReply,
    onCancelReply,
    onSendReply,
    onLike,
    onShare,
}: Props) {
    if (hidden) return null;

    return (
        <View style={styles.bar}>
            {showReplyComposer ? (
                <View style={styles.composerRow}>
                    <TextInput
                        value={replyText}
                        onChangeText={onReplyTextChange}
                        placeholder={replyPlaceholder}
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        style={styles.input}
                        autoFocus
                        editable={!isSending}
                        returnKeyType="send"
                        onSubmitEditing={() => {
                            if (!isSending && replyText.trim()) onSendReply();
                        }}
                    />
                    <TouchableOpacity
                        onPress={onSendReply}
                        disabled={!replyText.trim() || isSending}
                        style={[styles.sendBtn, (!replyText.trim() || isSending) && styles.sendBtnDisabled]}
                    >
                        <Text style={styles.sendBtnText}>{isSending ? '…' : 'Send'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onCancelReply} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.messagePill} onPress={onOpenReply} activeOpacity={0.9}>
                    <Text style={styles.messagePillText}>Send message</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onLike} style={styles.iconBtn}>
                <Icon
                    name="thumbs-up"
                    size={22}
                    color={hasReaction ? '#22D3EE' : '#FFFFFF'}
                />
            </TouchableOpacity>
            <TouchableOpacity onPress={onShare} style={styles.iconBtn}>
                <Icon name="paper-plane-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 16,
        zIndex: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: 420,
        alignSelf: 'center',
    },
    composerRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
    },
    input: {
        flex: 1,
        minWidth: 0,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        color: '#fff',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    sendBtn: {
        borderRadius: 999,
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
    cancelBtn: {
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    cancelBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    messagePill: {
        flex: 1,
        minWidth: 0,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    messagePillText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '700',
    },
    iconBtn: { padding: 6, flexShrink: 0 },
});
