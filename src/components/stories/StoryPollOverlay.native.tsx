import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { Story } from '../../types';

type PollOption = 'option1' | 'option2' | 'option3';

type Props = {
    story: Story;
    optimisticVote?: PollOption | null;
    onVote: (option: PollOption) => void;
    onInteractionStart?: () => void;
};

export default function StoryPollOverlay({
    story,
    optimisticVote,
    onVote,
    onInteractionStart,
}: Props) {
    const poll = story.poll;

    const options = useMemo(() => {
        if (!poll?.question || !poll.option1 || !poll.option2) return [];
        const votes1 = poll.votes1 ?? 0;
        const votes2 = poll.votes2 ?? 0;
        const votes3 = poll.votes3 ?? 0;
        const list: Array<{ key: PollOption; label: string; votes: number }> = [
            { key: 'option1', label: poll.option1, votes: votes1 },
            { key: 'option2', label: poll.option2, votes: votes2 },
        ];
        if (poll.option3?.trim()) {
            list.push({ key: 'option3', label: poll.option3, votes: votes3 });
        }
        return list;
    }, [poll?.option1, poll?.option2, poll?.option3, poll?.votes1, poll?.votes2, poll?.votes3]);

    if (!poll?.question || !poll.option1 || !poll.option2) return null;

    const userVote = optimisticVote ?? poll.userVote;
    const votes1 = poll.votes1 ?? 0;
    const votes2 = poll.votes2 ?? 0;
    const votes3 = poll.votes3 ?? 0;
    const total = votes1 + votes2 + votes3;
    const hasVoted = userVote !== undefined;

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    return (
        <View
            style={styles.host}
            onStartShouldSetResponder={() => true}
            onTouchStart={onInteractionStart}
        >
            <LinearGradient
                colors={['rgba(255,78,203,0.85)', 'rgba(143,91,255,0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.border}
            >
                <View style={styles.card}>
                    <Text style={styles.question}>{poll.question}</Text>
                    {options.map((opt) => {
                        const selected = userVote === opt.key;
                        const disabled = hasVoted && !selected;
                        return (
                            <Pressable
                                key={opt.key}
                                style={[
                                    styles.option,
                                    selected && styles.optionSelected,
                                    disabled && styles.optionDisabled,
                                ]}
                                disabled={hasVoted}
                                onPress={() => {
                                    onInteractionStart?.();
                                    onVote(opt.key);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.optionLabel,
                                        selected && styles.optionLabelSelected,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {opt.label}
                                </Text>
                                {hasVoted ? (
                                    <Text style={styles.optionPct}>{pct(opt.votes)}%</Text>
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 16,
        right: 16,
        top: '52%',
        transform: [{ translateY: -80 }],
        zIndex: 80,
    },
    border: { borderRadius: 14, padding: 2 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 12,
        padding: 14,
    },
    question: {
        color: '#111827',
        fontWeight: '700',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
    },
    option: {
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    optionSelected: {
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,0.12)',
    },
    optionDisabled: { opacity: 0.85 },
    optionLabel: { color: '#111827', fontWeight: '600', fontSize: 14, flex: 1 },
    optionLabelSelected: { color: '#1D4ED8' },
    optionPct: { color: '#6B7280', fontWeight: '700', fontSize: 12, marginLeft: 8 },
});
