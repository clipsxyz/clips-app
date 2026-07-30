import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ox } from '../../constants/nativeOpticalScale';

const QUICK_REACTIONS = ['😍', '😂'] as const;

type Props = {
    hidden?: boolean;
    /** Owner viewing their own story — insights + share footer (no Message composer). */
    ownerMode?: boolean;
    ownerSummary?: string;
    onOpenInsights?: () => void;
    showReplyComposer: boolean;
    replyText: string;
    replyPlaceholder?: string;
    isSending: boolean;
    hasReaction: boolean;
    activeQuickEmoji?: string | null;
    onReplyTextChange: (text: string) => void;
    onOpenReply: () => void;
    onCancelReply: () => void;
    onSendReply: () => void;
    onLike: () => void;
    onShare: () => void;
    onQuickReact: (emoji: string) => void;
};

/**
 * TikTok-style story footer: bordered Message pill · spaced emojis · heart · share.
 * Owner mode: insights pill · share (Instagram owner chrome).
 */
export default function StoryBottomBar({
    hidden,
    ownerMode = false,
    ownerSummary = 'Tap for insights',
    onOpenInsights,
    showReplyComposer,
    replyText,
    replyPlaceholder = 'Message...',
    isSending,
    hasReaction,
    activeQuickEmoji,
    onReplyTextChange,
    onOpenReply,
    onCancelReply,
    onSendReply,
    onLike,
    onShare,
    onQuickReact,
}: Props) {
    const insets = useSafeAreaInsets();
    if (hidden) return null;

    return (
        <View
            style={[styles.host, { paddingBottom: Math.max(insets.bottom, ox(12)) }]}
            pointerEvents="box-none"
        >
            {ownerMode ? (
                <View style={styles.tray}>
                    <TouchableOpacity
                        style={styles.messagePill}
                        onPress={onOpenInsights}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Story insights"
                    >
                        <Text style={styles.messagePillText} numberOfLines={1}>
                            {ownerSummary}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onShare}
                        style={styles.actionBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Share story"
                    >
                        <Icon name="arrow-redo-outline" size={ox(28)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            ) : showReplyComposer ? (
                <View style={styles.tray}>
                    <TextInput
                        value={replyText}
                        onChangeText={onReplyTextChange}
                        placeholder={replyPlaceholder}
                        placeholderTextColor="rgba(255,255,255,0.55)"
                        style={styles.input}
                        autoFocus
                        editable={!isSending}
                        returnKeyType="send"
                        blurOnSubmit={false}
                        onSubmitEditing={() => {
                            if (!isSending && replyText.trim()) onSendReply();
                        }}
                    />
                    <TouchableOpacity
                        onPress={onSendReply}
                        disabled={!replyText.trim() || isSending}
                        style={[
                            styles.sendBtn,
                            (!replyText.trim() || isSending) && styles.sendBtnDisabled,
                        ]}
                        activeOpacity={0.75}
                    >
                        <Icon name="send" size={ox(16)} color="#000000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onCancelReply}
                        style={styles.cancelBtn}
                        activeOpacity={0.75}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon name="close" size={ox(22)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.tray}>
                    <TouchableOpacity
                        style={styles.messagePill}
                        onPress={onOpenReply}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.messagePillText}>Message...</Text>
                    </TouchableOpacity>

                    {QUICK_REACTIONS.map((emoji) => {
                        const selected = activeQuickEmoji === emoji;
                        return (
                            <TouchableOpacity
                                key={emoji}
                                onPress={() => onQuickReact(emoji)}
                                style={[styles.actionBtn, selected && styles.actionBtnSelected]}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                accessibilityRole="button"
                                accessibilityLabel={`React ${emoji}`}
                            >
                                <Text style={styles.emoji} allowFontScaling={false}>
                                    {emoji}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity
                        onPress={onLike}
                        style={styles.actionBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Like story"
                    >
                        <Icon
                            name={hasReaction ? 'heart' : 'heart-outline'}
                            size={ox(28)}
                            color={hasReaction ? '#FF2D55' : '#FFFFFF'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onShare}
                        style={styles.actionBtn}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Share story"
                    >
                        <Icon name="arrow-redo-outline" size={ox(28)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const ACTION = ox(44);

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 120,
        elevation: 24,
        paddingHorizontal: ox(10),
        paddingTop: ox(8),
    },
    tray: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderRadius: ox(999),
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.65)',
        backgroundColor: 'rgba(0,0,0,0.38)',
        paddingLeft: ox(4),
        paddingRight: ox(6),
        paddingVertical: ox(4),
        minHeight: ox(52),
    },
    messagePill: {
        flex: 1,
        minWidth: ox(110),
        justifyContent: 'center',
        paddingHorizontal: ox(14),
        paddingVertical: Platform.OS === 'android' ? ox(10) : ox(11),
        marginRight: ox(4),
    },
    messagePillText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: ox(15),
        fontWeight: '500',
    },
    actionBtn: {
        width: ACTION,
        height: ACTION,
        marginLeft: ox(2),
        borderRadius: ACTION / 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    actionBtnSelected: {
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    emoji: {
        fontSize: ox(28),
        lineHeight: ox(34),
        textAlign: 'center',
    },
    input: {
        flex: 1,
        minWidth: 0,
        color: '#FFFFFF',
        fontSize: ox(15),
        paddingHorizontal: ox(14),
        paddingVertical: Platform.OS === 'android' ? ox(10) : ox(11),
    },
    sendBtn: {
        width: ACTION,
        height: ACTION,
        borderRadius: ACTION / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginLeft: ox(4),
    },
    sendBtnDisabled: { opacity: 0.45 },
    cancelBtn: {
        width: ox(40),
        height: ACTION,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginLeft: ox(2),
    },
});
