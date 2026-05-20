import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { parseStoryMentionParts } from '../../utils/storyMentionParts';

type Props = {
    text: string;
    taggedUsers?: string[];
    textColor?: string;
    embedded?: boolean;
    onMentionPress: (handle: string) => void;
};

export default function StoryTextOverlay({
    text,
    taggedUsers,
    textColor = '#fff',
    embedded,
    onMentionPress,
}: Props) {
    const parts = parseStoryMentionParts(text, taggedUsers);

    return (
        <View style={[styles.wrap, embedded && styles.wrapEmbedded]} pointerEvents="box-none">
            <Text style={[styles.text, { color: textColor }]}>
                {parts.map((part, idx) => {
                    if (part.type === 'text') {
                        return <Text key={`t-${idx}`}>{part.value}</Text>;
                    }
                    if (part.clickable) {
                        return (
                            <Text
                                key={`m-${idx}`}
                                style={styles.mention}
                                onPress={() => onMentionPress(part.value)}
                            >
                                @{part.value}
                            </Text>
                        );
                    }
                    return <Text key={`m-${idx}`}>@{part.value}</Text>;
                })}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: 128,
        zIndex: 55,
    },
    wrapEmbedded: {
        position: 'relative',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    text: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    mention: {
        textDecorationLine: 'underline',
        fontWeight: '800',
    },
});
