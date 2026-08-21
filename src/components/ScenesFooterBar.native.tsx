import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    bottomInset: number;
    isOwnPost: boolean;
    onAddComment: () => void;
    onDirectMessage: () => void;
    onMore: () => void;
};

/** Instagram Reels-style footer: frosted comment field + light icon actions. */
export default function ScenesFooterBar({
    bottomInset,
    isOwnPost,
    onAddComment,
    onDirectMessage,
    onMore,
}: Props) {
    return (
        <View style={[styles.row, { paddingBottom: Math.max(bottomInset, 10) }]}>
            <Pressable
                style={styles.commentPill}
                onPress={onAddComment}
                accessibilityLabel="Add comment"
            >
                <Text style={styles.commentPillText}>Add a comment…</Text>
            </Pressable>
            <Pressable
                style={[styles.iconChip, isOwnPost && styles.iconChipDisabled]}
                onPress={onDirectMessage}
                disabled={isOwnPost}
                accessibilityLabel="Send direct message"
            >
                <Icon name="paper-plane-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
                style={styles.iconChip}
                onPress={onMore}
                accessibilityLabel="More options"
            >
                <Icon name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 6,
    },
    commentPill: {
        flex: 1,
        minHeight: 38,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.28)',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 10,
    },
    commentPillText: {
        color: 'rgba(255,255,255,0.62)',
        fontSize: 13,
        fontWeight: '500',
    },
    iconChip: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    iconChipDisabled: {
        opacity: 0.35,
    },
});
