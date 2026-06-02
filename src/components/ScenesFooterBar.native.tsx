import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type Props = {
    bottomInset: number;
    isOwnPost: boolean;
    onAddComment: () => void;
    onDirectMessage: () => void;
    onMore: () => void;
};

/** Web ScenesModal footer: Add comment pill + DM + overflow chips. */
export default function ScenesFooterBar({
    bottomInset,
    isOwnPost,
    onAddComment,
    onDirectMessage,
    onMore,
}: Props) {
    return (
        <View style={[styles.row, { paddingBottom: Math.max(bottomInset, 16) }]}>
            <Pressable
                style={styles.commentPill}
                onPress={onAddComment}
                accessibilityLabel="Add comment"
            >
                <Text style={styles.commentPillText}>Add comment...</Text>
            </Pressable>
            <Pressable
                style={[styles.iconChip, isOwnPost && styles.iconChipDisabled]}
                onPress={onDirectMessage}
                disabled={isOwnPost}
                accessibilityLabel="Send direct message"
            >
                <Icon name="paper-plane-outline" size={22} color="#000000" />
            </Pressable>
            <Pressable
                style={styles.iconChip}
                onPress={onMore}
                accessibilityLabel="More options"
            >
                <Icon name="ellipsis-horizontal" size={22} color="#000000" />
            </Pressable>
        </View>
    );
}

const chipShadow = Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.26,
        shadowRadius: 8,
    },
    android: { elevation: 6 },
});

const pillShadow = Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
    },
    android: { elevation: 8 },
});

const styles = StyleSheet.create({
    row: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
    },
    commentPill: {
        flex: 1,
        minHeight: 44,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        ...pillShadow,
    },
    commentPillText: {
        color: '#111827',
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.9,
    },
    iconChip: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        ...chipShadow,
    },
    iconChipDisabled: {
        opacity: 0.4,
    },
});
