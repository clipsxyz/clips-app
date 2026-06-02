import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Post } from '../types';
import Avatar from './Avatar';
import Flag from './Flag.native';
import { getAvatarForHandle, getFlagForHandle } from '../api/users';
import { timeAgo } from '../utils/timeAgo';

type TextStyle = {
    color?: string;
    size?: 'small' | 'medium' | 'large';
    background?: string;
};

type Props = {
    post: Post;
    text: string;
    textStyle?: TextStyle;
};

function bodyFontSize(size?: TextStyle['size']): number {
    if (size === 'small') return 14;
    if (size === 'large') return 18;
    return 16;
}

/** White “Twitter card” preview for text carousel slides (web ScenesModal parity). */
export default function ScenesTextPostCard({ post, text, textStyle }: Props) {
    const textColor = textStyle?.color || '#FFFFFF';
    const textBg = textStyle?.background || '#000000';
    const handle = post.userHandle;
    const displayName = handle.split('@')[0] || handle;

    return (
        <View style={styles.outer}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Avatar src={getAvatarForHandle(handle)} name={displayName} size="sm" />
                    <View style={styles.headerTextCol}>
                        <View style={styles.handleRow}>
                            <Text style={styles.handle} numberOfLines={1}>
                                {handle}
                            </Text>
                            <Flag value={getFlagForHandle(handle) || ''} size={14} />
                        </View>
                        {post.locationLabel ? (
                            <Text style={styles.meta} numberOfLines={1}>
                                {post.locationLabel}
                                {post.createdAt ? ` · ${timeAgo(post.createdAt)}` : ''}
                            </Text>
                        ) : post.createdAt ? (
                            <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.body}>
                    <View style={[styles.textBox, { backgroundColor: textBg }]}>
                        <Text
                            style={[
                                styles.textBody,
                                { color: textColor, fontSize: bodyFontSize(textStyle?.size) },
                            ]}
                        >
                            {text}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outer: {
        flex: 1,
        width: '100%',
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    headerTextCol: {
        flex: 1,
        minWidth: 0,
    },
    handleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    handle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        flexShrink: 1,
    },
    meta: {
        marginTop: 2,
        fontSize: 12,
        color: '#6B7280',
    },
    body: {
        padding: 16,
    },
    textBox: {
        borderRadius: 8,
        padding: 16,
        width: '100%',
    },
    textBody: {
        lineHeight: 22,
    },
});
