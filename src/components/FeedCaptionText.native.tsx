import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
    caption: string;
    onHandlePress?: (handle: string) => void;
};

const HANDLE_RE = /\b[A-Za-z0-9._-]+@[A-Za-z0-9_-]+\b/g;

/** Matches web CaptionText in App.tsx: text-gray-100 text-[13px] leading-snug */
export default function FeedCaptionText({ caption, onHandlePress }: Props) {
    const [expanded, setExpanded] = useState(false);
    const hasMore = caption.length > 120 || caption.includes('\n');

    const parts = useMemo(() => {
        const nodes: Array<{ type: 'text' | 'handle'; value: string }> = [];
        let cursor = 0;
        let match: RegExpExecArray | null;
        while ((match = HANDLE_RE.exec(caption)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start > cursor) {
                nodes.push({ type: 'text', value: caption.slice(cursor, start) });
            }
            nodes.push({ type: 'handle', value: match[0] });
            cursor = end;
        }
        if (cursor < caption.length) {
            nodes.push({ type: 'text', value: caption.slice(cursor) });
        }
        return nodes;
    }, [caption]);

    return (
        <View>
            <Text style={styles.body} numberOfLines={expanded ? undefined : 2}>
                {parts.map((p, i) =>
                    p.type === 'handle' ? (
                        <Text
                            key={`h-${i}`}
                            style={styles.handleLink}
                            onPress={
                                onHandlePress
                                    ? () => onHandlePress(p.value)
                                    : undefined
                            }
                        >
                            {p.value}
                        </Text>
                    ) : (
                        <Text key={`t-${i}`}>{p.value}</Text>
                    ),
                )}
            </Text>
            {hasMore ? (
                <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={6}>
                    <Text style={styles.more}>{expanded ? 'Show less' : 'Show more'}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    body: {
        fontSize: 13,
        lineHeight: 18,
        color: '#F3F4F6',
    },
    handleLink: {
        color: '#7A8AF0',
    },
    more: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.9)',
    },
});
