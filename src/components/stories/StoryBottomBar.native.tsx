import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
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
        <View style={styles.host} pointerEvents="box-none">
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
                            blurOnSubmit={false}
                            onSubmitEditing={() => {
                                if (!isSending && replyText.trim()) onSendReply();
                            }}
                        />
                        <Pressable
                            onPress={onSendReply}
                            disabled={!replyText.trim() || isSending}
                            style={({ pressed }) => [
                                styles.sendBtn,
                                (!replyText.trim() || isSending) && styles.sendBtnDisabled,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.sendBtnText}>{isSending ? '…' : 'Send'}</Text>
                        </Pressable>
                        <Pressable
                            onPress={onCancelReply}
                            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                    </View>
                ) : (
                    <Pressable
                        style={({ pressed }) => [styles.messagePill, pressed && styles.pressed]}
                        onPress={onOpenReply}
                    >
                        <Text style={styles.messagePillText}>Send message</Text>
                    </Pressable>
                )}

                <Pressable
                    onPress={onLike}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    hitSlop={8}
                >
                    <Icon
                        name="thumbs-up"
                        size={22}
                        color={hasReaction ? '#22D3EE' : '#FFFFFF'}
                    />
                </Pressable>
                <Pressable
                    onPress={onShare}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    hitSlop={8}
                >
                    <Icon name="paper-plane-outline" size={22} color="#FFFFFF" />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        elevation: 12,
        paddingHorizontal: 8,
        paddingBottom: 16,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        maxWidth: 448,
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
        paddingVertical: Platform.OS === 'android' ? 6 : 8,
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
    iconBtn: {
        padding: 6,
        flexShrink: 0,
    },
    pressed: { opacity: 0.85 },
});
